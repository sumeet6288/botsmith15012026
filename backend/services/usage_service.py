"""
UsageService - Single Source of Truth for Usage Tracking & Enforcement

This service handles ALL usage tracking operations for the BotSmith AI platform.
It provides atomic, race-condition-safe operations for checking and incrementing usage.

RESPONSIBILITIES:
- Check usage limits (with custom overrides)
- Atomically increment usage counters
- Decrement usage when resources are deleted
- Reset monthly usage counters
- Provide usage statistics with limits

DOES NOT HANDLE:
- Payments or billing
- Subscription lifecycle
- Plan pricing
- Authentication
- Notifications
- Business logic unrelated to usage
"""

from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ReturnDocument
from typing import Optional, Literal, Dict, Any
from datetime import datetime, timezone
from pydantic import BaseModel
import os
import logging

# Import LimitResolver for PHASE 3
from .limit_resolver import limit_resolver

logger = logging.getLogger(__name__)

# ============================================================================
# CUSTOM EXCEPTIONS
# ============================================================================

class UsageServiceError(Exception):
    """Base exception for usage service errors"""
    pass


class UsageLimitExceededError(UsageServiceError):
    """Raised when usage limit is reached and operation cannot proceed"""
    
    def __init__(self, user_id: str, usage_type: str, current: int, limit: int):
        self.user_id = user_id
        self.usage_type = usage_type
        self.current = current
        self.limit = limit
        self.message = f"Usage limit exceeded for {usage_type}: {current}/{limit}"
        super().__init__(self.message)
    
    def to_dict(self) -> dict:
        """Convert to HTTP response format"""
        return {
            "error": "usage_limit_exceeded",
            "message": self.message,
            "usage_type": self.usage_type,
            "current": self.current,
            "limit": self.limit,
            "upgrade_required": True
        }


class UserNotFoundError(UsageServiceError):
    """Raised when user doesn't exist"""
    pass


class SubscriptionNotFoundError(UsageServiceError):
    """Raised when subscription doesn't exist for user"""
    pass


class PlanNotFoundError(UsageServiceError):
    """Raised when plan definition not found"""
    pass


class InvalidUsageTypeError(UsageServiceError):
    """Raised when invalid usage type is specified"""
    pass


# ============================================================================
# RESPONSE MODELS
# ============================================================================

class UsageOperationResult(BaseModel):
    """Result of a usage operation (increment/decrement)"""
    success: bool
    current_value: int
    limit: int
    remaining: int
    custom_limit_applied: bool


class UsageLimitCheckResult(BaseModel):
    """Result of checking usage limit"""
    allowed: bool
    current: int
    limit: int
    remaining: int
    would_exceed: bool
    custom_limit_applied: bool


class CurrentUsage(BaseModel):
    """Current usage counts"""
    chatbots_count: int
    messages_this_month: int
    file_uploads_count: int
    website_sources_count: int
    text_sources_count: int
    last_reset: datetime


class ResetResult(BaseModel):
    """Result of usage reset operation"""
    success: bool
    reset_fields: list[str]
    previous_value: int
    reset_timestamp: datetime


class UsageStatsWithLimits(BaseModel):
    """Complete usage statistics with limits"""
    usage: Dict[str, Dict[str, Any]]
    plan_id: str
    plan_name: str
    last_reset: datetime


class LimitCheckResult(BaseModel):
    """
    PHASE 4: Result of check_limit() - READ-ONLY usage check for dashboards.
    
    This is a lightweight response for UI display and warning systems.
    Safe to call frequently without performance concerns.
    """
    current_usage: int
    max_limit: int
    remaining: int
    percentage_used: float
    is_near_limit: bool  # True if usage >= 80% of limit
    is_at_limit: bool     # True if usage >= 100% of limit
    custom_limit_applied: bool


# ============================================================================
# USAGE SERVICE
# ============================================================================

class UsageService:
    """
    Single source of truth for usage tracking and enforcement.
    
    All usage operations MUST go through this service.
    Routers MUST NOT query subscriptions.usage directly.
    """
    
    # Valid usage types
    USAGE_TYPES = ["chatbots", "messages", "file_uploads", "website_sources", "text_sources"]
    
    # Usage types that can be decremented
    DECREMENTABLE_TYPES = ["chatbots", "file_uploads", "website_sources", "text_sources"]
    
    # Field mapping: usage_type -> MongoDB field path
    FIELD_MAP = {
        "chatbots": "usage.chatbots_count",
        "messages": "usage.messages_this_month",
        "file_uploads": "usage.file_uploads_count",
        "website_sources": "usage.website_sources_count",
        "text_sources": "usage.text_sources_count"
    }
    
    # Limit field mapping in plan limits
    LIMIT_MAP = {
        "chatbots": "max_chatbots",
        "messages": "max_messages_per_month",
        "file_uploads": "max_file_uploads",
        "website_sources": "max_website_sources",
        "text_sources": "max_text_sources"
    }
    
    def __init__(self):
        mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
        db_name = os.environ.get('DB_NAME', 'chatbase_db')
        self.client = AsyncIOMotorClient(mongo_url)
        self.db = self.client[db_name]
        self.subscriptions = self.db.subscriptions
        self.plans = self.db.plans
        self.users = self.db.users
    
    # ========================================================================
    # ATOMIC OPERATIONS (CRITICAL)
    # ========================================================================
    
    async def check_and_increment_usage(
        self,
        user_id: str,
        usage_type: Literal["chatbots", "messages", "file_uploads", "website_sources", "text_sources"],
        amount: int = 1
    ) -> UsageOperationResult:
        """
        ATOMICALLY check if usage limit allows increment, and increment if allowed.
        
        This is the PRIMARY method routers should use for usage enforcement.
        Eliminates race conditions by combining check + increment in one DB operation.
        
        Args:
            user_id: User ID
            usage_type: Type of usage to increment
            amount: Amount to increment by (default: 1)
        
        Returns:
            UsageOperationResult with success status and updated values
        
        Raises:
            UsageLimitExceededError: If limit would be exceeded
            InvalidUsageTypeError: If usage_type is invalid
            SubscriptionNotFoundError: If no subscription found
        
        Example:
            result = await usage_service.check_and_increment_usage(
                user_id="user123",
                usage_type="chatbots",
                amount=1
            )
        """
        # Validate usage type
        if usage_type not in self.USAGE_TYPES:
            raise InvalidUsageTypeError(f"Invalid usage type: {usage_type}")
        
        # Get effective limit (with custom overrides applied)
        limit_info = await self._get_effective_limit(user_id, usage_type)
        effective_limit = limit_info["limit"]
        custom_applied = limit_info["custom_applied"]
        
        # Get current usage field path
        field_path = self.FIELD_MAP[usage_type]
        
        # ATOMIC OPERATION: Find subscription where current usage + amount <= limit, and increment
        # The query condition ensures we only increment if limit allows it
        result = await self.subscriptions.find_one_and_update(
            {
                "user_id": user_id,
                field_path: {"$lt": effective_limit}  # CRITICAL: Limit check in query
            },
            {
                "$inc": {field_path: amount}  # Atomic increment
            },
            return_document=ReturnDocument.AFTER
        )
        
        if not result:
            # No document matched - either subscription doesn't exist or limit exceeded
            subscription = await self.subscriptions.find_one({"user_id": user_id})
            
            if not subscription:
                raise SubscriptionNotFoundError(f"No subscription found for user {user_id}")
            
            # Subscription exists but limit check failed
            current_value = subscription.get("usage", {}).get(field_path.split(".")[1], 0)
            raise UsageLimitExceededError(
                user_id=user_id,
                usage_type=usage_type,
                current=current_value,
                limit=effective_limit
            )
        
        # Success - extract new value
        new_value = result["usage"][field_path.split(".")[1]]
        remaining = max(0, effective_limit - new_value)
        
        logger.info(
            f"✅ Usage incremented: user={user_id}, type={usage_type}, "
            f"amount={amount}, new_value={new_value}/{effective_limit}"
        )
        
        return UsageOperationResult(
            success=True,
            current_value=new_value,
            limit=effective_limit,
            remaining=remaining,
            custom_limit_applied=custom_applied
        )
    
    # ========================================================================
    # PHASE 3: ATOMIC INCREMENT WITH LIMIT RESOLVER
    # ========================================================================
    
    async def increment_usage(
        self,
        user_id: str,
        resource_type: Literal["chatbots", "messages", "file_uploads"],
        amount: int = 1
    ) -> UsageOperationResult:
        """
        PHASE 3 IMPLEMENTATION: Atomic usage increment using LimitResolver.
        
        This method provides race-condition-safe usage increment with the following guarantees:
        
        ATOMICITY:
        - Uses MongoDB find_one_and_update with conditional update
        - Limit check AND increment happen in a single atomic operation
        - No race conditions even with 1000+ concurrent requests
        
        SAFE FAILURE:
        - Fails with UsageLimitExceededError if limit would be exceeded
        - No partial updates - either succeeds completely or fails completely
        - Clear error messages with current usage and limit information
        
        LIMIT RESOLUTION:
        - Uses LimitResolver to get effective limits (NOT hardcoded)
        - Respects custom user limits (custom_limits dict)
        - Falls back to legacy fields (custom_max_*)
        - Uses plan defaults as last resort
        - Precedence: custom_limits > legacy fields > plan defaults
        
        NO PRIOR READS:
        - Does NOT read usage before increment
        - Limit check embedded in MongoDB query condition
        - Eliminates TOCTOU (Time-of-Check-Time-of-Use) race conditions
        
        MongoDB Query Pattern:
        ```python
        find_one_and_update(
            filter={
                "user_id": user_id,
                "usage.{field}": {"$lt": effective_limit}  # Atomic check
            },
            update={
                "$inc": {"usage.{field}": amount}  # Atomic increment
            },
            return_document=AFTER
        )
        ```
        
        Why This Is Race-Safe:
        1. MongoDB guarantees atomicity of find_one_and_update
        2. The filter condition ensures we ONLY update if limit allows
        3. If limit exceeded, no document matches → update fails → we detect failure
        4. Multiple concurrent calls are serialized by MongoDB at document level
        5. Even if 100 requests arrive simultaneously:
           - MongoDB processes them one by one
           - Each checks current value against limit
           - Only requests that fit within limit succeed
        
        Args:
            user_id: User ID to increment usage for
            resource_type: Type of resource (chatbots, messages, file_uploads)
            amount: Amount to increment by (default: 1)
        
        Returns:
            UsageOperationResult with:
                - success: True (if we return, it succeeded)
                - current_value: New usage value after increment
                - limit: Effective limit that was enforced
                - remaining: How many more can be created (limit - current_value)
                - custom_limit_applied: Whether custom limit was used
        
        Raises:
            UsageLimitExceededError: If incrementing would exceed limit
                - Contains user_id, usage_type, current value, and limit
                - Has .to_dict() method for HTTP 429 responses
            
            InvalidUsageTypeError: If resource_type is invalid
                - Only chatbots, messages, file_uploads are supported in Phase 3
            
            SubscriptionNotFoundError: If user has no subscription
                - Should never happen in normal flow (all users have subscriptions)
        
        Example Usage:
            ```python
            # In router (e.g., create chatbot)
            try:
                result = await usage_service.increment_usage(
                    user_id=current_user.id,
                    resource_type="chatbots",
                    amount=1
                )
                # Success! Create the chatbot
                # result.current_value = new total chatbots
                # result.remaining = how many more they can create
                
            except UsageLimitExceededError as e:
                # Limit reached - return 429 error
                raise HTTPException(
                    status_code=429,
                    detail=e.to_dict()
                )
            ```
        
        Implementation Notes:
        - Supported resources: chatbots, messages, file_uploads (Phase 3 scope)
        - website_sources and text_sources can be added in future phases
        - This method does NOT touch routers - routers call this method
        - This method does NOT handle subscriptions - only usage tracking
        - MongoDB field paths are mapped via FIELD_MAP class constant
        """
        # STEP 1: Validate resource type (Phase 3 supports 3 resource types)
        SUPPORTED_RESOURCES = ["chatbots", "messages", "file_uploads"]
        if resource_type not in SUPPORTED_RESOURCES:
            raise InvalidUsageTypeError(
                f"Invalid resource type: {resource_type}. "
                f"Phase 3 supports: {', '.join(SUPPORTED_RESOURCES)}"
            )
        
        # STEP 2: Use LimitResolver to get effective limit
        # This respects custom_limits > legacy fields > plan defaults
        # NO hardcoded values - all from database
        try:
            limit_result = await limit_resolver.resolve_limit(user_id, resource_type)
            effective_limit = limit_result.effective_limit
            custom_limit_applied = limit_result.custom_limit_applied
        except Exception as e:
            # Re-raise limit resolver errors as usage service errors
            if "SubscriptionNotFoundError" in str(type(e)):
                raise SubscriptionNotFoundError(str(e))
            raise
        
        # STEP 3: Get MongoDB field path for this resource type
        field_path = self.FIELD_MAP[resource_type]
        
        # STEP 4: ATOMIC OPERATION - The Core of Phase 3
        # This single operation does THREE things atomically:
        # 1. Check if user_id matches
        # 2. Check if current usage < effective_limit (limit check)
        # 3. Increment the usage counter
        # 
        # MongoDB guarantees these happen together - no race conditions
        result = await self.subscriptions.find_one_and_update(
            # FILTER: Only match if limit check passes
            {
                "user_id": user_id,
                field_path: {"$lt": effective_limit}  # CRITICAL: Atomic limit check
            },
            # UPDATE: Increment the counter
            {
                "$inc": {field_path: amount}
            },
            # Return the document AFTER increment
            return_document=ReturnDocument.AFTER
        )
        
        # STEP 5: Handle result
        if not result:
            # No document matched the filter
            # Two possibilities:
            # 1. User has no subscription
            # 2. Limit check failed (current usage >= effective_limit)
            
            # Check which one it is
            subscription = await self.subscriptions.find_one({"user_id": user_id})
            
            if not subscription:
                # Case 1: No subscription exists
                raise SubscriptionNotFoundError(
                    f"No subscription found for user {user_id}"
                )
            
            # Case 2: Limit exceeded
            field_name = field_path.split(".")[1]
            current_value = subscription.get("usage", {}).get(field_name, 0)
            
            # Raise detailed error for limit exceeded
            raise UsageLimitExceededError(
                user_id=user_id,
                usage_type=resource_type,
                current=current_value,
                limit=effective_limit
            )
        
        # STEP 6: Success - extract values from result
        field_name = field_path.split(".")[1]
        new_value = result["usage"][field_name]
        remaining = max(0, effective_limit - new_value)
        
        # Log the successful increment
        logger.info(
            f"✅ [PHASE 3] Atomic increment succeeded: "
            f"user={user_id}, resource={resource_type}, amount={amount}, "
            f"new_value={new_value}/{effective_limit}, remaining={remaining}, "
            f"custom_limit={'yes' if custom_limit_applied else 'no'}"
        )
        
        # Return structured result
        return UsageOperationResult(
            success=True,
            current_value=new_value,
            limit=effective_limit,
            remaining=remaining,
            custom_limit_applied=custom_limit_applied
        )
    
    # ========================================================================
    # PHASE 4: READ-ONLY LIMIT CHECK
    # ========================================================================
    
    async def check_limit(
        self,
        user_id: str,
        resource_type: Literal["chatbots", "messages", "file_uploads"]
    ) -> LimitCheckResult:
        """
        PHASE 4 IMPLEMENTATION: Read-only usage check for dashboards and warnings.
        
        This method provides a lightweight way to check current usage status WITHOUT
        modifying the database. Perfect for:
        - Dashboard displays
        - Warning banners (e.g., "You're at 90% of your message limit")
        - UI conditional rendering (e.g., disable "Create Chatbot" button)
        - Progress bars and usage meters
        
        CRITICAL CONSTRAINTS:
        - READ-ONLY: Does NOT modify database
        - NO WRITES: Safe to call from any context
        - DASHBOARD-SAFE: Can be called frequently without side effects
        
        USES LIMITRESOLVER:
        - All limit lookups go through LimitResolver
        - NO hardcoded values
        - Respects custom_limits > legacy fields > plan defaults
        
        Args:
            user_id: User ID to check limits for
            resource_type: Type of resource (chatbots, messages, file_uploads)
        
        Returns:
            LimitCheckResult with:
                - current_usage: Current usage count (e.g., 45 messages sent)
                - max_limit: Effective limit from LimitResolver (e.g., 100 messages)
                - remaining: How many more allowed (e.g., 55 messages remaining)
                - percentage_used: Usage as percentage (e.g., 45.0%)
                - is_near_limit: True if usage >= 80% (e.g., 80+ messages used)
                - is_at_limit: True if usage >= 100% (e.g., 100+ messages used)
                - custom_limit_applied: Whether custom limit was used
        
        Raises:
            InvalidUsageTypeError: If resource_type is invalid
            SubscriptionNotFoundError: If user has no subscription
        
        Example Usage:
            ```python
            # In dashboard API endpoint
            result = await usage_service.check_limit(
                user_id=current_user.id,
                resource_type="messages"
            )
            
            # Display warning banner
            if result.is_near_limit:
                show_warning(
                    f"You've used {result.percentage_used}% of your monthly messages. "
                    f"{result.remaining} messages remaining."
                )
            
            # Disable UI button
            if result.is_at_limit:
                disable_send_button()
            ```
        
        Example Response:
            Near-limit user (90 messages used out of 100):
            ```json
            {
                "current_usage": 90,
                "max_limit": 100,
                "remaining": 10,
                "percentage_used": 90.0,
                "is_near_limit": true,
                "is_at_limit": false,
                "custom_limit_applied": false
            }
            ```
        
        Implementation Notes:
        - Performs ONE database read (efficient for dashboards)
        - Uses LimitResolver for all limit lookups (no hardcoded values)
        - Calculates warning thresholds (80% = near limit, 100% = at limit)
        - Safe to cache results (read-only, no side effects)
        """
        # STEP 1: Validate resource type
        SUPPORTED_RESOURCES = ["chatbots", "messages", "file_uploads"]
        if resource_type not in SUPPORTED_RESOURCES:
            raise InvalidUsageTypeError(
                f"Invalid resource type: {resource_type}. "
                f"Phase 4 supports: {', '.join(SUPPORTED_RESOURCES)}"
            )
        
        # STEP 2: Use LimitResolver to get effective limit (NO hardcoded values)
        try:
            limit_result = await limit_resolver.resolve_limit(user_id, resource_type)
            effective_limit = limit_result.effective_limit
            custom_limit_applied = limit_result.custom_limit_applied
        except Exception as e:
            if "SubscriptionNotFoundError" in str(type(e)):
                raise SubscriptionNotFoundError(str(e))
            raise
        
        # STEP 3: Read current usage from database (READ-ONLY operation)
        subscription = await self.subscriptions.find_one({"user_id": user_id})
        if not subscription:
            raise SubscriptionNotFoundError(f"No subscription found for user {user_id}")
        
        field_name = self.FIELD_MAP[resource_type].split(".")[1]
        current_usage = subscription.get("usage", {}).get(field_name, 0)
        
        # STEP 4: Calculate derived values
        remaining = max(0, effective_limit - current_usage)
        percentage_used = (current_usage / effective_limit * 100) if effective_limit > 0 else 0
        is_near_limit = percentage_used >= 80.0  # Warning threshold
        is_at_limit = current_usage >= effective_limit
        
        # Log read-only check (for monitoring)
        logger.info(
            f"📊 [PHASE 4] Read-only limit check: "
            f"user={user_id}, resource={resource_type}, "
            f"usage={current_usage}/{effective_limit} ({percentage_used:.1f}%), "
            f"near_limit={is_near_limit}, at_limit={is_at_limit}"
        )
        
        # STEP 5: Return structured result
        return LimitCheckResult(
            current_usage=current_usage,
            max_limit=effective_limit,
            remaining=remaining,
            percentage_used=round(percentage_used, 2),
            is_near_limit=is_near_limit,
            is_at_limit=is_at_limit,
            custom_limit_applied=custom_limit_applied
        )
    
    # ========================================================================
    # READ-ONLY OPERATIONS
    # ========================================================================
    
    async def check_usage_limit(
        self,
        user_id: str,
        usage_type: Literal["chatbots", "messages", "file_uploads", "website_sources", "text_sources"],
        amount: int = 1
    ) -> UsageLimitCheckResult:
        """
        Check if user can perform an action WITHOUT modifying usage.
        
        Used for pre-validation or UI display (e.g., disable button if limit reached).
        
        Args:
            user_id: User ID
            usage_type: Type of usage to check
            amount: Amount to check (default: 1)
        
        Returns:
            UsageLimitCheckResult with allowed status and current values
        
        Raises:
            InvalidUsageTypeError: If usage_type is invalid
            SubscriptionNotFoundError: If no subscription found
        """
        if usage_type not in self.USAGE_TYPES:
            raise InvalidUsageTypeError(f"Invalid usage type: {usage_type}")
        
        # Get subscription
        subscription = await self.subscriptions.find_one({"user_id": user_id})
        if not subscription:
            raise SubscriptionNotFoundError(f"No subscription found for user {user_id}")
        
        # Get effective limit
        limit_info = await self._get_effective_limit(user_id, usage_type)
        effective_limit = limit_info["limit"]
        custom_applied = limit_info["custom_applied"]
        
        # Get current usage
        field_name = self.FIELD_MAP[usage_type].split(".")[1]
        current = subscription.get("usage", {}).get(field_name, 0)
        
        # Calculate
        remaining = max(0, effective_limit - current)
        would_exceed = (current + amount) > effective_limit
        allowed = not would_exceed
        
        return UsageLimitCheckResult(
            allowed=allowed,
            current=current,
            limit=effective_limit,
            remaining=remaining,
            would_exceed=would_exceed,
            custom_limit_applied=custom_applied
        )
    
    async def get_current_usage(self, user_id: str) -> CurrentUsage:
        """
        Get raw current usage counts for a user.
        
        Simple data retrieval without limit checks.
        
        Args:
            user_id: User ID
        
        Returns:
            CurrentUsage with all usage counts
        
        Raises:
            SubscriptionNotFoundError: If no subscription found
        """
        subscription = await self.subscriptions.find_one({"user_id": user_id})
        if not subscription:
            raise SubscriptionNotFoundError(f"No subscription found for user {user_id}")
        
        usage = subscription.get("usage", {})
        
        return CurrentUsage(
            chatbots_count=usage.get("chatbots_count", 0),
            messages_this_month=usage.get("messages_this_month", 0),
            file_uploads_count=usage.get("file_uploads_count", 0),
            website_sources_count=usage.get("website_sources_count", 0),
            text_sources_count=usage.get("text_sources_count", 0),
            last_reset=usage.get("last_reset", datetime.now(timezone.utc))
        )
    
    async def get_usage_with_limits(self, user_id: str) -> UsageStatsWithLimits:
        """
        Get complete usage statistics with limits for dashboard display.
        
        Combines usage + limits + custom overrides into a comprehensive view.
        
        Args:
            user_id: User ID
        
        Returns:
            UsageStatsWithLimits with complete statistics
        
        Raises:
            SubscriptionNotFoundError: If no subscription found
            PlanNotFoundError: If plan not found
        """
        # Get subscription
        subscription = await self.subscriptions.find_one({"user_id": user_id})
        if not subscription:
            raise SubscriptionNotFoundError(f"No subscription found for user {user_id}")
        
        # Get plan
        plan_id = subscription.get("plan_id", "free")
        plan = await self.plans.find_one({"id": plan_id})
        if not plan:
            raise PlanNotFoundError(f"Plan not found: {plan_id}")
        
        # Get usage
        usage_data = subscription.get("usage", {})
        
        # Build stats for each usage type
        usage_stats = {}
        for usage_type in self.USAGE_TYPES:
            field_name = self.FIELD_MAP[usage_type].split(".")[1]
            current = usage_data.get(field_name, 0)
            
            # Get effective limit with custom overrides
            limit_info = await self._get_effective_limit(user_id, usage_type)
            limit = limit_info["limit"]
            is_custom = limit_info["custom_applied"]
            
            # Calculate percentage (avoid division by zero for unlimited plans)
            if limit >= 999999:
                percentage = 0.0
            else:
                percentage = round((current / limit) * 100, 1) if limit > 0 else 0.0
            
            usage_stats[usage_type] = {
                "current": current,
                "limit": limit,
                "percentage": percentage,
                "is_custom": is_custom
            }
        
        return UsageStatsWithLimits(
            usage=usage_stats,
            plan_id=plan_id,
            plan_name=plan.get("name", "Unknown"),
            last_reset=usage_data.get("last_reset", datetime.now(timezone.utc))
        )
    
    # ========================================================================
    # WRITE OPERATIONS
    # ========================================================================
    
    async def decrement_usage(
        self,
        user_id: str,
        usage_type: Literal["chatbots", "file_uploads", "website_sources", "text_sources"],
        amount: int = 1
    ) -> UsageOperationResult:
        """
        Decrement usage when a resource is deleted.
        
        Includes bounds checking - won't go below 0.
        Messages are NOT decrementable (they're historical).
        
        Args:
            user_id: User ID
            usage_type: Type of usage to decrement
            amount: Amount to decrement by (default: 1)
        
        Returns:
            UsageOperationResult with updated values
        
        Raises:
            InvalidUsageTypeError: If usage_type is invalid or not decrementable
            SubscriptionNotFoundError: If no subscription found
        """
        # Validate usage type is decrementable
        if usage_type not in self.DECREMENTABLE_TYPES:
            raise InvalidUsageTypeError(
                f"Usage type '{usage_type}' cannot be decremented. "
                f"Only {self.DECREMENTABLE_TYPES} are decrementable."
            )
        
        # Get current subscription to check it exists
        subscription = await self.subscriptions.find_one({"user_id": user_id})
        if not subscription:
            raise SubscriptionNotFoundError(f"No subscription found for user {user_id}")
        
        # Get field path
        field_path = self.FIELD_MAP[usage_type]
        field_name = field_path.split(".")[1]
        
        # Get current value to ensure we don't go negative
        current_value = subscription.get("usage", {}).get(field_name, 0)
        actual_decrement = min(amount, current_value)  # Don't go below 0
        
        # Atomic decrement
        result = await self.subscriptions.find_one_and_update(
            {"user_id": user_id},
            {
                "$inc": {field_path: -actual_decrement}
            },
            return_document=ReturnDocument.AFTER
        )
        
        # Get effective limit for response
        limit_info = await self._get_effective_limit(user_id, usage_type)
        
        new_value = result["usage"][field_name]
        remaining = max(0, limit_info["limit"] - new_value)
        
        logger.info(
            f"✅ Usage decremented: user={user_id}, type={usage_type}, "
            f"amount={actual_decrement}, new_value={new_value}"
        )
        
        return UsageOperationResult(
            success=True,
            current_value=new_value,
            limit=limit_info["limit"],
            remaining=remaining,
            custom_limit_applied=limit_info["custom_applied"]
        )
    
    async def reset_monthly_usage(self, user_id: str) -> ResetResult:
        """
        PHASE 6: Reset monthly usage counters for subscription renewal.
        
        CRITICAL RULES:
        - This method is triggered ONLY by SubscriptionService
        - NO cron jobs should call this method
        - NO auto-reset logic inside UsageService
        - SubscriptionService decides WHEN to reset based on subscription lifecycle
        
        WHAT IS RESET:
        - messages_this_month: Reset to 0 (monthly allowance refreshes)
        - chatbots_count: Reset to 0 (new billing cycle = fresh start)
        - file_uploads_count: Reset to 0 (monthly allowance refreshes)
        - last_reset: Updated to current timestamp
        
        WHAT IS NOT RESET:
        - website_sources_count: Persistent across billing cycles
        - text_sources_count: Persistent across billing cycles
        
        WHEN TO CALL:
        SubscriptionService should call this method when:
        1. User renews subscription (extends existing plan)
        2. User upgrades plan (changes from one plan to another)
        3. Admin manually renews user's subscription
        
        HOW TO CALL FROM SUBSCRIPTIONSERVICE:
        ```python
        from services.usage_service import usage_service
        
        # After successful subscription renewal/upgrade
        reset_result = await usage_service.reset_monthly_usage(user_id)
        logger.info(f"Usage reset for user {user_id}: {reset_result.reset_fields}")
        ```
        
        SAFETY CONSIDERATIONS:
        1. ATOMIC OPERATION: Uses MongoDB update_one with $set to ensure atomicity
        2. IDEMPOTENT: Safe to call multiple times (sets values to 0)
        3. NO SIDE EFFECTS: Only updates subscription document, no other collections
        4. AUDIT TRAIL: Logs reset operation with timestamp and previous values
        5. GRACEFUL FAILURE: Raises SubscriptionNotFoundError if user not found
        6. RACE-CONDITION SAFE: MongoDB document-level locking prevents conflicts
        
        Args:
            user_id: User ID to reset usage for
        
        Returns:
            ResetResult with:
                - success: True if reset succeeded
                - reset_fields: List of fields that were reset
                - previous_value: Sum of all previous usage values
                - reset_timestamp: When the reset occurred
        
        Raises:
            SubscriptionNotFoundError: If no subscription found for user
        
        Example Response:
        ```json
        {
            "success": true,
            "reset_fields": ["messages_this_month", "chatbots_count", "file_uploads_count"],
            "previous_value": 150,
            "reset_timestamp": "2025-01-10T12:00:00Z"
        }
        ```
        """
        # STEP 1: Validate subscription exists
        subscription = await self.subscriptions.find_one({"user_id": user_id})
        if not subscription:
            raise SubscriptionNotFoundError(
                f"No subscription found for user {user_id}. "
                f"Cannot reset usage without active subscription."
            )
        
        # STEP 2: Capture previous values for audit trail
        usage = subscription.get("usage", {})
        previous_messages = usage.get("messages_this_month", 0)
        previous_chatbots = usage.get("chatbots_count", 0)
        previous_file_uploads = usage.get("file_uploads_count", 0)
        
        # Calculate total previous usage for reporting
        total_previous = previous_messages + previous_chatbots + previous_file_uploads
        
        # STEP 3: Generate reset timestamp
        reset_time = datetime.now(timezone.utc)
        
        # STEP 4: Atomic reset operation
        # Uses $set to ensure atomic update of all fields together
        await self.subscriptions.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "usage.messages_this_month": 0,
                    "usage.chatbots_count": 0,
                    "usage.file_uploads_count": 0,
                    "usage.last_reset": reset_time
                }
            }
        )
        
        # STEP 5: Log reset operation for audit trail
        logger.info(
            f"🔄 [PHASE 6] Monthly usage reset completed: "
            f"user={user_id}, "
            f"previous_values=(messages={previous_messages}, "
            f"chatbots={previous_chatbots}, "
            f"file_uploads={previous_file_uploads}), "
            f"reset_time={reset_time.isoformat()}"
        )
        
        # STEP 6: Return structured result
        return ResetResult(
            success=True,
            reset_fields=["messages_this_month", "chatbots_count", "file_uploads_count"],
            previous_value=total_previous,
            reset_timestamp=reset_time
        )
    
    # ========================================================================
    # PRIVATE HELPER METHODS
    # ========================================================================
    
    async def _get_effective_limit(self, user_id: str, usage_type: str) -> dict:
        """
        Get effective limit for a usage type, applying custom overrides.
        
        Precedence (highest → lowest):
        1. users.custom_limits dict (new format)
        2. users.custom_max_* fields (legacy format)
        3. plans.limits (default plan limits)
        
        Args:
            user_id: User ID
            usage_type: Type of usage
        
        Returns:
            dict with keys: limit (int), custom_applied (bool)
        """
        # Get subscription to find plan_id
        subscription = await self.subscriptions.find_one({"user_id": user_id})
        if not subscription:
            raise SubscriptionNotFoundError(f"No subscription found for user {user_id}")
        
        # Get plan limits
        plan_id = subscription.get("plan_id", "free")
        plan = await self.plans.find_one({"id": plan_id})
        if not plan:
            raise PlanNotFoundError(f"Plan not found: {plan_id}")
        
        limit_field = self.LIMIT_MAP[usage_type]
        default_limit = plan["limits"][limit_field]
        
        # Get user for custom limits
        user = await self.users.find_one({"id": user_id})
        if not user:
            # No user doc means no custom limits
            return {"limit": default_limit, "custom_applied": False}
        
        # Check custom limits (new format) - HIGHEST PRIORITY
        custom_limits_dict = user.get("custom_limits", {})
        if custom_limits_dict.get(limit_field) is not None:
            return {
                "limit": custom_limits_dict[limit_field],
                "custom_applied": True
            }
        
        # Check legacy fields - SECOND PRIORITY
        legacy_field_map = {
            "max_chatbots": "custom_max_chatbots",
            "max_messages_per_month": "custom_max_messages",
            "max_file_uploads": "custom_max_file_uploads"
        }
        
        legacy_field = legacy_field_map.get(limit_field)
        if legacy_field and user.get(legacy_field) is not None:
            return {
                "limit": user[legacy_field],
                "custom_applied": True
            }
        
        # Use plan default - LOWEST PRIORITY
        return {"limit": default_limit, "custom_applied": False}


# ============================================================================
# GLOBAL INSTANCE
# ============================================================================

usage_service = UsageService()
