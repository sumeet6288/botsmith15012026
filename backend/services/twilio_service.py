import httpx
import logging
from typing import Dict, Optional

logger = logging.getLogger(__name__)


class TwilioService:
    """Service for handling Twilio SMS API interactions (per-tenant credentials)."""

    def __init__(self, account_sid: str, auth_token: str, from_number: Optional[str] = None):
        self.account_sid = account_sid
        self.auth_token = auth_token
        self.from_number = from_number
        self.base_url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}"
        self.client = httpx.AsyncClient(timeout=30.0, auth=(account_sid, auth_token))

    async def close(self):
        """Close the HTTP client"""
        await self.client.aclose()

    async def verify_credentials(self) -> Dict:
        """Validate Account SID + Auth Token by fetching the account resource."""
        try:
            response = await self.client.get(f"{self.base_url}.json")
            if response.status_code == 200:
                data = response.json()
                return {
                    "success": True,
                    "friendly_name": data.get("friendly_name"),
                    "status": data.get("status"),
                }
            return {"success": False, "error": f"Invalid credentials (HTTP {response.status_code})"}
        except Exception as e:
            logger.error(f"Error verifying Twilio credentials: {str(e)}")
            return {"success": False, "error": str(e)}

    async def send_sms(self, to: str, body: str, from_number: Optional[str] = None) -> Dict:
        """Send an SMS message via the Twilio REST API."""
        try:
            sender = from_number or self.from_number
            if not sender:
                return {"success": False, "error": "Missing Twilio 'from' phone number"}

            payload = {"To": to, "From": sender, "Body": body[:1600]}
            response = await self.client.post(f"{self.base_url}/Messages.json", data=payload)
            if response.status_code in (200, 201):
                return {"success": True, "data": response.json()}
            return {"success": False, "error": response.text}
        except Exception as e:
            logger.error(f"Error sending Twilio SMS: {str(e)}")
            return {"success": False, "error": str(e)}
