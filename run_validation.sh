#!/bin/bash
# Run Phase 6 & 7 validation tests

echo "Running Phase 6 & 7 Validation Tests..."
echo "========================================"
echo ""

cd /app/backend

# Run the tests using Python from the backend directory
python3 << 'PYTHON_SCRIPT'
import asyncio
import sys
import os
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient

# Import services
from services.usage_service import usage_service, UsageLimitExceededError, SubscriptionNotFoundError

# Get database connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'chatbase_db')

async def run_quick_validation():
    """Run quick validation of Phase 6 & 7"""
    
    print("\n" + "="*80)
    print("PHASE 6 & 7 - QUICK VALIDATION")
    print("="*80)
    
    # Connect to database
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # Cleanup test data
    await db.subscriptions.delete_many({"user_id": {"$regex": "^test_quick_"}})
    await db.users.delete_many({"id": {"$regex": "^test_quick_"}})
    
    results = []
    
    # TEST 1: Reset monthly usage
    print("\n[TEST 1] Testing reset_monthly_usage()...")
    try:
        user_id = "test_quick_reset"
        
        # Create test subscription
        await db.subscriptions.insert_one({
            "user_id": user_id,
            "plan_id": "free",
            "status": "active",
            "started_at": datetime.now(timezone.utc),
            "expires_at": datetime.now(timezone.utc) + timedelta(days=30),
            "usage": {
                "chatbots_count": 5,
                "messages_this_month": 100,
                "file_uploads_count": 10,
                "website_sources_count": 2,
                "text_sources_count": 3,
                "last_reset": datetime.now(timezone.utc) - timedelta(days=30)
            }
        })
        
        # Call reset
        result = await usage_service.reset_monthly_usage(user_id)
        
        # Verify
        subscription = await db.subscriptions.find_one({"user_id": user_id})
        usage = subscription["usage"]
        
        if (usage['chatbots_count'] == 0 and 
            usage['messages_this_month'] == 0 and 
            usage['file_uploads_count'] == 0 and
            usage['website_sources_count'] == 2 and  # Should NOT be reset
            usage['text_sources_count'] == 3):       # Should NOT be reset
            print("✅ PASS: Reset correctly resets monthly fields and preserves persistent fields")
            results.append(True)
        else:
            print("❌ FAIL: Reset did not work correctly")
            print(f"  Chatbots: {usage['chatbots_count']} (expected 0)")
            print(f"  Messages: {usage['messages_this_month']} (expected 0)")
            print(f"  File uploads: {usage['file_uploads_count']} (expected 0)")
            print(f"  Website sources: {usage['website_sources_count']} (expected 2)")
            print(f"  Text sources: {usage['text_sources_count']} (expected 3)")
            results.append(False)
            
    except Exception as e:
        print(f"❌ FAIL: Exception during reset test: {e}")
        results.append(False)
    
    # TEST 2: Atomic increment
    print("\n[TEST 2] Testing atomic increment_usage()...")
    try:
        user_id = "test_quick_increment"
        
        # Create test subscription
        await db.users.insert_one({
            "id": user_id,
            "email": "test@test.com"
        })
        
        await db.subscriptions.insert_one({
            "user_id": user_id,
            "plan_id": "free",
            "status": "active",
            "started_at": datetime.now(timezone.utc),
            "expires_at": datetime.now(timezone.utc) + timedelta(days=30),
            "usage": {
                "chatbots_count": 0,
                "messages_this_month": 0,
                "file_uploads_count": 0,
                "website_sources_count": 0,
                "text_sources_count": 0,
                "last_reset": datetime.now(timezone.utc)
            }
        })
        
        # Increment messages
        result = await usage_service.increment_usage(user_id, "messages", 1)
        
        if result.success and result.current_value == 1:
            print("✅ PASS: Atomic increment works correctly")
            results.append(True)
        else:
            print(f"❌ FAIL: Increment result unexpected: {result}")
            results.append(False)
            
    except Exception as e:
        print(f"❌ FAIL: Exception during increment test: {e}")
        results.append(False)
    
    # TEST 3: Limit enforcement
    print("\n[TEST 3] Testing limit enforcement...")
    try:
        user_id = "test_quick_limit"
        
        # Create test plan with low limit
        await db.plans.delete_many({"id": "test_free_low"})
        await db.plans.insert_one({
            "id": "test_free_low",
            "name": "Test Free",
            "limits": {
                "max_chatbots": 1,
                "max_messages_per_month": 10,
                "max_file_uploads": 5,
                "max_website_sources": 1,
                "max_text_sources": 1
            }
        })
        
        # Create user at limit
        await db.users.insert_one({
            "id": user_id,
            "email": "test@test.com"
        })
        
        await db.subscriptions.insert_one({
            "user_id": user_id,
            "plan_id": "test_free_low",
            "status": "active",
            "started_at": datetime.now(timezone.utc),
            "expires_at": datetime.now(timezone.utc) + timedelta(days=30),
            "usage": {
                "chatbots_count": 1,  # At limit
                "messages_this_month": 0,
                "file_uploads_count": 0,
                "website_sources_count": 0,
                "text_sources_count": 0,
                "last_reset": datetime.now(timezone.utc)
            }
        })
        
        # Try to exceed limit
        try:
            result = await usage_service.increment_usage(user_id, "chatbots", 1)
            print(f"❌ FAIL: Should have raised UsageLimitExceededError")
            results.append(False)
        except UsageLimitExceededError as e:
            print(f"✅ PASS: Correctly blocked increment at limit")
            print(f"  Error: {e.message}")
            results.append(True)
            
    except Exception as e:
        print(f"❌ FAIL: Exception during limit test: {e}")
        results.append(False)
    
    # Cleanup
    await db.subscriptions.delete_many({"user_id": {"$regex": "^test_quick_"}})
    await db.users.delete_many({"id": {"$regex": "^test_quick_"}})
    await db.plans.delete_many({"id": "test_free_low"})
    
    # Summary
    print("\n" + "="*80)
    print("VALIDATION SUMMARY")
    print("="*80)
    passed = sum(results)
    total = len(results)
    print(f"\nTests passed: {passed}/{total}")
    
    if passed == total:
        print("\n✅ ALL TESTS PASSED - Phase 6 & 7 implementation is working correctly")
        return 0
    else:
        print(f"\n❌ {total - passed} TEST(S) FAILED")
        return 1

# Run validation
exit_code = asyncio.run(run_quick_validation())
sys.exit(exit_code)

PYTHON_SCRIPT

echo ""
echo "Validation complete."
