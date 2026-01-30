"""
LimitResolver - Centralized Limit Resolution Service

PHASE 2: LIMIT RESOLUTION (ISOLATED)

This service is the single source of truth for determining effective limits for resources.
It implements a clear precedence hierarchy and supports both new and legacy custom limit formats.

RESPONSIBILITIES:
- Resolve effective limits for all resource types
- Apply custom user limits when they exist
- Support legacy field formats for backward compatibility
- Provide clear precedence rules
- Clean separation from usage tracking and enforcement

DOES NOT HANDLE:
- Usage tracking or increment/decrement operations
- Subscription management
- Database writes of any kind
- Authentication or authorization
- Business logic beyond limit resolution

RESOLUTION PRECEDENCE (Highest → Lowest):
1. Custom user limits (users.custom_limits dict) - NEW FORMAT
2. Legacy user limits (users.custom_max_* fields) - LEGACY FORMAT
3. Plan default limits (plans.limits) - DEFAULT

DESIGN PRINCIPLES:
- No hardcoded values
- No logic in routers (service layer only)
- Read-only operations
- Clear error handling
- Type safety with explicit models
"""

from motor.motor_asyncio import AsyncIOMotorClient
from typing import Optional, Literal, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime
import os
import logging

logger = logging.getLogger(__name__)

# ============================================================================
# CUSTOM EXCEPTIONS
# ============================================================================

class LimitResolverError(Exception):
    """Base exception for limit resolver errors"""
    pass


class UserNotFoundError(LimitResolverError):
    """Raised when user doesn't exist"""
    pass


class SubscriptionNotFoundError(LimitResolverError):
    """Raised when subscription doesn't exist"""
    pass


class PlanNotFoundError(LimitResolverError):
    """Raised when plan doesn't exist"""
    pass


class InvalidResourceTypeError(LimitResolverError):
    """Raised when invalid resource type is provided"""
    pass


# ============================================================================
# RESPONSE MODELS
# ============================================================================

class LimitResolutionResult(BaseModel):
    """
    Result of limit resolution for a single resource type.
    
    This model represents the effective limit after applying all precedence rules.
    """
    resource_type: str = Field(description="Type of resource (chatbots, messages, etc)")
    effective_limit: int = Field(description="The resolved limit value to enforce")
    plan_limit: int = Field(description="Default limit from plan")
    custom_limit_applied: bool = Field(description="Whether a custom limit overrode the plan limit")
    custom_limit_source: Optional[str] = Field(
        default=None,
        description="Source of custom limit: 'custom_limits_dict' or 'legacy_field' or None"
    )
    custom_limit_value: Optional[int] = Field(
        default=None,
        description="The custom limit value if applied"
    )
    plan_id: str = Field(description="Plan ID this limit is based on")
    plan_name: str = Field(description="Human-readable plan name")
    
    class Config:
        json_schema_extra = {
            "example": {
                "resource_type": "chatbots",
                "effective_limit": 10,
                "plan_limit": 5,
                "custom_limit_applied": True,
                "custom_limit_source": "custom_limits_dict",
                "custom_limit_value": 10,
                "plan_id": "starter",
                "plan_name": "Starter"
            }
        }


class BulkLimitResolution(BaseModel):
    """
    Bulk resolution result for all resource types.
    
    Useful for dashboard display or comprehensive limit checks.
    """
    user_id: str = Field(description="User ID")
    plan_id: str = Field(description="Current plan ID")
    plan_name: str = Field(description="Current plan name")
    limits: Dict[str, LimitResolutionResult] = Field(
        description="Resolved limits for each resource type"
    )
    resolved_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="When these limits were resolved"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "user_id": "user123",
                "plan_id": "starter",
                "plan_name": "Starter",
                "limits": {
                    "chatbots": {
                        "resource_type": "chatbots",
                        "effective_limit": 10,
                        "plan_limit": 5,
                        "custom_limit_applied": True,
                        "custom_limit_source": "custom_limits_dict",
                        "custom_limit_value": 10,
                        "plan_id": "starter",
                        "plan_name": "Starter"
                    }
                },
                "resolved_at": "2025-01-02T12:00:00Z"
            }
        }


# ============================================================================
# LIMIT RESOLVER SERVICE
# ============================================================================

class LimitResolver:
    """
    Centralized service for resolving effective limits.
    
    This service determines what limits apply to a user for each resource type,
    considering custom overrides and legacy fields.
    
    THREAD-SAFE: All operations are read-only and can be called concurrently.
    """
    
    # Valid resource types
    RESOURCE_TYPES = [
        "chatbots",
        "messages",
        "file_uploads",
        "website_sources",
        "text_sources"
    ]
    
    # Mapping: resource_type -> plan limit field name
    PLAN_LIMIT_FIELD_MAP = {
        "chatbots": "max_chatbots",
        "messages": "max_messages_per_month",
        "file_uploads": "max_file_uploads",
        "website_sources": "max_website_sources",
        "text_sources": "max_text_sources"
    }
    
    # Mapping: plan limit field -> legacy user field name (if exists)
    LEGACY_FIELD_MAP = {
        "max_chatbots": "custom_max_chatbots",
        "max_messages_per_month": "custom_max_messages",
        "max_file_uploads": "custom_max_file_uploads",
        # Note: website_sources and text_sources don't have legacy fields
    }
    
    def __init__(self):
        """Initialize LimitResolver with database connection."""
        mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
        db_name = os.environ.get('DB_NAME', 'chatbase_db')
        self.client = AsyncIOMotorClient(mongo_url)
        self.db = self.client[db_name]
        self.subscriptions = self.db.subscriptions
        self.plans = self.db.plans
        self.users = self.db.users
    
    # ========================================================================
    # PUBLIC API
    # ========================================================================
    
    async def resolve_limit(
        self,
        user_id: str,
        resource_type: Literal["chatbots", "messages", "file_uploads", "website_sources", "text_sources"]
    ) -> LimitResolutionResult:
        """
        Resolve the effective limit for a specific resource type.
        
        This is the PRIMARY method for limit resolution.
        
        Resolution Precedence:
        1. Check users.custom_limits dict for resource type
        2. Check users.custom_max_* legacy fields
        3. Use plan default limit
        
        Args:
            user_id: User ID to resolve limits for
            resource_type: Type of resource to check
        
        Returns:
            LimitResolutionResult with effective limit and metadata
        
        Raises:
            InvalidResourceTypeError: If resource_type is invalid
            SubscriptionNotFoundError: If user has no subscription
            PlanNotFoundError: If plan doesn't exist
            UserNotFoundError: If user doesn't exist (only when checking custom limits)
        
        Example:
            >>> result = await limit_resolver.resolve_limit("user123", "chatbots")
            >>> print(f"Effective limit: {result.effective_limit}")
            >>> if result.custom_limit_applied:
            >>>     print(f"Custom limit from: {result.custom_limit_source}")
        """
        # Validate resource type
        if resource_type not in self.RESOURCE_TYPES:
            raise InvalidResourceTypeError(
                f"Invalid resource type: {resource_type}. "
                f"Valid types: {', '.join(self.RESOURCE_TYPES)}"
            )
        
        # Get subscription to find plan_id
        subscription = await self.subscriptions.find_one({"user_id": user_id})
        if not subscription:
            raise SubscriptionNotFoundError(
                f"No subscription found for user {user_id}"
            )
        
        # Get plan
        plan_id = subscription.get("plan_id", "free")
        plan = await self.plans.find_one({"id": plan_id})
        if not plan:
            raise PlanNotFoundError(f"Plan not found: {plan_id}")
        
        # Get plan limit
        limit_field = self.PLAN_LIMIT_FIELD_MAP[resource_type]
        plan_limit = plan["limits"][limit_field]
        
        # Initialize result with plan defaults
        result = LimitResolutionResult(
            resource_type=resource_type,
            effective_limit=plan_limit,
            plan_limit=plan_limit,
            custom_limit_applied=False,
            custom_limit_source=None,
            custom_limit_value=None,
            plan_id=plan_id,
            plan_name=plan.get("name", "Unknown")
        )
        
        # Get user document to check for custom limits
        user = await self.users.find_one({"id": user_id})
        if not user:
            # User doesn't exist or has no custom limits - use plan default
            logger.debug(
                f"No user document found for {user_id}, using plan limit: {plan_limit}"
            )
            return result
        
        # PRECEDENCE 1: Check custom_limits dict (NEW FORMAT) - HIGHEST PRIORITY
        custom_limits_dict = user.get("custom_limits", {})
        if custom_limits_dict.get(limit_field) is not None:
            custom_value = custom_limits_dict[limit_field]
            result.effective_limit = custom_value
            result.custom_limit_applied = True
            result.custom_limit_source = "custom_limits_dict"
            result.custom_limit_value = custom_value
            
            logger.info(
                f"✓ Custom limit applied (dict): user={user_id}, "
                f"resource={resource_type}, custom={custom_value}, plan={plan_limit}"
            )
            return result
        
        # PRECEDENCE 2: Check legacy fields (LEGACY FORMAT) - SECOND PRIORITY
        legacy_field = self.LEGACY_FIELD_MAP.get(limit_field)
        if legacy_field and user.get(legacy_field) is not None:
            custom_value = user[legacy_field]
            result.effective_limit = custom_value
            result.custom_limit_applied = True
            result.custom_limit_source = "legacy_field"
            result.custom_limit_value = custom_value
            
            logger.info(
                f"✓ Custom limit applied (legacy): user={user_id}, "
                f"resource={resource_type}, custom={custom_value}, plan={plan_limit}"
            )
            return result
        
        # PRECEDENCE 3: Use plan default (LOWEST PRIORITY)
        logger.debug(
            f"Using plan default limit: user={user_id}, "
            f"resource={resource_type}, limit={plan_limit}"
        )
        return result
    
    async def resolve_all_limits(self, user_id: str) -> BulkLimitResolution:
        """
        Resolve effective limits for ALL resource types at once.
        
        Useful for:
        - Dashboard display
        - Comprehensive limit checks
        - Admin panels
        - Subscription pages
        
        Args:
            user_id: User ID to resolve limits for
        
        Returns:
            BulkLimitResolution with all resource limits
        
        Raises:
            SubscriptionNotFoundError: If user has no subscription
            PlanNotFoundError: If plan doesn't exist
        
        Example:
            >>> bulk = await limit_resolver.resolve_all_limits("user123")
            >>> for resource_type, limit_result in bulk.limits.items():
            >>>     print(f"{resource_type}: {limit_result.effective_limit}")
        """
        # Get subscription for plan info
        subscription = await self.subscriptions.find_one({"user_id": user_id})
        if not subscription:
            raise SubscriptionNotFoundError(
                f"No subscription found for user {user_id}"
            )
        
        plan_id = subscription.get("plan_id", "free")
        plan = await self.plans.find_one({"id": plan_id})
        if not plan:
            raise PlanNotFoundError(f"Plan not found: {plan_id}")
        
        # Resolve limits for each resource type
        limits = {}
        for resource_type in self.RESOURCE_TYPES:
            try:
                limit_result = await self.resolve_limit(user_id, resource_type)
                limits[resource_type] = limit_result
            except Exception as e:
                logger.error(
                    f"Error resolving limit for {resource_type}: {str(e)}"
                )
                # Continue with other resource types
                continue
        
        return BulkLimitResolution(
            user_id=user_id,
            plan_id=plan_id,
            plan_name=plan.get("name", "Unknown"),
            limits=limits,
            resolved_at=datetime.utcnow()
        )
    
    async def get_limit_with_usage(
        self,
        user_id: str,
        resource_type: Literal["chatbots", "messages", "file_uploads", "website_sources", "text_sources"]
    ) -> Dict[str, Any]:
        """
        Get resolved limit along with current usage for a resource type.
        
        This combines limit resolution with usage data for complete context.
        
        Args:
            user_id: User ID
            resource_type: Type of resource
        
        Returns:
            Dict with keys: limit_info, current_usage, remaining, percentage_used
        
        Raises:
            InvalidResourceTypeError: If resource_type is invalid
            SubscriptionNotFoundError: If user has no subscription
        
        Example:
            >>> info = await limit_resolver.get_limit_with_usage("user123", "chatbots")
            >>> print(f"Used {info['current_usage']}/{info['limit_info']['effective_limit']}")
            >>> print(f"Remaining: {info['remaining']}")
        """
        # Resolve limit
        limit_result = await self.resolve_limit(user_id, resource_type)
        
        # Get current usage from subscription
        subscription = await self.subscriptions.find_one({"user_id": user_id})
        if not subscription:
            raise SubscriptionNotFoundError(
                f"No subscription found for user {user_id}"
            )
        
        # Map resource type to usage field
        usage_field_map = {
            "chatbots": "chatbots_count",
            "messages": "messages_this_month",
            "file_uploads": "file_uploads_count",
            "website_sources": "website_sources_count",
            "text_sources": "text_sources_count"
        }
        
        usage_field = usage_field_map[resource_type]
        current_usage = subscription.get("usage", {}).get(usage_field, 0)
        
        # Calculate remaining and percentage
        remaining = max(0, limit_result.effective_limit - current_usage)
        
        # Avoid division by zero for unlimited plans (999999+)
        if limit_result.effective_limit >= 999999:
            percentage_used = 0.0
        else:
            percentage_used = round(
                (current_usage / limit_result.effective_limit) * 100, 1
            ) if limit_result.effective_limit > 0 else 0.0
        
        return {
            "limit_info": limit_result.model_dump(),
            "current_usage": current_usage,
            "remaining": remaining,
            "percentage_used": percentage_used,
            "is_at_limit": current_usage >= limit_result.effective_limit
        }
    
    # ========================================================================
    # VALIDATION & UTILITY METHODS
    # ========================================================================
    
    async def validate_user_limits(self, user_id: str) -> Dict[str, Any]:
        """
        Validate that all user's custom limits are properly configured.
        
        Useful for:
        - Admin panel validation
        - Data integrity checks
        - Migration verification
        
        Args:
            user_id: User ID to validate
        
        Returns:
            Dict with validation results and warnings
        
        Example:
            >>> validation = await limit_resolver.validate_user_limits("user123")
            >>> if validation['has_warnings']:
            >>>     print("Warnings:", validation['warnings'])
        """
        user = await self.users.find_one({"id": user_id})
        subscription = await self.subscriptions.find_one({"user_id": user_id})
        
        if not subscription:
            return {
                "valid": False,
                "error": "No subscription found",
                "has_warnings": False,
                "warnings": []
            }
        
        warnings = []
        
        # Check if user has both new and legacy custom limits
        if user:
            has_new_format = bool(user.get("custom_limits", {}))
            has_legacy_format = any(
                user.get(field) is not None
                for field in self.LEGACY_FIELD_MAP.values()
            )
            
            if has_new_format and has_legacy_format:
                warnings.append(
                    "User has both custom_limits dict and legacy custom_max_* fields. "
                    "custom_limits dict will take precedence."
                )
            
            # Check for negative limits
            custom_limits = user.get("custom_limits", {})
            for field, value in custom_limits.items():
                if isinstance(value, int) and value < 0:
                    warnings.append(
                        f"Negative custom limit found: {field}={value}"
                    )
        
        return {
            "valid": True,
            "has_warnings": len(warnings) > 0,
            "warnings": warnings,
            "user_id": user_id,
            "subscription_exists": subscription is not None,
            "user_document_exists": user is not None
        }


# ============================================================================
# GLOBAL INSTANCE
# ============================================================================

limit_resolver = LimitResolver()


# ============================================================================
# EXAMPLE USAGE & TEST SCENARIOS
# ============================================================================

"""
EXAMPLE 1: Basic Limit Resolution
-----------------------------------
Input:
    user_id: "user123"
    resource_type: "chatbots"
    User has: custom_limits.max_chatbots = 10
    Plan has: max_chatbots = 5

Output:
    LimitResolutionResult(
        resource_type="chatbots",
        effective_limit=10,
        plan_limit=5,
        custom_limit_applied=True,
        custom_limit_source="custom_limits_dict",
        custom_limit_value=10,
        plan_id="starter",
        plan_name="Starter"
    )

EXAMPLE 2: Legacy Field Override
----------------------------------
Input:
    user_id: "user456"
    resource_type: "messages"
    User has: custom_max_messages = 50000 (legacy field)
    Plan has: max_messages_per_month = 15000

Output:
    LimitResolutionResult(
        resource_type="messages",
        effective_limit=50000,
        plan_limit=15000,
        custom_limit_applied=True,
        custom_limit_source="legacy_field",
        custom_limit_value=50000,
        plan_id="starter",
        plan_name="Starter"
    )

EXAMPLE 3: Plan Default (No Custom Limits)
--------------------------------------------
Input:
    user_id: "user789"
    resource_type: "file_uploads"
    User has: No custom limits
    Plan has: max_file_uploads = 20

Output:
    LimitResolutionResult(
        resource_type="file_uploads",
        effective_limit=20,
        plan_limit=20,
        custom_limit_applied=False,
        custom_limit_source=None,
        custom_limit_value=None,
        plan_id="starter",
        plan_name="Starter"
    )

EXAMPLE 4: Bulk Resolution for Dashboard
------------------------------------------
Input:
    user_id: "user123"

Output:
    BulkLimitResolution(
        user_id="user123",
        plan_id="starter",
        plan_name="Starter",
        limits={
            "chatbots": LimitResolutionResult(...),
            "messages": LimitResolutionResult(...),
            "file_uploads": LimitResolutionResult(...),
            "website_sources": LimitResolutionResult(...),
            "text_sources": LimitResolutionResult(...)
        },
        resolved_at="2025-01-02T12:00:00Z"
    )

EXAMPLE 5: Limit with Usage Context
-------------------------------------
Input:
    user_id: "user123"
    resource_type: "chatbots"
    Current usage: 3 chatbots
    Effective limit: 10

Output:
    {
        "limit_info": {
            "resource_type": "chatbots",
            "effective_limit": 10,
            "plan_limit": 5,
            "custom_limit_applied": True,
            ...
        },
        "current_usage": 3,
        "remaining": 7,
        "percentage_used": 30.0,
        "is_at_limit": False
    }

ERROR HANDLING EXAMPLES:
------------------------
1. Invalid resource type:
   → Raises InvalidResourceTypeError with clear message

2. User has no subscription:
   → Raises SubscriptionNotFoundError

3. Plan doesn't exist:
   → Raises PlanNotFoundError

4. User document doesn't exist:
   → Returns plan defaults (no custom limits applied)
"""
