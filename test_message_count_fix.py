#!/usr/bin/env python3
"""
Test script to verify message count synchronization fix
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv('/app/backend/.env')

async def test_message_count_sync():
    """Test that message_count syncs with messages_count"""
    
    # Connect to MongoDB
    mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.getenv('DB_NAME', 'chatbase_db')
    
    print(f"🔌 Connecting to MongoDB at {mongo_url}")
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # Get all conversations
    conversations = await db.conversations.find().to_list(length=10)
    
    print(f"\n📊 Found {len(conversations)} conversations in database\n")
    
    if not conversations:
        print("⚠️  No conversations found. Create a conversation by sending a message to a chatbot.")
        return
    
    print("=" * 80)
    print(f"{'Conversation ID':<36} | {'messages_count':<15} | {'message_count':<15}")
    print("=" * 80)
    
    for conv in conversations:
        conv_id = conv.get('id', 'N/A')[:34]
        messages_count = conv.get('messages_count', 'MISSING')
        message_count = conv.get('message_count', 'MISSING')
        
        # Check if they match
        status = "✅" if messages_count == message_count else "❌"
        
        print(f"{conv_id:<36} | {str(messages_count):<15} | {str(message_count):<15} {status}")
    
    print("=" * 80)
    
    # Test the sync logic (simulating what get_conversations does)
    print("\n🔄 Testing synchronization logic:\n")
    
    for conv in conversations[:3]:  # Test first 3
        conv_id = conv.get('id', 'N/A')[:20]
        messages_count = conv.get('messages_count', 0)
        message_count_before = conv.get('message_count', 0)
        
        # Apply the same sync logic as in get_conversations
        if "messages_count" in conv and conv["messages_count"] > 0:
            message_count_after = conv["messages_count"]
        elif "message_count" not in conv:
            message_count_after = 0
        else:
            message_count_after = conv.get("message_count", 0)
        
        print(f"Conversation: {conv_id}")
        print(f"  messages_count (DB): {messages_count}")
        print(f"  message_count (before sync): {message_count_before}")
        print(f"  message_count (after sync): {message_count_after}")
        print(f"  Status: {'✅ Synced' if message_count_after == messages_count else '❌ Not synced'}\n")
    
    # Close connection
    client.close()
    
    print("✅ Test complete!")

if __name__ == "__main__":
    asyncio.run(test_message_count_sync())
