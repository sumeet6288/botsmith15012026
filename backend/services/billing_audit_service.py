"""
BillingAuditService - Immutable Audit Log for ALL Billing Events

This service provides comprehensive audit logging for billing, payments, and usage.
It solves the PHASE 0 BLOCKER by creating an immutable record of every billing event.

RESPONSIBILITIES:
- Log usage increments/decrements with before/after state
- Log payment events (success, failure, refund)
- Log subscription changes (upgrade, downgrade, renewal)
- Log limit exceeded events
- Log admin actions (plan changes, manual adjustments)
- Provide query interface for audit history
- Support billing state reconstruction for dispute resolution

IMMUTABILITY GUARANTEE:
- Records are NEVER updated or deleted
- Only INSERT operations are allowed
- Creates complete audit trail for compliance and disputes

CRITICAL FOR:
- Dispute resolution ("I was charged incorrectly")
- Support scalability (prove what happened)
- Regulatory compliance
- Financial auditing
"""

from motor.motor_asyncio import AsyncIOMotorClient
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime, timezone, timedelta
from models import (
    BillingAuditLog,
    BillingAuditLogQuery,
    BillingAuditLogResponse,
    BillingStateReconstruction
)
import os
import logging

logger = logging.getLogger(__name__)


class BillingAuditService:
    """Service for immutable billing audit logging"""
    
    def __init__(self):
        mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
        db_name = os.environ.get('DB_NAME', 'chatbase_db')
        self.client = AsyncIOMotorClient(mongo_url)
        self.db = self.client[db_name]
        self.audit_logs = self.db.billing_audit_logs
        self.subscriptions = self.db.subscriptions
        self.users = self.db.users
        self.plans = self.db.plans
        
    # ========================================================================
    # CORE LOGGING METHODS
    # ========================================================================
    
    async def log_usage_event(
        self,
        user_id: str,
        subscription_id: str,
        event_type: Literal["usage_increment", "usage_decrement", "usage_reset"],
        resource_type: Literal["chatbots", "messages", "file_uploads", "website_sources", "text_sources"],
        before_value: int,
        after_value: int,
        change_amount: int,
        limit_value: int,
        custom_limit_applied: bool = False,
        chatbot_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Log a usage event (increment, decrement, or reset).
        
        Args:
            user_id: User ID
            subscription_id: Subscription ID
            event_type: Type of usage event
            resource_type: Type of resource (messages, chatbots, etc.)
            before_value: Value before change
            after_value: Value after change
            change_amount: Amount of change (positive for increment, negative for decrement)
            limit_value: Current limit for this resource
            custom_limit_applied: Whether custom limit was used
            chatbot_id: Optional chatbot ID (for message events)
            metadata: Additional metadata
        
        Returns:
            Audit log ID
        """
        # Create human-readable description
        action = "consumed" if event_type == "usage_increment" else ("removed" if event_type == "usage_decrement" else "reset")
        description = f"User {action} {abs(change_amount)} {resource_type} ({after_value}/{limit_value})"
        
        if custom_limit_applied:
            description += " [Custom Limit]"
        
        # Create audit log entry
        audit_log = BillingAuditLog(
            timestamp=datetime.now(timezone.utc),
            event_type=event_type,
            event_category="usage",
            user_id=user_id,
            subscription_id=subscription_id,
            chatbot_id=chatbot_id,
            resource_type=resource_type,
            before_value=before_value,
            after_value=after_value,
            change_amount=change_amount,
            limit_value=limit_value,
            custom_limit_applied=custom_limit_applied,
            description=description,
            metadata=metadata or {}
        )
        
        # Insert into database (immutable - no updates)
        result = await self.audit_logs.insert_one(audit_log.model_dump())
        
        logger.info(f"✅ Audit logged: {description} [ID: {audit_log.id}]")
        
        return audit_log.id
    
    async def log_limit_exceeded_event(
        self,
        user_id: str,
        subscription_id: str,
        resource_type: Literal["chatbots", "messages", "file_uploads", "website_sources", "text_sources"],
        current_value: int,
        limit_value: int,
        attempted_amount: int,
        custom_limit_applied: bool = False,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Log when a user attempts to exceed their usage limit.
        
        This is CRITICAL for dispute resolution - proves when limits were enforced.
        """
        description = f"User attempted to use {attempted_amount} more {resource_type} but limit reached ({current_value}/{limit_value})"
        
        audit_log = BillingAuditLog(
            timestamp=datetime.now(timezone.utc),
            event_type="limit_exceeded",
            event_category="limit",
            user_id=user_id,
            subscription_id=subscription_id,
            resource_type=resource_type,
            before_value=current_value,
            after_value=current_value,  # No change - blocked
            change_amount=0,
            limit_value=limit_value,
            limit_exceeded=True,
            custom_limit_applied=custom_limit_applied,
            description=description,
            metadata={
                **(metadata or {}),
                "attempted_amount": attempted_amount,
                "blocked": True
            }
        )
        
        result = await self.audit_logs.insert_one(audit_log.model_dump())
        
        logger.warning(f"⚠️ Limit exceeded logged: {description} [ID: {audit_log.id}]")
        
        return audit_log.id
    
    async def log_payment_event(
        self,
        user_id: str,
        event_type: Literal["payment_initiated", "payment_success", "payment_failed", "payment_refund", "webhook_received"],
        payment_amount: float,
        payment_currency: str,
        payment_id: Optional[str] = None,
        subscription_id: Optional[str] = None,
        plan_id: Optional[str] = None,
        plan_name: Optional[str] = None,
        razorpay_payment_id: Optional[str] = None,
        razorpay_order_id: Optional[str] = None,
        payment_method: Optional[str] = None,
        payment_status: Optional[str] = None,
        error_message: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Log a payment-related event.
        
        This is CRITICAL for financial disputes and reconciliation.
        """
        description = f"Payment {event_type.replace('payment_', '')} for {payment_currency} {payment_amount}"
        if plan_name:
            description += f" - {plan_name} plan"
        
        audit_log = BillingAuditLog(
            timestamp=datetime.now(timezone.utc),
            event_type=event_type,
            event_category="payment",
            user_id=user_id,
            subscription_id=subscription_id,
            payment_id=payment_id,
            plan_id=plan_id,
            payment_amount=payment_amount,
            payment_currency=payment_currency,
            payment_method=payment_method,
            payment_status=payment_status,
            razorpay_payment_id=razorpay_payment_id,
            razorpay_order_id=razorpay_order_id,
            error_occurred=(event_type == "payment_failed"),
            error_message=error_message,
            description=description,
            metadata=metadata or {}
        )
        
        result = await self.audit_logs.insert_one(audit_log.model_dump())
        
        logger.info(f"💳 Payment logged: {description} [ID: {audit_log.id}]")
        
        return audit_log.id
    
    async def log_subscription_event(
        self,
        user_id: str,
        subscription_id: str,
        event_type: Literal[
            "subscription_created",
            "subscription_upgraded",
            "subscription_downgraded",
            "subscription_renewed",
            "subscription_expired",
            "subscription_cancelled"
        ],
        old_plan_id: Optional[str] = None,
        new_plan_id: Optional[str] = None,
        old_plan_name: Optional[str] = None,
        new_plan_name: Optional[str] = None,
        payment_id: Optional[str] = None,
        subscription_state_snapshot: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Log a subscription lifecycle event.
        
        This tracks all subscription changes for audit trail.
        """
        if event_type == "subscription_upgraded":
            description = f"Subscription upgraded from {old_plan_name} to {new_plan_name}"
        elif event_type == "subscription_downgraded":
            description = f"Subscription downgraded from {old_plan_name} to {new_plan_name}"
        elif event_type == "subscription_renewed":
            description = f"Subscription renewed for {new_plan_name}"
        elif event_type == "subscription_created":
            description = f"Subscription created for {new_plan_name}"
        elif event_type == "subscription_expired":
            description = f"Subscription expired for {old_plan_name}"
        else:
            description = f"Subscription cancelled for {old_plan_name}"
        
        audit_log = BillingAuditLog(
            timestamp=datetime.now(timezone.utc),
            event_type=event_type,
            event_category="subscription",
            user_id=user_id,
            subscription_id=subscription_id,
            payment_id=payment_id,
            old_plan_id=old_plan_id,
            new_plan_id=new_plan_id,
            old_plan_name=old_plan_name,
            new_plan_name=new_plan_name,
            plan_id=new_plan_id or old_plan_id,
            subscription_state_snapshot=subscription_state_snapshot,
            description=description,
            metadata=metadata or {}
        )
        
        result = await self.audit_logs.insert_one(audit_log.model_dump())
        
        logger.info(f"📊 Subscription logged: {description} [ID: {audit_log.id}]")
        
        return audit_log.id
    
    async def log_admin_action(
        self,
        user_id: str,
        admin_id: str,
        admin_email: str,
        event_type: Literal[
            "admin_plan_change",
            "admin_usage_adjustment",
            "admin_limit_override",
            "admin_credit_applied",
            "admin_refund_issued"
        ],
        action_reason: str,
        subscription_id: Optional[str] = None,
        resource_type: Optional[str] = None,
        before_value: Optional[int] = None,
        after_value: Optional[int] = None,
        old_plan_id: Optional[str] = None,
        new_plan_id: Optional[str] = None,
        payment_amount: Optional[float] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Log an administrative action on user's billing.
        
        This is CRITICAL for accountability and audit trail of admin actions.
        """
        description = f"Admin {admin_email} performed {event_type.replace('admin_', '')} - Reason: {action_reason}"
        
        audit_log = BillingAuditLog(
            timestamp=datetime.now(timezone.utc),
            event_type=event_type,
            event_category="admin",
            user_id=user_id,
            subscription_id=subscription_id,
            admin_id=admin_id,
            admin_email=admin_email,
            admin_action_reason=action_reason,
            resource_type=resource_type,
            before_value=before_value,
            after_value=after_value,
            old_plan_id=old_plan_id,
            new_plan_id=new_plan_id,
            payment_amount=payment_amount,
            description=description,
            metadata=metadata or {}
        )
        
        result = await self.audit_logs.insert_one(audit_log.model_dump())
        
        logger.info(f"👨‍💼 Admin action logged: {description} [ID: {audit_log.id}]")
        
        return audit_log.id
    
    # ========================================================================
    # QUERY METHODS
    # ========================================================================
    
    async def get_user_audit_history(
        self,
        user_id: str,
        event_type: Optional[str] = None,
        event_category: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100,
        skip: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Get complete audit history for a user.
        
        This is the primary method for dispute resolution.
        """
        query = {"user_id": user_id}
        
        if event_type:
            query["event_type"] = event_type
        
        if event_category:
            query["event_category"] = event_category
        
        if start_date or end_date:
            query["timestamp"] = {}
            if start_date:
                query["timestamp"]["$gte"] = start_date
            if end_date:
                query["timestamp"]["$lte"] = end_date
        
        cursor = self.audit_logs.find(query).sort("timestamp", -1).skip(skip).limit(limit)
        results = await cursor.to_list(length=limit)
        
        logger.info(f"📋 Retrieved {len(results)} audit logs for user {user_id}")
        
        return results
    
    async def reconstruct_billing_state(
        self,
        user_id: str,
        target_timestamp: Optional[datetime] = None
    ) -> BillingStateReconstruction:
        """
        Reconstruct user's billing state at a specific point in time.
        
        This is CRITICAL for dispute resolution - allows proving exact state at any moment.
        
        Algorithm:
        1. Get all audit events up to target_timestamp
        2. Replay events in chronological order
        3. Build up usage state, limit state, payment totals
        4. Return reconstructed state
        """
        if not target_timestamp:
            target_timestamp = datetime.now(timezone.utc)
        
        # Get all events up to target time
        events = await self.get_user_audit_history(
            user_id=user_id,
            start_date=None,
            end_date=target_timestamp,
            limit=10000  # Get all events (consider pagination for very active users)
        )
        
        # Initialize state
        usage_state = {
            "chatbots": 0,
            "messages": 0,
            "file_uploads": 0,
            "website_sources": 0,
            "text_sources": 0
        }
        
        limit_state = {}
        total_paid = 0.0
        payment_count = 0
        current_plan_id = "free"
        current_plan_name = "Free"
        current_subscription_id = None
        last_event_timestamp = None
        
        # Replay events in chronological order (oldest first)
        for event in reversed(events):
            event_type = event.get("event_type")
            
            # Update usage state
            if event_type in ["usage_increment", "usage_decrement", "usage_reset"]:
                resource_type = event.get("resource_type")
                if resource_type:
                    usage_state[resource_type] = event.get("after_value", 0)
                    if event.get("limit_value"):
                        limit_state[resource_type] = event.get("limit_value")
            
            # Track payments
            elif event_type == "payment_success":
                total_paid += event.get("payment_amount", 0.0)
                payment_count += 1
            
            # Track plan changes
            elif event_type in ["subscription_created", "subscription_upgraded", "subscription_downgraded", "subscription_renewed"]:
                current_plan_id = event.get("new_plan_id", "free")
                current_plan_name = event.get("new_plan_name", "Free")
                current_subscription_id = event.get("subscription_id")
            
            last_event_timestamp = event.get("timestamp")
        
        reconstruction = BillingStateReconstruction(
            user_id=user_id,
            reconstruction_timestamp=target_timestamp,
            subscription_id=current_subscription_id,
            plan_id=current_plan_id,
            plan_name=current_plan_name,
            usage_state=usage_state,
            limit_state=limit_state,
            event_count=len(events),
            last_event_timestamp=last_event_timestamp,
            total_paid=total_paid,
            payment_count=payment_count,
            reconstruction_method="event_replay",
            confidence="high" if len(events) > 0 else "low"
        )
        
        logger.info(
            f"🔄 Reconstructed billing state for user {user_id} at {target_timestamp}: "
            f"{usage_state['messages']} messages, {total_paid} paid"
        )
        
        return reconstruction
    
    async def get_dispute_resolution_report(
        self,
        user_id: str,
        dispute_date: datetime,
        lookback_days: int = 30
    ) -> Dict[str, Any]:
        """
        Generate comprehensive dispute resolution report.
        
        This provides all evidence needed to resolve billing disputes.
        """
        start_date = dispute_date - timedelta(days=lookback_days)
        
        # Get all events in dispute period
        all_events = await self.get_user_audit_history(
            user_id=user_id,
            start_date=start_date,
            end_date=dispute_date,
            limit=10000
        )
        
        # Categorize events
        usage_events = [e for e in all_events if e.get("event_category") == "usage"]
        payment_events = [e for e in all_events if e.get("event_category") == "payment"]
        subscription_events = [e for e in all_events if e.get("event_category") == "subscription"]
        limit_events = [e for e in all_events if e.get("event_category") == "limit"]
        
        # Calculate totals
        total_messages = sum(
            e.get("change_amount", 0) 
            for e in usage_events 
            if e.get("resource_type") == "messages" and e.get("event_type") == "usage_increment"
        )
        
        total_paid = sum(
            e.get("payment_amount", 0.0)
            for e in payment_events
            if e.get("event_type") == "payment_success"
        )
        
        # Reconstruct state at dispute date
        state_at_dispute = await self.reconstruct_billing_state(user_id, dispute_date)
        
        report = {
            "user_id": user_id,
            "dispute_date": dispute_date,
            "report_period": {
                "start": start_date,
                "end": dispute_date,
                "days": lookback_days
            },
            "summary": {
                "total_events": len(all_events),
                "usage_events": len(usage_events),
                "payment_events": len(payment_events),
                "subscription_events": len(subscription_events),
                "limit_exceeded_events": len(limit_events),
                "total_messages_consumed": total_messages,
                "total_amount_paid": total_paid
            },
            "billing_state_at_dispute": state_at_dispute.model_dump(),
            "detailed_events": {
                "usage": usage_events[:50],  # Last 50 usage events
                "payments": payment_events,
                "subscriptions": subscription_events,
                "limits": limit_events
            },
            "generated_at": datetime.now(timezone.utc)
        }
        
        logger.info(f"📊 Generated dispute report for user {user_id}: {len(all_events)} events analyzed")
        
        return report


# Global instance
billing_audit_service = BillingAuditService()
