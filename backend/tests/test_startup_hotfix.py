"""Hotfix verification: backend imports cleanly (resend dependency) + core auth/chatbot health."""
import importlib
import os
import subprocess

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing from env and /app/frontend/.env")
BASE_URL = base_url.rstrip("/")
API = f"{BASE_URL}/api"

EMAIL = "sumeetemail26@gmail.com"
PASSWORD = "Test@1234"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth(session):
    r = session.post(f"{API}/auth/login", json={"email": EMAIL, "password": PASSWORD}, timeout=60)
    if r.status_code != 200:
        pytest.fail(f"Login failed {r.status_code}: {r.text[:300]}")
    tok = r.json().get("access_token") or r.json().get("token")
    if not tok:
        pytest.fail(f"No access_token in login response: {r.json()}")
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ---------- Dependency / import health (the actual bug) ----------
class TestImportHealth:
    def test_resend_module_installed(self):
        mod = importlib.import_module("resend")
        assert mod is not None
        ver = subprocess.run(
            ["python", "-m", "pip", "show", "resend"], capture_output=True, text=True
        ).stdout
        assert "2.21.0" in ver, f"unexpected resend version info: {ver[:200]}"

    def test_resend_service_and_leads_router_import(self):
        import sys
        sys.path.insert(0, "/app/backend")
        importlib.import_module("services.resend_service")
        importlib.import_module("routers.leads")

    def test_backend_err_log_has_no_import_errors_after_restart(self):
        out = subprocess.run(
            ["tail", "-n", "80", "/var/log/supervisor/backend.err.log"],
            capture_output=True, text=True,
        ).stdout
        assert "ModuleNotFoundError" not in out, "ModuleNotFoundError still present in recent logs"
        assert "Application startup complete" in out, "app did not report startup complete"


# ---------- App actually loaded (not just process alive) ----------
class TestAppLoaded:
    def test_api_root_200(self, session):
        r = session.get(f"{API}/", timeout=60)
        assert r.status_code == 200, r.text[:300]

    def test_openapi_includes_leads_routes(self, session):
        r = session.get(f"{API}/openapi.json", timeout=60)
        if r.status_code != 200 or "json" not in r.headers.get("content-type", ""):
            pytest.skip("openapi.json not exposed through the /api ingress route")
        paths = r.json().get("paths", {})
        assert any("/public/lead/" in p for p in paths), "leads router routes missing"


# ---------- Core auth flow ----------
class TestAuthFlow:
    def test_login_and_me(self, session, auth):
        r = session.get(f"{API}/auth/me", headers=auth, timeout=60)
        assert r.status_code == 200, r.text[:300]
        me = r.json()
        assert me.get("email") == EMAIL
        assert "_id" not in me

    def test_me_requires_token(self, session):
        r = requests.get(f"{API}/auth/me", timeout=60)
        assert r.status_code in (401, 403), f"got {r.status_code}"

    def test_login_wrong_password(self, session):
        r = session.post(f"{API}/auth/login", json={"email": EMAIL, "password": "wrong-pass"}, timeout=60)
        assert r.status_code in (400, 401), f"got {r.status_code}: {r.text[:200]}"


# ---------- Chatbot CRUD reachable ----------
class TestChatbots:
    def test_list_and_detail(self, session, auth):
        r = session.get(f"{API}/chatbots", headers=auth, timeout=60)
        assert r.status_code == 200, r.text[:300]
        bots = r.json()
        assert isinstance(bots, list) and bots, "no chatbots returned for test user"
        bot_id = bots[0]["id"]
        d = session.get(f"{API}/chatbots/{bot_id}", headers=auth, timeout=60)
        assert d.status_code == 200, d.text[:300]
        assert d.json()["id"] == bot_id
        assert "_id" not in d.json()
