"""
Test script to diagnose subscription flow issue
"""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

async def test_subscription_flow():
    """Test the subscription flow to identify the issue"""
    
    # Connect to MongoDB
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'chatbase_db')
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("=" * 80)
    print("SUBSCRIPTION FLOW DIAGNOSTIC TEST")
    print("=" * 80)
    
    # Test 1: Check if users exist
    print("\n1. Checking users collection...")
    users = await db.users.find({}).to_list(length=10)
    print(f"   Found {len(users)} users")
    for user in users:
        print(f"   - User: {user.get('email')} | ID: {user.get('id')} | Plan: {user.get('plan_id', 'NOT SET')}")
    
    # Test 2: Check subscriptions
    print("\n2. Checking subscriptions collection...")
    subscriptions = await db.subscriptions.find({}).to_list(length=10)
    print(f"   Found {len(subscriptions)} subscriptions")
    for sub in subscriptions:
        print(f"   - User ID: {sub.get('user_id')} | Plan: {sub.get('plan_id')} | Status: {sub.get('status')} | Expires: {sub.get('expires_at')}")
    
    # Test 3: Check plans
    print("\n3. Checking plans collection...")
    plans = await db.plans.find({}).to_list(length=10)
    print(f"   Found {len(plans)} plans")
    for plan in plans:
        print(f"   - Plan ID: {plan.get('id')} | Name: {plan.get('name')} | Price: {plan.get('price')}")
    
    # Test 4: Check processed_payments
    print("\n4. Checking processed_payments collection...")
    processed_payments = await db.processed_payments.find({}).to_list(length=10)
    print(f"   Found {len(processed_payments)} processed payments")
    for payment in processed_payments:
        print(f"   - Payment ID: {payment.get('payment_id')} | User: {payment.get('user_id')} | Plan: {payment.get('plan_id')} | Processed: {payment.get('processed_at')}")
    
    # Test 5: Check razorpay_subscriptions
    print("\n5. Checking razorpay_subscriptions collection...")
    razorpay_subs = await db.razorpay_subscriptions.find({}).to_list(length=10)
    print(f"   Found {len(razorpay_subs)} razorpay subscriptions")
    for rsub in razorpay_subs:
        print(f"   - Subscription ID: {rsub.get('subscription_id')} | User: {rsub.get('user_id')} | Plan: {rsub.get('plan_id')} | Status: {rsub.get('status')}")
    
    # Test 6: Simulate a subscription update scenario
    print("\n6. Testing subscription update scenario...")
    if users:
        test_user = users[0]
        user_id = test_user.get('id')
        
        # Get current subscription
        current_sub = await db.subscriptions.find_one({"user_id": user_id})
        print(f"   Current subscription for {test_user.get('email')}:")
        if current_sub:
            print(f"   - Plan: {current_sub.get('plan_id')}")
            print(f"   - Status: {current_sub.get('status')}")
            print(f"   - Expires: {current_sub.get('expires_at')}")
        else:
            print(f"   - No subscription found")
        
        # Check if user document has plan_id
        print(f"   User document plan_id: {test_user.get('plan_id', 'NOT SET')}")
        
        # Check consistency
        if current_sub:
            sub_plan = current_sub.get('plan_id')
            user_plan = test_user.get('plan_id')
            if sub_plan != user_plan:
                print(f"   ⚠️  INCONSISTENCY DETECTED!")
                print(f"   - Subscription plan_id: {sub_plan}")
                print(f"   - User plan_id: {user_plan}")
            else:
                print(f"   ✅ Plans are consistent")
    
    # Test 7: Check Razorpay configuration
    print("\n7. Checking Razorpay configuration...")
    razorpay_key_id = os.environ.get('RAZORPAY_KEY_ID')
    razorpay_key_secret = os.environ.get('RAZORPAY_KEY_SECRET')
    starter_plan_id = os.environ.get('RAZORPAY_STARTER_PLAN_ID')
    professional_plan_id = os.environ.get('RAZORPAY_PROFESSIONAL_PLAN_ID')
    
    print(f"   RAZORPAY_KEY_ID: {'✅ SET' if razorpay_key_id else '❌ NOT SET'}")
    print(f"   RAZORPAY_KEY_SECRET: {'✅ SET' if razorpay_key_secret else '❌ NOT SET'}")
    print(f"   RAZORPAY_STARTER_PLAN_ID: {starter_plan_id if starter_plan_id else '❌ NOT SET'}")
    print(f"   RAZORPAY_PROFESSIONAL_PLAN_ID: {professional_plan_id if professional_plan_id else '❌ NOT SET'}")
    
    print("\n" + "=" * 80)
    print("DIAGNOSTIC TEST COMPLETE")
    print("=" * 80)
    
    client.close()

if __name__ == "__main__":
    asyncio.run(test_subscription_flow())
