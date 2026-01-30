"""
Quick verification test for First Paid Payment Bug Fix
"""

import asyncio
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta
import os

sys.path.insert(0, '/app/backend')
from services.subscription_service import SubscriptionService

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'chatbase_db')


async def quick_test():
    """Quick test to verify the fix"""
    print("\n" + "="*80)
    print("🧪 QUICK VERIFICATION: First Paid Payment Bug Fix")
    print("="*80)
    
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    subscription_service = SubscriptionService(db)
    
    # Clean up any existing test data
    test_user_id = "quick_test_user_" + str(int(datetime.utcnow().timestamp()))
    
    print(f"\n📝 Creating test user: {test_user_id}")
    
    # Create test user with free plan
    await db.users.insert_one({
        "id": test_user_id,
        "email": f"{test_user_id}@test.com",
        "name": "Quick Test User",
        "plan_id": "free",
        "created_at": datetime.utcnow()
    })
    
    # Create free subscription with 5 days remaining
    free_expires = datetime.utcnow() + timedelta(days=5)
    await db.subscriptions.insert_one({
        "user_id": test_user_id,
        "plan_id": "free",
        "status": "active",
        "started_at": datetime.utcnow() - timedelta(days=1),
        "expires_at": free_expires,
        "created_at": datetime.utcnow()
    })
    
    print(f"✅ Created FREE subscription (expires in 5 days: {free_expires.strftime('%Y-%m-%d')})")
    
    # Verify user has no previous paid cycle
    has_paid = await subscription_service.has_previous_paid_cycle(test_user_id)
    print(f"\n🔍 User has previous paid cycle: {has_paid}")
    
    if has_paid:
        print("❌ ERROR: New user should NOT have previous paid cycle!")
        return False
    
    # Process first paid payment (Free → Starter)
    payment_id = f"payment_{test_user_id}_{int(datetime.utcnow().timestamp())}"
    print(f"\n💳 Processing FIRST PAID PAYMENT: Free → Starter")
    print(f"   Payment ID: {payment_id}")
    
    result = await subscription_service.process_payment_idempotent(
        payment_id=payment_id,
        user_id=test_user_id,
        plan_id="starter",
        payment_source="webhook"
    )
    
    # Check result
    sub_after = await db.subscriptions.find_one({"user_id": test_user_id})
    duration_days = (sub_after['expires_at'] - datetime.utcnow()).days
    action_type = result.get('action_type')
    
    print(f"\n📊 RESULTS:")
    print(f"   Action type: {action_type}")
    print(f"   Duration: {duration_days} days")
    print(f"   Expires at: {sub_after['expires_at'].strftime('%Y-%m-%d %H:%M')}")
    
    # Validate
    success = True
    
    if action_type != "upgrade":
        print(f"\n❌ FAILED: Action type should be 'upgrade', got '{action_type}'")
        success = False
    else:
        print(f"✅ Correct action type: 'upgrade'")
    
    if 29 <= duration_days <= 31:
        print(f"✅ Correct duration: {duration_days} days (~30 expected)")
    else:
        print(f"❌ FAILED: Duration should be ~30 days, got {duration_days} days")
        success = False
    
    # Clean up
    await db.users.delete_one({"id": test_user_id})
    await db.subscriptions.delete_one({"user_id": test_user_id})
    await db.processed_payments.delete_one({"payment_id": payment_id})
    
    client.close()
    
    if success:
        print("\n" + "="*80)
        print("🎉 VERIFICATION PASSED: First paid payment bug is FIXED!")
        print("="*80)
    else:
        print("\n" + "="*80)
        print("⚠️  VERIFICATION FAILED: Please check the implementation")
        print("="*80)
    
    return success


if __name__ == "__main__":
    result = asyncio.run(quick_test())
    sys.exit(0 if result else 1)
