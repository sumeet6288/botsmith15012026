"""
Create database indexes for billing_audit_logs collection.

This script creates optimized indexes for fast querying of audit logs.
Run this after deploying the billing audit system.
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os


async def create_billing_audit_indexes():
    """Create indexes for billing_audit_logs collection"""
    
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'chatbase_db')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    audit_logs = db.billing_audit_logs
    
    print("🔨 Creating billing audit log indexes...")
    
    # Index 1: User ID + Timestamp (descending) - Primary query pattern
    await audit_logs.create_index(
        [("user_id", 1), ("timestamp", -1)],
        name="user_timestamp_idx"
    )
    print("✅ Created index: user_timestamp_idx")
    
    # Index 2: User ID + Event Category + Timestamp
    await audit_logs.create_index(
        [("user_id", 1), ("event_category", 1), ("timestamp", -1)],
        name="user_category_timestamp_idx"
    )
    print("✅ Created index: user_category_timestamp_idx")
    
    # Index 3: User ID + Event Type + Timestamp
    await audit_logs.create_index(
        [("user_id", 1), ("event_type", 1), ("timestamp", -1)],
        name="user_type_timestamp_idx"
    )
    print("✅ Created index: user_type_timestamp_idx")
    
    # Index 4: Payment ID (for payment reconciliation)
    await audit_logs.create_index(
        [("razorpay_payment_id", 1)],
        name="payment_id_idx",
        sparse=True
    )
    print("✅ Created index: payment_id_idx")
    
    # Index 5: Subscription ID (for subscription history)
    await audit_logs.create_index(
        [("subscription_id", 1), ("timestamp", -1)],
        name="subscription_timestamp_idx",
        sparse=True
    )
    print("✅ Created index: subscription_timestamp_idx")
    
    # Index 6: Timestamp only (for global audit queries)
    await audit_logs.create_index(
        [("timestamp", -1)],
        name="timestamp_idx"
    )
    print("✅ Created index: timestamp_idx")
    
    # Index 7: Admin actions (for admin audit trail)
    await audit_logs.create_index(
        [("admin_id", 1), ("timestamp", -1)],
        name="admin_timestamp_idx",
        sparse=True
    )
    print("✅ Created index: admin_timestamp_idx")
    
    # Index 8: Chatbot ID (for per-chatbot usage tracking)
    await audit_logs.create_index(
        [("chatbot_id", 1), ("timestamp", -1)],
        name="chatbot_timestamp_idx",
        sparse=True
    )
    print("✅ Created index: chatbot_timestamp_idx")
    
    # Index 9: Event category + Timestamp (for category-based queries)
    await audit_logs.create_index(
        [("event_category", 1), ("timestamp", -1)],
        name="category_timestamp_idx"
    )
    print("✅ Created index: category_timestamp_idx")
    
    # Index 10: Resource type + Timestamp (for usage analytics)
    await audit_logs.create_index(
        [("resource_type", 1), ("timestamp", -1)],
        name="resource_timestamp_idx",
        sparse=True
    )
    print("✅ Created index: resource_timestamp_idx")
    
    print("\n✅ All billing audit indexes created successfully!")
    print("📊 Total indexes: 10")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(create_billing_audit_indexes())
