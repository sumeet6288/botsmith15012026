import asyncio
from html import escape
import logging
import os
from datetime import datetime

import resend

logger = logging.getLogger(__name__)


async def send_lead_alert(
    recipient: str,
    chatbot_name: str,
    lead_name: str,
    lead_phone: str,
    created_at: datetime,
) -> None:
    api_key = os.getenv("RESEND_API_KEY")
    from_email = os.getenv("RESEND_FROM_EMAIL")
    if not api_key or not from_email:
        raise RuntimeError("Resend email configuration is incomplete")

    resend.api_key = api_key
    await asyncio.to_thread(
        resend.Emails.send,
        {
            "from": from_email,
            "to": [recipient],
            "subject": f"New lead captured for {chatbot_name}",
            "html": (
                f"<h2>New BotSmith lead</h2>"
                f"<p><strong>Chatbot:</strong> {escape(chatbot_name)}</p>"
                f"<p><strong>Name:</strong> {escape(lead_name)}</p>"
                f"<p><strong>Phone:</strong> {escape(lead_phone)}</p>"
                f"<p><strong>Captured at:</strong> {escape(created_at.isoformat())}</p>"
            ),
        },
    )
    logger.info("Lead alert email sent for chatbot %s", chatbot_name)
