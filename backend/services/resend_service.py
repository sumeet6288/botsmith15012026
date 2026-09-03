import asyncio
from html import escape
import logging
import os
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

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

    safe_chatbot_name = escape(chatbot_name)
    safe_lead_name = escape(lead_name)
    safe_lead_phone = escape(lead_phone)

    # Lead timestamps are stored in UTC. Convert them to India Standard
    # Time before displaying them in the email, so the email matches the
    # dashboard time shown to users in India.
    #
    # If the datetime is timezone-naive, treat it as UTC because the
    # database timestamp is stored in UTC.
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)

    india_time = created_at.astimezone(ZoneInfo("Asia/Kolkata"))

    safe_created_at = escape(
        india_time.strftime("%d %B %Y, %I:%M %p")
    )

    email_html = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New BotSmith Lead</title>
    </head>

    <body style="
        margin:0;
        padding:40px 16px;
        background:#f3f5f9;
        font-family:Arial, Helvetica, sans-serif;
        color:#172033;
    ">

        <div style="
            max-width:680px;
            margin:0 auto 14px;
            color:#7b8496;
            font-size:12px;
            letter-spacing:1px;
            text-transform:uppercase;
            font-weight:bold;
        ">
            BotSmith Email Notification
        </div>

        <div style="
            max-width:680px;
            margin:0 auto;
            background:#ffffff;
            border:1px solid #e6eaf0;
            border-radius:18px;
            overflow:hidden;
        ">

            <!-- Top gradient -->
            <div style="
                height:7px;
                background:linear-gradient(90deg,#635bff,#8b5cf6,#22c55e);
            "></div>

            <!-- Header -->
            <div style="
                padding:30px 38px 26px;
                border-bottom:1px solid #edf0f5;
            ">

                <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                        <td>
                            <table cellpadding="0" cellspacing="0">
                                <tr>
                                    <td style="
                                        width:40px;
                                        height:40px;
                                        background:#635bff;
                                        border-radius:12px;
                                        text-align:center;
                                        vertical-align:middle;
                                        color:#ffffff;
                                        font-size:22px;
                                        font-weight:bold;
                                    ">
                                        ✦
                                    </td>

                                    <td style="
                                        padding-left:12px;
                                        font-size:21px;
                                        font-weight:bold;
                                        color:#111827;
                                    ">
                                        BotSmith
                                    </td>
                                </tr>
                            </table>
                        </td>

                        <td align="right">
                            <span style="
                                display:inline-block;
                                padding:7px 12px;
                                border-radius:999px;
                                background:#f0fdf4;
                                border:1px solid #bbf7d0;
                                color:#15803d;
                                font-size:12px;
                                font-weight:bold;
                            ">
                                ● New lead
                            </span>
                        </td>
                    </tr>
                </table>

            </div>

            <!-- Main content -->
            <div style="padding:38px;">

                <div style="
                    color:#635bff;
                    font-size:12px;
                    font-weight:bold;
                    text-transform:uppercase;
                    letter-spacing:2px;
                    margin-bottom:12px;
                ">
                    Lead notification
                </div>

                <h1 style="
                    margin:0;
                    font-size:31px;
                    line-height:1.2;
                    letter-spacing:-1px;
                    color:#111827;
                ">
                    You have a new potential student.
                </h1>

                <p style="
                    margin:14px 0 28px;
                    color:#667085;
                    font-size:15px;
                    line-height:1.7;
                ">
                    Someone just submitted their details through your chatbot.
                    Here is the information your counselling team needs to follow up.
                </p>

                <!-- Lead card -->
                <div style="
                    border:1px solid #e7eaf0;
                    border-radius:15px;
                    overflow:hidden;
                    margin-bottom:25px;
                ">

                    <div style="
                        padding:15px 20px;
                        background:#fafbfc;
                        border-bottom:1px solid #e7eaf0;
                        font-size:13px;
                        font-weight:bold;
                        color:#344054;
                    ">
                        Lead information
                    </div>

                    <div style="padding:7px 20px;">

                        <!-- Chatbot -->
                        <table width="100%" cellpadding="0" cellspacing="0"
                            style="border-bottom:1px solid #f0f2f5;">
                            <tr>
                                <td style="
                                    padding:17px 0;
                                    color:#98a2b3;
                                    font-size:14px;
                                ">
                                    Chatbot
                                </td>
                                <td align="right" style="
                                    padding:17px 0;
                                    color:#1d2939;
                                    font-size:14px;
                                    font-weight:bold;
                                ">
                                    {safe_chatbot_name}
                                </td>
                            </tr>
                        </table>

                        <!-- Name -->
                        <table width="100%" cellpadding="0" cellspacing="0"
                            style="border-bottom:1px solid #f0f2f5;">
                            <tr>
                                <td style="
                                    padding:17px 0;
                                    color:#98a2b3;
                                    font-size:14px;
                                ">
                                    Name
                                </td>
                                <td align="right" style="
                                    padding:17px 0;
                                    color:#1d2939;
                                    font-size:14px;
                                    font-weight:bold;
                                ">
                                    {safe_lead_name}
                                </td>
                            </tr>
                        </table>

                        <!-- Phone -->
                        <table width="100%" cellpadding="0" cellspacing="0"
                            style="border-bottom:1px solid #f0f2f5;">
                            <tr>
                                <td style="
                                    padding:17px 0;
                                    color:#98a2b3;
                                    font-size:14px;
                                ">
                                    Phone number
                                </td>
                                <td align="right" style="
                                    padding:17px 0;
                                    color:#635bff;
                                    font-size:14px;
                                    font-weight:bold;
                                ">
                                    {safe_lead_phone}
                                </td>
                            </tr>
                        </table>

                        <!-- Captured time -->
                        <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                                <td style="
                                    padding:17px 0;
                                    color:#98a2b3;
                                    font-size:14px;
                                ">
                                    Captured at
                                </td>
                                <td align="right" style="
                                    padding:17px 0;
                                    color:#1d2939;
                                    font-size:14px;
                                    font-weight:bold;
                                ">
                                    {safe_created_at}
                                </td>
                            </tr>
                        </table>

                    </div>
                </div>

                <!-- Reminder note -->
                <div style="
                    margin-top:0;
                    padding:15px 17px;
                    border-radius:10px;
                    background:#f8f9fc;
                    color:#667085;
                    font-size:12px;
                    line-height:1.6;
                ">
                    This notification was generated automatically by BotSmith.
                    Please contact the lead promptly while their enquiry is fresh.
                </div>

            </div>

            <!-- Footer -->
            <div style="
                padding:23px 38px 30px;
                background:#fafbfc;
                border-top:1px solid #edf0f5;
                color:#98a2b3;
                font-size:11px;
                line-height:1.7;
            ">
                BotSmith · AI-powered conversations that turn enquiries into opportunities.
                <br>
                You are receiving this email because lead alerts are enabled for this chatbot.
            </div>

        </div>

    </body>
    </html>
    """

    await asyncio.to_thread(
        resend.Emails.send,
        {
            "from": from_email,
            "to": [recipient],
            "subject": f"New lead captured for {chatbot_name}",
            "html": email_html,
        },
    )

    logger.info(
        "Lead alert email sent for chatbot %s",
        chatbot_name,
    )