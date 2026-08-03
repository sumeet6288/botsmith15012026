from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
from services.twilio_service import TwilioService
from services.chat_service import ChatService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/twilio", tags=["twilio"])

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'chatbase_db')
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'


class TwilioWebhookSetup(BaseModel):
    base_url: Optional[str] = None


async def get_integration_by_chatbot(chatbot_id: str) -> Optional[dict]:
    """Get enabled Twilio integration for a chatbot"""
    return await db.integrations.find_one({
        "chatbot_id": chatbot_id,
        "integration_type": "twilio",
        "enabled": True
    })


async def process_twilio_message(chatbot_id: str, from_number: str, to_number: str, message_text: str):
    """Process an inbound SMS and reply via Twilio."""
    try:
        chatbot = await db.chatbots.find_one({"id": chatbot_id})
        if not chatbot:
            logger.error(f"Chatbot not found: {chatbot_id}")
            return

        integration = await get_integration_by_chatbot(chatbot_id)
        if not integration:
            logger.error(f"Twilio integration not found for chatbot: {chatbot_id}")
            return

        creds = integration.get('credentials', {})
        account_sid = creds.get('account_sid')
        auth_token = creds.get('auth_token')
        twilio_number = creds.get('phone_number') or to_number
        if not account_sid or not auth_token:
            logger.error(f"Twilio credentials missing for chatbot: {chatbot_id}")
            return

        twilio_service = TwilioService(account_sid, auth_token, twilio_number)

        # Chatbot must be active
        if chatbot.get("status") != "active":
            await twilio_service.send_sms(
                to=from_number,
                body="This chatbot is currently inactive. Please contact the owner to activate it.",
            )
            await twilio_service.close()
            return

        # Message limit check
        user_id = chatbot.get('user_id')
        if user_id:
            from services.plan_service import plan_service
            limit_check = await plan_service.check_limit(user_id, "messages")
            if limit_check.get("reached"):
                await twilio_service.send_sms(
                    to=from_number,
                    body=(
                        f"Message limit reached ({limit_check['current']}/{limit_check['max']} this month). "
                        f"Please upgrade your plan to continue."
                    ),
                )
                await twilio_service.close()
                return

        session_id = f"twilio_{from_number}"

        # Get or create conversation
        conversation = await db.conversations.find_one({
            "chatbot_id": chatbot_id,
            "session_id": session_id
        })
        if not conversation:
            conversation_id = str(uuid.uuid4())
            conversation = {
                "id": conversation_id,
                "chatbot_id": chatbot_id,
                "session_id": session_id,
                "user_name": from_number,
                "user_email": f"twilio_{from_number}",
                "status": "active",
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
                "message_count": 0,
                "platform": "twilio"
            }
            await db.conversations.insert_one(conversation)
        else:
            conversation_id = conversation['id']

        # Save user message
        await db.messages.insert_one({
            "id": str(uuid.uuid4()),
            "conversation_id": conversation_id,
            "chatbot_id": chatbot_id,
            "role": "user",
            "content": message_text,
            "source": "twilio",
            "timestamp": datetime.now(timezone.utc)
        })

        # Knowledge base context
        context = ""
        sources = await db.sources.find({"chatbot_id": chatbot_id, "status": "completed"}).to_list(length=None)
        if sources:
            from services.vector_store import VectorStore
            vector_store = VectorStore()
            relevant_chunks = await vector_store.search(chatbot_id=chatbot_id, query=message_text, top_k=2)
            if relevant_chunks:
                context = "\n\n".join([chunk['text'] for chunk in relevant_chunks])

        # Generate AI response
        chat_service = ChatService()
        system_message = chatbot.get('system_message') or chatbot.get('instructions') or 'You are a helpful AI assistant.'
        ai_response_tuple = await chat_service.generate_response(
            message=message_text,
            session_id=session_id,
            system_message=system_message,
            model=chatbot.get('model', 'gpt-4o-mini'),
            provider=chatbot.get('provider', 'openai'),
            context=context
        )
        ai_response = ai_response_tuple[0] if isinstance(ai_response_tuple, tuple) else ai_response_tuple

        # Save assistant message
        await db.messages.insert_one({
            "id": str(uuid.uuid4()),
            "conversation_id": conversation_id,
            "chatbot_id": chatbot_id,
            "role": "assistant",
            "content": ai_response,
            "source": "twilio",
            "timestamp": datetime.now(timezone.utc)
        })

        await db.conversations.update_one(
            {"id": conversation_id},
            {"$set": {"updated_at": datetime.now(timezone.utc)}, "$inc": {"message_count": 2}}
        )
        await db.chatbots.update_one({"id": chatbot_id}, {"$inc": {"messages_count": 2}})

        if user_id:
            from services.plan_service import plan_service
            await plan_service.increment_usage(user_id, "messages", 2)

        # Send reply
        result = await twilio_service.send_sms(to=from_number, body=ai_response)
        await twilio_service.close()

        await db.integration_logs.insert_one({
            "chatbot_id": chatbot_id,
            "integration_id": integration['id'],
            "integration_type": "twilio",
            "event_type": "message_processed",
            "status": "success" if result.get('success') else "failure",
            "message": f"Processed SMS from {from_number}",
            "metadata": {"from": from_number, "message_length": len(message_text)},
            "timestamp": datetime.now(timezone.utc)
        })

    except Exception as e:
        logger.error(f"Error processing Twilio message: {str(e)}")


@router.post("/webhook/{chatbot_id}")
async def twilio_webhook(chatbot_id: str, request: Request, background_tasks: BackgroundTasks):
    """Receive inbound SMS from Twilio (application/x-www-form-urlencoded)."""
    try:
        form = await request.form()
        from_number = form.get("From")
        to_number = form.get("To")
        body = (form.get("Body") or "").strip()

        if from_number and body:
            background_tasks.add_task(
                process_twilio_message, chatbot_id, from_number, to_number, body
            )

        # Respond with empty TwiML; the reply is sent via REST API in the background
        return Response(content=EMPTY_TWIML, media_type="application/xml")
    except Exception as e:
        logger.error(f"Error processing Twilio webhook: {str(e)}")
        return Response(content=EMPTY_TWIML, media_type="application/xml")


@router.post("/{chatbot_id}/setup-webhook")
async def setup_twilio_webhook(chatbot_id: str, setup: TwilioWebhookSetup):
    """Return the webhook URL to configure in the Twilio console."""
    integration = await db.integrations.find_one({
        "chatbot_id": chatbot_id,
        "integration_type": "twilio"
    })
    if not integration:
        raise HTTPException(status_code=404, detail="Twilio integration not found")

    base_url = setup.base_url or os.environ.get('FRONTEND_URL', 'https://botsmith.pro')
    base_url = base_url.rstrip('/')
    webhook_url = f"{base_url}/api/twilio/webhook/{chatbot_id}"

    await db.integrations.update_one(
        {"id": integration['id']},
        {"$set": {"webhook_url": webhook_url, "webhook_configured": True, "updated_at": datetime.now(timezone.utc)}}
    )

    return {
        "success": True,
        "webhook_url": webhook_url,
        "instructions": [
            "1. Open the Twilio Console -> Phone Numbers -> Manage -> Active numbers.",
            "2. Click your SMS-enabled Twilio number.",
            "3. Under 'Messaging' -> 'A message comes in', set method to HTTP POST.",
            f"4. Paste this webhook URL: {webhook_url}",
            "5. Save. Send an SMS to your Twilio number to test.",
        ]
    }
