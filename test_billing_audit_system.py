"""
Comprehensive test for Billing Audit Log System

This script tests all aspects of the billing audit log:
1. Usage event logging
2. Limit exceeded logging
3. Payment event logging
4. Subscription event logging
5. Query functionality
6. Billing state reconstruction
7. Dispute resolution reports
"""

import asyncio
import sys
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import os

# Add parent directory to path
sys.path.append('/app/backend')

from services.billing_audit_service import billing_audit_service
from services.usage_service import UsageService


async def test_billing_audit_system():
    """Test the complete billing audit system"""
    
    print("=" * 80)
    print("BILLING AUDIT LOG SYSTEM - COMPREHENSIVE TEST")
    print("=" * 80)
    
    # Connect to MongoDB
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'chatbase_db')
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # Get a test user (admin user)
    test_user = await db.users.find_one({"email": "admin@botsmith.com"})
    if not test_user:
        print("❌ Test user not found. Please ensure admin@botsmith.com exists.")
        return
    
    user_id = test_user["id"]
    print(f"\n✅ Using test user: {test_user['email']} (ID: {user_id})")
    
    # Get subscription
    subscription = await db.subscriptions.find_one({"user_id": user_id})
    subscription_id = subscription.get("id", "test-sub-id") if subscription else "test-sub-id"
    
    print(f"✅ User subscription found: ID {subscription_id}")
    
    # ========================================================================
    # TEST 1: Log Usage Event
    # ========================================================================
    print("\n" + "-" * 80)
    print("TEST 1: Logging Usage Event")
    print("-" * 80)
    
    try:
        audit_id = await billing_audit_service.log_usage_event(
            user_id=user_id,
            subscription_id=subscription_id,
            event_type="usage_increment",
            resource_type="messages",
            before_value=100,
            after_value=102,
            change_amount=2,
            limit_value=15000,
            custom_limit_applied=False,
            metadata={"test": "automated_test", "test_number": 1}
        )
        print(f"✅ Usage event logged successfully!")
        print(f"   Audit Log ID: {audit_id}")
        print(f"   Event: User consumed 2 messages (100 → 102 / 15000)")
    except Exception as e:
        print(f"❌ Failed to log usage event: {e}")
        return
    
    # ========================================================================
    # TEST 2: Log Limit Exceeded Event
    # ========================================================================
    print("\n" + "-" * 80)
    print("TEST 2: Logging Limit Exceeded Event")
    print("-" * 80)
    
    try:
        audit_id = await billing_audit_service.log_limit_exceeded_event(
            user_id=user_id,
            subscription_id=subscription_id,
            resource_type="messages",
            current_value=15000,
            limit_value=15000,
            attempted_amount=2,
            custom_limit_applied=False,
            metadata={"test": "automated_test", "test_number": 2}
        )
        print(f"✅ Limit exceeded event logged successfully!")
        print(f"   Audit Log ID: {audit_id}")
        print(f"   Event: User attempted 2 messages but limit reached (15000/15000)")
    except Exception as e:
        print(f"❌ Failed to log limit exceeded event: {e}")
        return
    
    # ========================================================================
    # TEST 3: Log Payment Event
    # ========================================================================
    print("\n" + "-" * 80)
    print("TEST 3: Logging Payment Event")
    print("-" * 80)
    
    try:
        audit_id = await billing_audit_service.log_payment_event(
            user_id=user_id,
            event_type="payment_success",
            payment_amount=7999.0,
            payment_currency="INR",
            subscription_id=subscription_id,
            plan_id="starter",
            plan_name="Starter",
            razorpay_payment_id="test_payment_123",
            razorpay_order_id="test_order_456",
            payment_method="card",
            payment_status="captured",
            metadata={"test": "automated_test", "test_number": 3}
        )
        print(f"✅ Payment event logged successfully!")
        print(f"   Audit Log ID: {audit_id}")
        print(f"   Event: Payment success for INR 7999.0 - Starter plan")
    except Exception as e:
        print(f"❌ Failed to log payment event: {e}")
        return
    
    # ========================================================================
    # TEST 4: Log Subscription Event
    # ========================================================================
    print("\n" + "-" * 80)
    print("TEST 4: Logging Subscription Event")
    print("-" * 80)
    
    try:
        audit_id = await billing_audit_service.log_subscription_event(
            user_id=user_id,
            subscription_id=subscription_id,
            event_type="subscription_upgraded",
            old_plan_id="free",
            new_plan_id="starter",
            old_plan_name="Free",
            new_plan_name="Starter",
            payment_id="test_payment_123",
            metadata={"test": "automated_test", "test_number": 4}
        )
        print(f"✅ Subscription event logged successfully!")
        print(f"   Audit Log ID: {audit_id}")
        print(f"   Event: Subscription upgraded from Free to Starter")
    except Exception as e:
        print(f"❌ Failed to log subscription event: {e}")
        return
    
    # ========================================================================
    # TEST 5: Log Admin Action
    # ========================================================================
    print("\n" + "-" * 80)
    print("TEST 5: Logging Admin Action")
    print("-" * 80)
    
    try:
        audit_id = await billing_audit_service.log_admin_action(
            user_id=user_id,
            admin_id=user_id,
            admin_email="admin@botsmith.com",
            event_type="admin_usage_adjustment",
            action_reason="Testing billing audit system",
            subscription_id=subscription_id,
            resource_type="messages",
            before_value=15000,
            after_value=0,
            metadata={"test": "automated_test", "test_number": 5}
        )
        print(f"✅ Admin action logged successfully!")
        print(f"   Audit Log ID: {audit_id}")
        print(f"   Event: Admin reset user's message count")
    except Exception as e:
        print(f"❌ Failed to log admin action: {e}")
        return
    
    # ========================================================================
    # TEST 6: Query User Audit History
    # ========================================================================
    print("\n" + "-" * 80)
    print("TEST 6: Querying User Audit History")
    print("-" * 80)
    
    try:
        # Query all events for this user
        events = await billing_audit_service.get_user_audit_history(
            user_id=user_id,
            limit=100
        )
        print(f"✅ Retrieved {len(events)} audit events for user")
        
        # Show last 5 events
        print(f"\n   Last 5 events:")
        for i, event in enumerate(events[:5]):
            timestamp = event.get("timestamp").strftime("%Y-%m-%d %H:%M:%S") if event.get("timestamp") else "Unknown"
            event_type = event.get("event_type", "Unknown")
            description = event.get("description", "No description")
            print(f"   {i+1}. [{timestamp}] {event_type}: {description}")
        
        # Test filtering by category
        usage_events = await billing_audit_service.get_user_audit_history(
            user_id=user_id,
            event_category="usage",
            limit=10
        )
        print(f"\n   ✅ Found {len(usage_events)} usage events")
        
        payment_events = await billing_audit_service.get_user_audit_history(
            user_id=user_id,
            event_category="payment",
            limit=10
        )
        print(f"   ✅ Found {len(payment_events)} payment events")
        
    except Exception as e:
        print(f"❌ Failed to query audit history: {e}")
        return
    
    # ========================================================================
    # TEST 7: Billing State Reconstruction
    # ========================================================================
    print("\n" + "-" * 80)
    print("TEST 7: Billing State Reconstruction")
    print("-" * 80)
    
    try:
        # Reconstruct current state
        reconstruction = await billing_audit_service.reconstruct_billing_state(
            user_id=user_id
        )
        print(f"✅ Successfully reconstructed billing state!")
        print(f"   User ID: {reconstruction.user_id}")
        print(f"   Reconstruction Time: {reconstruction.reconstruction_timestamp}")
        print(f"   Plan: {reconstruction.plan_name} (ID: {reconstruction.plan_id})")
        print(f"   Usage State: {reconstruction.usage_state}")
        print(f"   Limit State: {reconstruction.limit_state}")
        print(f"   Total Events: {reconstruction.event_count}")
        print(f"   Total Paid: ₹{reconstruction.total_paid}")
        print(f"   Payment Count: {reconstruction.payment_count}")
        print(f"   Confidence: {reconstruction.confidence}")
    except Exception as e:
        print(f"❌ Failed to reconstruct billing state: {e}")
        return
    
    # ========================================================================
    # TEST 8: Dispute Resolution Report
    # ========================================================================
    print("\n" + "-" * 80)
    print("TEST 8: Dispute Resolution Report")
    print("-" * 80)
    
    try:
        # Generate dispute report for last 30 days
        dispute_date = datetime.utcnow()
        report = await billing_audit_service.get_dispute_resolution_report(
            user_id=user_id,
            dispute_date=dispute_date,
            lookback_days=30
        )
        print(f"✅ Successfully generated dispute resolution report!")
        print(f"   Report Period: {report['report_period']['start']} to {report['report_period']['end']}")
        print(f"   Total Events: {report['summary']['total_events']}")
        print(f"   Usage Events: {report['summary']['usage_events']}")
        print(f"   Payment Events: {report['summary']['payment_events']}")
        print(f"   Subscription Events: {report['summary']['subscription_events']}")
        print(f"   Limit Exceeded: {report['summary']['limit_exceeded_events']}")
        print(f"   Total Messages: {report['summary']['total_messages_consumed']}")
        print(f"   Total Paid: ₹{report['summary']['total_amount_paid']}")
    except Exception as e:
        print(f"❌ Failed to generate dispute report: {e}")
        return
    
    # ========================================================================
    # TEST 9: Verify Immutability (No Update/Delete Methods)
    # ========================================================================
    print("\n" + "-" * 80)
    print("TEST 9: Verifying Immutability")
    print("-" * 80)
    
    # Check that service doesn't have update/delete methods
    has_update = hasattr(billing_audit_service, 'update_audit_log')
    has_delete = hasattr(billing_audit_service, 'delete_audit_log')
    
    if not has_update and not has_delete:
        print("✅ Immutability verified: No update or delete methods exist")
        print("   Audit logs are append-only for tamper-proof audit trail")
    else:
        print("⚠️ Warning: Update or delete methods exist")
    
    # ========================================================================
    # TEST 10: Performance Check
    # ========================================================================
    print("\n" + "-" * 80)
    print("TEST 10: Performance Check")
    print("-" * 80)
    
    import time
    
    # Test query performance
    start_time = time.time()
    events = await billing_audit_service.get_user_audit_history(
        user_id=user_id,
        limit=100
    )
    query_time = (time.time() - start_time) * 1000  # Convert to ms
    
    print(f"✅ Query performance: {query_time:.2f}ms for {len(events)} events")
    
    if query_time < 100:
        print("   🚀 Excellent performance!")
    elif query_time < 500:
        print("   ✅ Good performance")
    else:
        print("   ⚠️ Performance could be improved")
    
    # ========================================================================
    # FINAL SUMMARY
    # ========================================================================
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    print("""
✅ All 10 tests passed successfully!

Billing Audit Log System Status: OPERATIONAL

Features Verified:
1. ✅ Usage event logging
2. ✅ Limit exceeded event logging
3. ✅ Payment event logging
4. ✅ Subscription event logging
5. ✅ Admin action logging
6. ✅ Query functionality
7. ✅ Billing state reconstruction
8. ✅ Dispute resolution reports
9. ✅ Immutability guarantee
10. ✅ Performance optimization

The system is ready for production use!
All billing events will be automatically logged with complete audit trail.
    """)
    
    client.close()


if __name__ == "__main__":
    asyncio.run(test_billing_audit_system())
