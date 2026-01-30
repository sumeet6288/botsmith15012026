"""
Billing Audit Log Router - API endpoints for querying billing audit logs

This router provides comprehensive billing audit log access for:
- User audit history
- Admin audit dashboard
- Dispute resolution reports
- Billing state reconstruction
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, List
from datetime import datetime, timedelta
import logging

from auth import get_current_user
from models import (
    User,
    BillingAuditLogQuery,
    BillingAuditLogResponse,
    BillingStateReconstruction
)
from services.billing_audit_service import billing_audit_service

router = APIRouter(prefix="/billing-audit", tags=["Billing Audit"])
logger = logging.getLogger(__name__)


@router.get("/my-history", response_model=List[BillingAuditLogResponse])
async def get_my_audit_history(
    event_type: Optional[str] = None,
    event_category: Optional[str] = Query(None, description="Filter by: usage, payment, subscription, limit, admin"),
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = Query(100, ge=1, le=1000),
    skip: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user)
):
    """
    Get audit history for the current user.
    
    Users can view their own billing history for transparency.
    """
    try:
        events = await billing_audit_service.get_user_audit_history(
            user_id=current_user.id,
            event_type=event_type,
            event_category=event_category,
            start_date=start_date,
            end_date=end_date,
            limit=limit,
            skip=skip
        )
        
        # Convert to response model
        response = []
        for event in events:
            response.append(BillingAuditLogResponse(
                id=event.get("id"),
                timestamp=event.get("timestamp"),
                event_type=event.get("event_type"),
                event_category=event.get("event_category"),
                user_id=event.get("user_id"),
                resource_type=event.get("resource_type"),
                before_value=event.get("before_value"),
                after_value=event.get("after_value"),
                change_amount=event.get("change_amount"),
                description=event.get("description"),
                metadata=event.get("metadata", {})
            ))
        
        return response
        
    except Exception as e:
        logger.error(f"Error fetching audit history for user {current_user.id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch audit history")


@router.get("/my-billing-state", response_model=BillingStateReconstruction)
async def get_my_billing_state(
    target_date: Optional[datetime] = Query(None, description="Reconstruct state at this date (default: now)"),
    current_user: User = Depends(get_current_user)
):
    """
    Reconstruct billing state at a specific point in time.
    
    This is useful for users to understand their historical usage and billing.
    """
    try:
        reconstruction = await billing_audit_service.reconstruct_billing_state(
            user_id=current_user.id,
            target_timestamp=target_date
        )
        
        return reconstruction
        
    except Exception as e:
        logger.error(f"Error reconstructing billing state for user {current_user.id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to reconstruct billing state")


# ============================================================================
# ADMIN ENDPOINTS
# ============================================================================

@router.get("/admin/user-history/{user_id}", response_model=List[BillingAuditLogResponse])
async def admin_get_user_history(
    user_id: str,
    event_type: Optional[str] = None,
    event_category: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = Query(100, ge=1, le=1000),
    skip: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user)
):
    """
    Admin: Get complete audit history for any user.
    
    This is critical for support and dispute resolution.
    """
    # Check if user is admin
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        events = await billing_audit_service.get_user_audit_history(
            user_id=user_id,
            event_type=event_type,
            event_category=event_category,
            start_date=start_date,
            end_date=end_date,
            limit=limit,
            skip=skip
        )
        
        # Convert to response model
        response = []
        for event in events:
            response.append(BillingAuditLogResponse(
                id=event.get("id"),
                timestamp=event.get("timestamp"),
                event_type=event.get("event_type"),
                event_category=event.get("event_category"),
                user_id=event.get("user_id"),
                resource_type=event.get("resource_type"),
                before_value=event.get("before_value"),
                after_value=event.get("after_value"),
                change_amount=event.get("change_amount"),
                description=event.get("description"),
                metadata=event.get("metadata", {})
            ))
        
        logger.info(f"Admin {current_user.email} retrieved {len(response)} audit logs for user {user_id}")
        
        return response
        
    except Exception as e:
        logger.error(f"Error fetching audit history for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch audit history")


@router.get("/admin/dispute-report/{user_id}")
async def admin_get_dispute_report(
    user_id: str,
    dispute_date: Optional[datetime] = Query(None, description="Date of disputed charge (default: now)"),
    lookback_days: int = Query(30, ge=1, le=365, description="Days to look back from dispute date"),
    current_user: User = Depends(get_current_user)
):
    """
    Admin: Generate comprehensive dispute resolution report.
    
    This provides ALL evidence needed to resolve billing disputes:
    - Complete event timeline
    - Usage totals
    - Payment history
    - Billing state reconstruction
    """
    # Check if user is admin
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if not dispute_date:
        dispute_date = datetime.utcnow()
    
    try:
        report = await billing_audit_service.get_dispute_resolution_report(
            user_id=user_id,
            dispute_date=dispute_date,
            lookback_days=lookback_days
        )
        
        logger.info(
            f"Admin {current_user.email} generated dispute report for user {user_id} "
            f"(dispute date: {dispute_date}, lookback: {lookback_days} days)"
        )
        
        return report
        
    except Exception as e:
        logger.error(f"Error generating dispute report for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate dispute report")


@router.get("/admin/reconstruct-state/{user_id}", response_model=BillingStateReconstruction)
async def admin_reconstruct_billing_state(
    user_id: str,
    target_date: Optional[datetime] = Query(None, description="Reconstruct state at this date (default: now)"),
    current_user: User = Depends(get_current_user)
):
    """
    Admin: Reconstruct user's billing state at any point in time.
    
    This is the KILLER FEATURE for dispute resolution:
    - Proves exactly what the state was at any moment
    - Shows usage, limits, payments, plan
    - Verifiable from immutable audit log
    """
    # Check if user is admin
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        reconstruction = await billing_audit_service.reconstruct_billing_state(
            user_id=user_id,
            target_timestamp=target_date
        )
        
        logger.info(
            f"Admin {current_user.email} reconstructed billing state for user {user_id} "
            f"at {target_date or 'now'}"
        )
        
        return reconstruction
        
    except Exception as e:
        logger.error(f"Error reconstructing billing state for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to reconstruct billing state")


@router.get("/admin/stats")
async def admin_get_audit_stats(
    days: int = Query(30, ge=1, le=365, description="Number of days to analyze"),
    current_user: User = Depends(get_current_user)
):
    """
    Admin: Get overall audit log statistics.
    
    Provides insights into:
    - Total events logged
    - Events by category
    - Most active users
    - Payment success rate
    """
    # Check if user is admin
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        # This would contain aggregation queries for stats
        # For now, return basic structure
        stats = {
            "period_days": days,
            "total_events": 0,
            "events_by_category": {
                "usage": 0,
                "payment": 0,
                "subscription": 0,
                "limit": 0,
                "admin": 0
            },
            "payment_stats": {
                "total_payments": 0,
                "successful_payments": 0,
                "failed_payments": 0,
                "total_revenue": 0.0
            },
            "usage_stats": {
                "total_messages": 0,
                "total_chatbots_created": 0,
                "limit_exceeded_events": 0
            }
        }
        
        logger.info(f"Admin {current_user.email} retrieved audit stats for last {days} days")
        
        return stats
        
    except Exception as e:
        logger.error(f"Error fetching audit stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch audit stats")
