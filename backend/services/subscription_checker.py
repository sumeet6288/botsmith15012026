from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional
import os
import logging

logger = logging.getLogger(__name__)

class SubscriptionChecker:
    """Service for checking subscription status with clear states"""
    
    def __init__(self):
        mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
        db_name = os.environ.get('DB_NAME', 'chatbase_db')
        self.client = AsyncIOMotorClient(mongo_url)
        self.db = self.client[db_name]
        self.subscriptions = self.db.subscriptions
        self.users = self.db.users
    
    async def check_subscription_status(self, user_id: str, use_cache: bool = True) -> Dict:
        """
        Check subscription status with clear states
        
        Returns:
        {
            "status": "active" | "expired" | "suspended" | "trialing" | 
                     "grace_period" | "payment_failed" | "cancelled",
            "plan_id": str,
            "expires_at": datetime,
            "days_remaining": int,
            "days_since_expiry": int,
            "suspension_reason": str (optional),
            "allow_access": bool  # Clear access decision
        }
        """
        subscription = await self.subscriptions.find_one(
            {"user_id": user_id},
            sort=[("created_at", -1)]  # Get latest subscription
        )
        
        if not subscription:
            # No subscription = free plan
            return {
                "status": "active",
                "plan_id": "free",
                "expires_at": None,
                "days_remaining": 9999,
                "days_since_expiry": 0,
                "allow_access": True
            }
        
        now = datetime.now(timezone.utc)
        expires_at = subscription.get("expires_at")
        
        if not expires_at:
            # No expiry = lifetime or free
            return {
                "status": "active",
                "plan_id": subscription.get("plan_id", "free"),
                "expires_at": None,
                "days_remaining": 9999,
                "days_since_expiry": 0,
                "allow_access": True
            }
        
        # Ensure expires_at is timezone-aware
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        
        # Calculate time differences
        time_diff = (expires_at - now).total_seconds()
        days_remaining = int(time_diff / 86400)
        days_since_expiry = -days_remaining if days_remaining < 0 else 0
        
        # Check manual suspension
        if subscription.get("suspended", False):
            return {
                "status": "suspended",
                "plan_id": subscription.get("plan_id"),
                "expires_at": expires_at,
                "days_remaining": days_remaining,
                "days_since_expiry": days_since_expiry,
                "suspension_reason": subscription.get("suspension_reason", "Account suspended"),
                "allow_access": False
            }
        
        # Check payment status
        payment_status = subscription.get("payment_status", "paid")
        if payment_status == "failed":
            return {
                "status": "payment_failed",
                "plan_id": subscription.get("plan_id"),
                "expires_at": expires_at,
                "days_remaining": days_remaining,
                "days_since_expiry": days_since_expiry,
                "allow_access": False  # No access if payment failed
            }
        
        # Check if in trial period
        trial_ends_at = subscription.get("trial_ends_at")
        if trial_ends_at and trial_ends_at > now:
            return {
                "status": "trialing",
                "plan_id": subscription.get("plan_id"),
                "expires_at": trial_ends_at,
                "days_remaining": int((trial_ends_at - now).total_seconds() / 86400),
                "days_since_expiry": 0,
                "allow_access": True
            }
        
        # Check if expired
        if expires_at < now:
            # Grace period: 3 days after expiry
            grace_period_days = 3
            grace_period_end = expires_at + timedelta(days=grace_period_days)
            
            if now < grace_period_end:
                return {
                    "status": "grace_period",
                    "plan_id": subscription.get("plan_id"),
                    "expires_at": expires_at,
                    "days_remaining": 0,
                    "days_since_expiry": days_since_expiry,
                    "grace_period_ends_at": grace_period_end,
                    "allow_access": True  # ✅ Allow access during grace period
                }
            else:
                return {
                    "status": "expired",
                    "plan_id": subscription.get("plan_id"),
                    "expires_at": expires_at,
                    "days_remaining": 0,
                    "days_since_expiry": days_since_expiry,
                    "allow_access": False  # ❌ No access after grace period
                }
        
        # Active subscription
        return {
            "status": "active",
            "plan_id": subscription.get("plan_id"),
            "expires_at": expires_at,
            "days_remaining": days_remaining,
            "days_since_expiry": 0,
            "allow_access": True
        }
    
    async def get_subscription_health(self, user_id: str) -> Dict:
        """
        Get subscription health check for monitoring
        """
        status = await self.check_subscription_status(user_id)
        
        health = "healthy"
        if status["status"] in ["expired", "suspended", "payment_failed"]:
            health = "critical"
        elif status["status"] == "grace_period":
            health = "warning"
        elif status["days_remaining"] <= 3:
            health = "expiring_soon"
        
        return {
            "health": health,
            "status": status["status"],
            "days_remaining": status["days_remaining"],
            "allow_access": status["allow_access"]
        }
