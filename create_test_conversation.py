#!/usr/bin/env python3
"""
Create test conversation with messages to verify message count fix
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from datetime import datetime, timezone
import uuid

load_dotenv('/app/backend/.env')

async def create_test_conversation():
    """Create a test conversation with messages"""
    
    # Connect to MongoDB
    mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.getenv('DB_NAME', 'chatbase_db')
    
    print(f"🔌 Connecting to MongoDB at {mongo_url}")
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # Get first chatbot
    chatbot = await db.chatbots.find_one()
    
    if not chatbot:
        print("❌ No chatbots found. Please create a chatbot first.")
        client.close()
        return
    
    chatbot_id = chatbot['id']
    print(f"✅ Found chatbot: {chatbot.get('name', 'Unknown')} (ID: {chatbot_id})")
    
    # Create a test conversation with messages_count field
    conversation_id = str(uuid.uuid4())
    session_id = str(uuid.uuid4())
    
    conversation = {
        'id': conversation_id,
        'chatbot_id': chatbot_id,
        'session_id': session_id,
        'user_name': 'Anonymous User',
        'user_email': None,
        'status': 'active',
        'rating': None,
        'created_at': datetime.now(timezone.utc),
        'updated_at': datetime.now(timezone.utc),
        'message_count': 0,  # Old field (should show 0)
        'messages_count': 4  # New field (incremented by backend)
    }
    
    print(f"\n📝 Creating test conversation...")
    print(f"   Conversation ID: {conversation_id}")
    print(f"   message_count: {conversation['message_count']}")
    print(f"   messages_count: {conversation['messages_count']}")
    
    await db.conversations.insert_one(conversation)
    
    # Create test messages
    messages = [
        {
            'id': str(uuid.uuid4()),
            'conversation_id': conversation_id,
            'chatbot_id': chatbot_id,
            'role': 'user',
            'content': 'Hello, I need help!',
            'source': 'dashboard',
            'timestamp': datetime.now(timezone.utc)
        },
        {
            'id': str(uuid.uuid4()),
            'conversation_id': conversation_id,
            'chatbot_id': chatbot_id,
            'role': 'assistant',
            'content': 'Hello! How can I assist you today?',
            'source': 'dashboard',
            'timestamp': datetime.now(timezone.utc)
        },
        {
            'id': str(uuid.uuid4()),
            'conversation_id': conversation_id,
            'chatbot_id': chatbot_id,
            'role': 'user',
            'content': 'What are your business hours?',
            'source': 'dashboard',
            'timestamp': datetime.now(timezone.utc)
        },
        {
            'id': str(uuid.uuid4()),
            'conversation_id': conversation_id,
            'chatbot_id': chatbot_id,
            'role': 'assistant',
            'content': 'We are open Monday to Friday, 9 AM to 5 PM.',
            'source': 'dashboard',
            'timestamp': datetime.now(timezone.utc)
        }
    ]
    
    await db.messages.insert_many(messages)
    print(f"✅ Created {len(messages)} messages in conversation")
    
    # Verify the conversation
    print("\n📊 Verifying conversation in database:")
    conv = await db.conversations.find_one({'id': conversation_id})
    print(f"   message_count (before sync): {conv.get('message_count', 'MISSING')}")
    print(f"   messages_count (actual count): {conv.get('messages_count', 'MISSING')}")
    
    # Simulate the sync logic from get_conversations
    if "messages_count" in conv and conv["messages_count"] > 0:
        synced_count = conv["messages_count"]
    else:
        synced_count = conv.get("message_count", 0)
    
    print(f"   message_count (after sync): {synced_count}")
    print(f"\n✅ Test conversation created successfully!")
    print(f"\n💡 Now test the API:")
    print(f"   GET /api/chat/conversations/{chatbot_id}")
    print(f"   Expected: message_count = {synced_count} (synced from messages_count)")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(create_test_conversation())
