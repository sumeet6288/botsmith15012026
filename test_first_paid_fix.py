"""
Test script to verify First Paid Payment Bug Fix

This script tests the critical fix for the subscription billing bug where users
upgrading from Free → Paid were getting 59 days instead of 30 days.

Test Scenarios:
1. Fresh user (no previous paid) upgrades Free → Starter = 30 days ✓
2. User with previous paid payment renews Starter → Starter = extends from current ✓
3. User with previous paid payment upgrades Starter → Professional = 30 days ✓
4. Manual sync does not count as "first paid" ✓
"""

import asyncio
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta
import os

# Add backend to path
sys.path.insert(0, '/app/backend')

from services.subscription_service import SubscriptionService

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'chatbase_db')


async def setup_test_data(db):
    """Setup test data"""
    print("\n" + "="*80)
    print("🔧 SETTING UP TEST DATA")
    print("="*80)
    
    # Create test users
    test_users = [
        {
            "id": "test_user_fresh_001",
            "email": "fresh@test.com",
            "name": "Fresh User",
            "plan_id": "free",
            "created_at": datetime.utcnow()
        },
        {
            "id": "test_user_paid_002",
            "email": "paid@test.com",
            "name": "Paid User",
            "plan_id": "starter",
            "created_at": datetime.utcnow() - timedelta(days=60)
        }
    ]
    
    for user in test_users:
        await db.users.delete_one({"id": user["id"]})  # Clean up first
        await db.users.insert_one(user)
        print(f"✅ Created user: {user['email']} (plan: {user['plan_id']})")
    
    # Create initial subscriptions
    # Fresh user: Free plan with 5 days remaining
    await db.subscriptions.delete_one({"user_id": "test_user_fresh_001"})
    await db.subscriptions.insert_one({
        "user_id": "test_user_fresh_001",
        "plan_id": "free",
        "status": "active",
        "started_at": datetime.utcnow() - timedelta(days=1),
        "expires_at": datetime.utcnow() + timedelta(days=5),  # 5 days remaining
        "created_at": datetime.utcnow()
    })
    print(f"✅ Created FREE subscription for fresh@test.com (expires in 5 days)")
    
    # Paid user: Starter plan with 10 days remaining
    await db.subscriptions.delete_one({"user_id": "test_user_paid_002"})
    await db.subscriptions.insert_one({
        "user_id": "test_user_paid_002",
        "plan_id": "starter",
        "status": "active",
        "started_at": datetime.utcnow() - timedelta(days=20),
        "expires_at": datetime.utcnow() + timedelta(days=10),  # 10 days remaining
        "created_at": datetime.utcnow() - timedelta(days=20)
    })
    print(f"✅ Created STARTER subscription for paid@test.com (expires in 10 days)")
    
    # Add previous payment record for paid user (to simulate past paid cycle)
    await db.processed_payments.insert_one({
        "payment_id": "previous_payment_paid_user",
        "user_id": "test_user_paid_002",
        "plan_id": "starter",
        "processed_at": datetime.utcnow() - timedelta(days=30),
        "payment_source": "webhook",
        "expires_at": datetime.utcnow() - timedelta(days=10)
    })
    print(f"✅ Added previous payment record for paid@test.com")
    
    print("\n✅ Test data setup complete!")
    return True


async def test_scenario_1(subscription_service):
    """
    TEST 1: Fresh user (Free plan) upgrades to Starter (FIRST PAID PAYMENT)
    Expected: Gets exactly 30 days from now (NOT 35 days = 5 remaining + 30)
    """
    print("\n" + "="*80)
    print("🧪 TEST 1: Free → Starter (FIRST PAID PAYMENT)")
    print("="*80)
    
    user_id = "test_user_fresh_001"
    payment_id = "test_payment_001_first_paid"
    plan_id = "starter"
    
    print(f"📝 Scenario: User fresh@test.com has FREE plan with 5 days remaining")
    print(f"📝 Action: Paying for STARTER plan (their FIRST PAID PAYMENT)")
    print(f"📝 Expected: Gets exactly 30 days from now (NOT 35 days)")
    
    # Get subscription before
    sub_before = await subscription_service.subscriptions_collection.find_one({"user_id": user_id})
    days_remaining_before = (sub_before['expires_at'] - datetime.utcnow()).days
    print(f"\n⏰ Before: {days_remaining_before} days remaining on FREE plan")
    print(f"   Expires at: {sub_before['expires_at']}")
    
    # Process payment
    result = await subscription_service.process_payment_idempotent(
        payment_id=payment_id,
        user_id=user_id,
        plan_id=plan_id,
        payment_source="webhook"
    )
    
    # Get subscription after
    sub_after = await subscription_service.subscriptions_collection.find_one({"user_id": user_id})
    duration_days = (sub_after['expires_at'] - datetime.utcnow()).days
    
    print(f"\n⏰ After: {duration_days} days until expiration")
    print(f"   Started at: {sub_after['started_at']}")
    print(f"   Expires at: {sub_after['expires_at']}")
    print(f"   Action type: {result.get('action_type')}")
    
    # Validate
    if 29 <= duration_days <= 31:  # Allow for processing time
        print(f"\n✅ TEST 1 PASSED: Got {duration_days} days (expected ~30 days)")
        return True
    else:
        print(f"\n❌ TEST 1 FAILED: Got {duration_days} days, expected ~30 days")
        print(f"   This means user would get {duration_days} days instead of 30!")
        return False


async def test_scenario_2(subscription_service):
    """
    TEST 2: User with previous paid cycle renews SAME plan
    Expected: Extends from current expiry (10 remaining + 30 new = 40 total)
    """
    print("\n" + "="*80)
    print("🧪 TEST 2: Starter → Starter (RENEWAL with previous paid cycle)")
    print("="*80)
    
    user_id = "test_user_paid_002"
    payment_id = "test_payment_002_renewal"
    plan_id = "starter"
    
    print(f"📝 Scenario: User paid@test.com has STARTER plan with 10 days remaining")
    print(f"📝 Previous paid cycle: Yes (has payment history)")
    print(f"📝 Action: Renewing STARTER plan (same plan)")
    print(f"📝 Expected: Gets 40 days total (10 remaining + 30 new)")
    
    # Get subscription before
    sub_before = await subscription_service.subscriptions_collection.find_one({"user_id": user_id})
    days_remaining_before = (sub_before['expires_at'] - datetime.utcnow()).days
    expires_before = sub_before['expires_at']
    print(f"\n⏰ Before: {days_remaining_before} days remaining on STARTER plan")
    print(f"   Expires at: {expires_before}")
    
    # Process payment
    result = await subscription_service.process_payment_idempotent(
        payment_id=payment_id,
        user_id=user_id,
        plan_id=plan_id,
        payment_source="webhook"
    )
    
    # Get subscription after
    sub_after = await subscription_service.subscriptions_collection.find_one({"user_id": user_id})
    duration_days = (sub_after['expires_at'] - datetime.utcnow()).days
    
    print(f"\n⏰ After: {duration_days} days until expiration")
    print(f"   Started at: {sub_after['started_at']}")
    print(f"   Expires at: {sub_after['expires_at']}")
    print(f"   Action type: {result.get('action_type')}")
    
    # Validate (should be ~40 days = 10 remaining + 30 new)
    expected_days = days_remaining_before + 30
    if abs(duration_days - expected_days) <= 1:  # Allow for processing time
        print(f"\n✅ TEST 2 PASSED: Got {duration_days} days (expected ~{expected_days} days)")
        return True
    else:
        print(f"\n❌ TEST 2 FAILED: Got {duration_days} days, expected ~{expected_days} days")
        return False


async def test_scenario_3(subscription_service):
    """
    TEST 3: User with previous paid cycle upgrades to DIFFERENT plan
    Expected: Resets to 30 days from now (NOT extends from current)
    """
    print("\n" + "="*80)
    print("🧪 TEST 3: Starter → Professional (UPGRADE with previous paid cycle)")
    print("="*80)
    
    user_id = "test_user_paid_002"
    payment_id = "test_payment_003_upgrade"
    plan_id = "professional"
    
    print(f"📝 Scenario: User paid@test.com currently has STARTER plan")
    print(f"📝 Previous paid cycle: Yes (has payment history)")
    print(f"📝 Action: Upgrading to PROFESSIONAL plan (different plan)")
    print(f"📝 Expected: Gets exactly 30 days from now (fresh start)")
    
    # Get subscription before
    sub_before = await subscription_service.subscriptions_collection.find_one({"user_id": user_id})
    days_remaining_before = (sub_before['expires_at'] - datetime.utcnow()).days
    print(f"\n⏰ Before: {days_remaining_before} days remaining on STARTER plan")
    print(f"   Expires at: {sub_before['expires_at']}")
    
    # Process payment
    result = await subscription_service.process_payment_idempotent(
        payment_id=payment_id,
        user_id=user_id,
        plan_id=plan_id,
        payment_source="webhook"
    )
    
    # Get subscription after
    sub_after = await subscription_service.subscriptions_collection.find_one({"user_id": user_id})
    duration_days = (sub_after['expires_at'] - datetime.utcnow()).days
    
    print(f"\n⏰ After: {duration_days} days until expiration")
    print(f"   Started at: {sub_after['started_at']}")
    print(f"   Expires at: {sub_after['expires_at']}")
    print(f"   Action type: {result.get('action_type')}")
    
    # Validate (should be ~30 days, NOT 30 + remaining)
    if 29 <= duration_days <= 31:
        print(f"\n✅ TEST 3 PASSED: Got {duration_days} days (expected ~30 days)")
        return True
    else:
        print(f"\n❌ TEST 3 FAILED: Got {duration_days} days, expected ~30 days")
        return False


async def test_scenario_4_manual_sync(subscription_service, db):
    """
    TEST 4: Manual sync should not extend time for first paid activation
    Expected: Manual sync with payment_source="manual_sync" should not be counted as "first paid"
    """
    print("\n" + "="*80)
    print("🧪 TEST 4: Manual Sync Should Not Extend Time")
    print("="*80)
    
    # Create a new fresh user for this test
    user_id = "test_user_sync_003"
    await db.users.delete_one({"id": user_id})
    await db.users.insert_one({
        "id": user_id,
        "email": "sync@test.com",
        "name": "Sync Test User",
        "plan_id": "free",
        "created_at": datetime.utcnow()
    })
    
    await db.subscriptions.delete_one({"user_id": user_id})
    await db.subscriptions.insert_one({
        "user_id": user_id,
        "plan_id": "free",
        "status": "active",
        "started_at": datetime.utcnow() - timedelta(days=1),
        "expires_at": datetime.utcnow() + timedelta(days=5),
        "created_at": datetime.utcnow()
    })
    
    print(f"📝 Scenario: New user sync@test.com with FREE plan (5 days remaining)")
    print(f"📝 Action 1: Process manual_sync payment (should act as first paid)")
    print(f"📝 Expected: Gets 30 days from now")
    
    # First sync payment
    sync_payment_id = "sync_payment_001"
    result1 = await subscription_service.process_payment_idempotent(
        payment_id=sync_payment_id,
        user_id=user_id,
        plan_id="starter",
        payment_source="manual_sync"
    )
    
    sub_after_sync = await subscription_service.subscriptions_collection.find_one({"user_id": user_id})
    duration_after_sync = (sub_after_sync['expires_at'] - datetime.utcnow()).days
    
    print(f"\n⏰ After manual sync: {duration_after_sync} days")
    print(f"   Action type: {result1.get('action_type')}")
    
    # Now test if actual webhook payment still treats this as first paid
    print(f"\n📝 Action 2: Process actual webhook payment (should STILL be first paid)")
    print(f"📝 Expected: Still gets 30 days (manual_sync doesn't count as previous paid)")
    
    webhook_payment_id = "webhook_payment_002"
    result2 = await subscription_service.process_payment_idempotent(
        payment_id=webhook_payment_id,
        user_id=user_id,
        plan_id="starter",
        payment_source="webhook"
    )
    
    sub_after_webhook = await subscription_service.subscriptions_collection.find_one({"user_id": user_id})
    duration_after_webhook = (sub_after_webhook['expires_at'] - datetime.utcnow()).days
    
    print(f"\n⏰ After webhook: {duration_after_webhook} days")
    print(f"   Action type: {result2.get('action_type')}")
    
    # Validate
    if 29 <= duration_after_webhook <= 31 and result2.get('action_type') == 'upgrade':
        print(f"\n✅ TEST 4 PASSED: Manual sync did not count as previous paid cycle")
        return True
    else:
        print(f"\n❌ TEST 4 FAILED: Manual sync affected first paid detection")
        return False


async def run_all_tests():
    """Run all test scenarios"""
    print("\n" + "="*80)
    print("🚀 FIRST PAID PAYMENT BUG FIX - COMPREHENSIVE TEST SUITE")
    print("="*80)
    print("\nTesting the critical fix for subscription billing bug:")
    print("Issue: Users upgrading Free → Paid were getting 59 days instead of 30 days")
    print("Fix: Detect first paid payment and force action='upgrade' for fresh 30 days")
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Initialize subscription service
    subscription_service = SubscriptionService(db)
    
    # Setup test data
    await setup_test_data(db)
    
    # Run tests
    results = []
    
    test_1_result = await test_scenario_1(subscription_service)
    results.append(("TEST 1: Free → Starter (First Paid)", test_1_result))
    
    test_2_result = await test_scenario_2(subscription_service)
    results.append(("TEST 2: Starter → Starter (Renewal)", test_2_result))
    
    test_3_result = await test_scenario_3(subscription_service)
    results.append(("TEST 3: Starter → Professional (Upgrade)", test_3_result))
    
    test_4_result = await test_scenario_4_manual_sync(subscription_service, db)
    results.append(("TEST 4: Manual Sync Handling", test_4_result))
    
    # Print summary
    print("\n" + "="*80)
    print("📊 TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{status}: {test_name}")
    
    print(f"\n🎯 Results: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED! First paid payment bug is fixed!")
        print("✅ Users upgrading Free → Paid will now get exactly 30 days")
        print("✅ Renewals still preserve remaining days correctly")
        print("✅ Upgrades reset to 30 days correctly")
        print("✅ Manual sync does not interfere with first paid detection")
    else:
        print("\n⚠️  Some tests failed. Please review the results above.")
    
    # Close connection
    client.close()
    
    return passed == total


if __name__ == "__main__":
    result = asyncio.run(run_all_tests())
    sys.exit(0 if result else 1)
