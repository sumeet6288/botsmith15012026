"""Backend tests for Lead Capture toggle feature (lead_capture_enabled)."""
import os
import time
import uuid

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")
API = f"{BASE_URL}/api"

EMAIL = "sumeetemail26@gmail.com"
PASSWORD = "Test@1234"
CHATBOT_ID = "fae98b6e-472c-4a1d-9dec-ba659d8029c2"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def token(session):
    r = session.post(f"{API}/auth/login", json={"email": EMAIL, "password": PASSWORD}, timeout=60)
    if r.status_code != 200:
        pytest.fail(f"Login failed {r.status_code}: {r.text[:300]}")
    data = r.json()
    tok = data.get("access_token") or data.get("token")
    assert tok, f"No access_token in login response: {data}"
    return tok


@pytest.fixture(scope="session")
def auth(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- Health / basics ----------
class TestHealth:
    def test_api_root_or_health(self, session):
        r = session.get(f"{API}/health", timeout=60)
        assert r.status_code in (200, 404), r.text[:200]


# ---------- Chatbot lead_capture_enabled field ----------
class TestLeadCaptureField:
    def test_get_chatbot_has_field(self, session, auth):
        r = session.get(f"{API}/chatbots/{CHATBOT_ID}", headers=auth, timeout=60)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert "lead_capture_enabled" in data
        assert isinstance(data["lead_capture_enabled"], bool)
        assert "_id" not in data

    def test_list_chatbots_has_field(self, session, auth):
        r = session.get(f"{API}/chatbots", headers=auth, timeout=60)
        assert r.status_code == 200, r.text[:300]
        bots = r.json()
        assert isinstance(bots, list) and len(bots) > 0
        for b in bots:
            assert "lead_capture_enabled" in b, f"missing on {b.get('id')}"
            assert "_id" not in b

    def test_public_chatbot_has_field(self, session):
        r = session.get(f"{API}/public/chatbot/{CHATBOT_ID}", timeout=60)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert "lead_capture_enabled" in data
        assert "_id" not in data


# ---------- Toggle persistence + cache invalidation ----------
class TestToggleFlow:
    def test_toggle_off_persists_and_public_reflects(self, session, auth):
        r = session.put(f"{API}/chatbots/{CHATBOT_ID}", headers=auth,
                        json={"lead_capture_enabled": False}, timeout=60)
        assert r.status_code == 200, r.text[:300]
        assert r.json()["lead_capture_enabled"] is False

        g = session.get(f"{API}/chatbots/{CHATBOT_ID}", headers=auth, timeout=60)
        assert g.status_code == 200
        assert g.json()["lead_capture_enabled"] is False, "not persisted in DB"

        p = session.get(f"{API}/public/chatbot/{CHATBOT_ID}", timeout=60)
        assert p.status_code == 200
        assert p.json()["lead_capture_enabled"] is False, "public cache not invalidated"

    def test_toggle_on_persists_and_public_reflects(self, session, auth):
        r = session.put(f"{API}/chatbots/{CHATBOT_ID}", headers=auth,
                        json={"lead_capture_enabled": True}, timeout=60)
        assert r.status_code == 200, r.text[:300]
        assert r.json()["lead_capture_enabled"] is True

        g = session.get(f"{API}/chatbots/{CHATBOT_ID}", headers=auth, timeout=60)
        assert g.json()["lead_capture_enabled"] is True

        p = session.get(f"{API}/public/chatbot/{CHATBOT_ID}", timeout=60)
        assert p.json()["lead_capture_enabled"] is True

    def test_toggle_does_not_change_other_fields(self, session, auth):
        before = session.get(f"{API}/chatbots/{CHATBOT_ID}", headers=auth, timeout=60).json()
        session.put(f"{API}/chatbots/{CHATBOT_ID}", headers=auth,
                    json={"lead_capture_enabled": False}, timeout=60)
        after = session.get(f"{API}/chatbots/{CHATBOT_ID}", headers=auth, timeout=60).json()
        for key in ("name", "status", "primary_color", "welcome_message", "user_id"):
            if key in before:
                assert before[key] == after.get(key), f"{key} changed unexpectedly"
        # restore
        session.put(f"{API}/chatbots/{CHATBOT_ID}", headers=auth,
                    json={"lead_capture_enabled": True}, timeout=60)

    def test_active_status_toggle_still_works(self, session, auth):
        """Regression: PATCH /toggle (different feature) unaffected."""
        before = session.get(f"{API}/chatbots/{CHATBOT_ID}", headers=auth, timeout=60).json()
        r = session.patch(f"{API}/chatbots/{CHATBOT_ID}/toggle", headers=auth, timeout=60)
        assert r.status_code == 200, r.text[:300]
        assert r.json()["status"] != before["status"]
        assert r.json()["lead_capture_enabled"] == before["lead_capture_enabled"]
        # restore
        r2 = session.patch(f"{API}/chatbots/{CHATBOT_ID}/toggle", headers=auth, timeout=60)
        assert r2.json()["status"] == before["status"]


# ---------- Security ----------
class TestSecurity:
    def test_put_requires_auth(self, session):
        r = requests.put(f"{API}/chatbots/{CHATBOT_ID}",
                         json={"lead_capture_enabled": False}, timeout=60)
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}: {r.text[:200]}"

    def test_put_invalid_token(self, session):
        r = requests.put(f"{API}/chatbots/{CHATBOT_ID}",
                         headers={"Authorization": "Bearer invalid.token.here"},
                         json={"lead_capture_enabled": False}, timeout=60)
        assert r.status_code in (401, 403), f"got {r.status_code}"

    def test_put_nonexistent_chatbot(self, session, auth):
        r = session.put(f"{API}/chatbots/{uuid.uuid4()}", headers=auth,
                        json={"lead_capture_enabled": False}, timeout=60)
        assert r.status_code in (403, 404), f"got {r.status_code}: {r.text[:200]}"

    def test_public_chatbot_invalid_id(self, session):
        r = session.get(f"{API}/public/chatbot/{uuid.uuid4()}", timeout=60)
        assert r.status_code == 404, f"got {r.status_code}"


# ---------- Lead submission + listing ----------
class TestLeads:
    created = []

    def test_public_lead_submit_and_listed(self, session, auth):
        name = f"TEST_lead_{uuid.uuid4().hex[:6]}"
        phone = "9" + str(int(time.time()))[-9:]
        r = session.post(f"{API}/public/lead/{CHATBOT_ID}",
                         json={"name": name, "phone": phone}, timeout=60)
        assert r.status_code in (200, 201), r.text[:300]
        lead = r.json()
        assert lead["name"] == name
        assert lead["phone"] == phone
        assert "id" in lead and "created_at" in lead
        assert "_id" not in lead
        TestLeads.created.append(lead["id"])

        lst = session.get(f"{API}/chatbot-leads/{CHATBOT_ID}", headers=auth, timeout=60)
        assert lst.status_code == 200, lst.text[:300]
        rows = lst.json()
        assert any(x["id"] == lead["id"] for x in rows), "submitted lead not in dashboard list"
        for x in rows:
            assert "_id" not in x
            assert {"name", "phone", "created_at"} <= set(x.keys())

    def test_lead_submit_when_capture_disabled(self, session, auth):
        """Backend should not hard-block; frontend controls form visibility."""
        session.put(f"{API}/chatbots/{CHATBOT_ID}", headers=auth,
                    json={"lead_capture_enabled": False}, timeout=60)
        r = session.post(f"{API}/public/lead/{CHATBOT_ID}",
                         json={"name": "TEST_disabled", "phone": "9000000001"}, timeout=60)
        assert r.status_code in (200, 201, 400, 403), f"unexpected {r.status_code}: {r.text[:200]}"
        if r.status_code in (200, 201):
            TestLeads.created.append(r.json()["id"])
        session.put(f"{API}/chatbots/{CHATBOT_ID}", headers=auth,
                    json={"lead_capture_enabled": True}, timeout=60)

    def test_chatbot_leads_requires_auth(self, session):
        r = requests.get(f"{API}/chatbot-leads/{CHATBOT_ID}", timeout=60)
        assert r.status_code in (401, 403), f"got {r.status_code}"

    def test_lead_validation(self, session):
        r = session.post(f"{API}/public/lead/{CHATBOT_ID}", json={"name": ""}, timeout=60)
        assert r.status_code in (400, 422), f"got {r.status_code}: {r.text[:200]}"


# ---------- Regression: public chat still works ----------
class TestChatRegression:
    def test_public_chat_response(self, session):
        r = session.post(f"{API}/public/chat/{CHATBOT_ID}",
                         json={"message": "Hello", "session_id": f"TEST_{uuid.uuid4().hex[:8]}"},
                         timeout=120)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert data.get("message"), f"empty AI response: {data}"
        assert data.get("session_id")
