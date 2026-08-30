# BotSmith — PRD / Working Notes

BotSmith is an AI chatbot builder (FastAPI + React + MongoDB) with multi-provider
AI, file/website ingestion (RAG), analytics, integrations, and Razorpay-based
subscriptions (Free / Starter / Professional / Enterprise).

## Recent work

### 2026-06 — Renewal payment-bypass bug FIX (DONE)
Problem: Expired PAID subscriptions could be renewed for 30 days with no payment.
"Renew Now" called POST /api/plans/renew which directly set status=active and
extended expires_at — no Razorpay, no payment verification.

Fix (renewal scope only — verified in preview):
- Frontend: `Subscription.jsx` (handleRenewSubscription) and
  `SubscriptionExpiredModal.jsx` (handleRenew) now call
  POST /api/razorpay/create-subscription and open the returned checkout_url.
  Removed the false "renewed for 30 days" alert.
- Backend: `routers/plans.py` POST /plans/renew now returns HTTP 402 for any
  paid plan (no activation); only the free plan renews here.
- Backend (defense-in-depth): `services/plan_service.py` renew_subscription()
  raises ValueError for paid plans.
- Verified: paid /plans/renew returns 402 with expires_at unchanged; free renew works.
Status: CONFIRMED SOLVED by user on preview. Needs production redeploy to go live.

### 2026-07 — AI models restored + Twilio SMS integration (DONE, preview)
- Restored full AI model list (OpenAI/Anthropic/Gemini) in `frontend/src/utils/models.js`
  and `backend/services/chat_service.py`. Verified all 3 providers respond via chat endpoint.
- Added Twilio SMS to chatbot integrations (per-tenant creds, mirrors Telegram/WhatsApp):
  - New: `backend/services/twilio_service.py`, `backend/routers/twilio.py`
    (POST /api/twilio/webhook/{chatbot_id} inbound SMS; POST /api/twilio/{id}/setup-webhook).
  - Edited: `models.py` (added "twilio" to Integration Literals), `integrations.py`
    (twilio test-connection branch), `server.py` (import+mount), `ChatbotIntegrations.jsx`
    (Twilio SMS card + setup-webhook button). No new dependency (httpx REST).
  - Verified: create/setup-webhook/test(graceful 401)/delete/inbound-webhook + UI card renders.

### 2026-08 — Lead Captured tab (widget lead persistence) DONE
- New `chatbot_leads` collection (separate from existing CRM `leads`).
- models.py: ChatbotLead / ChatbotLeadCreate / ChatbotLeadResponse.
- leads.py: POST /api/public/lead/{chatbot_id} (public capture, validates chatbot,
  15s dedup) + GET /api/chatbot-leads/{chatbot_id} (authed, ownership-checked, newest first).
- fast-widget.js: lead form now POSTs to backend (best-effort, non-blocking) instead of
  window/console only.
- ChatbotBuilder.jsx: added "Lead Captured" tab (last, after Integrations, Users icon);
  new component LeadCaptured.jsx (table Name|Number|Date&Time, loading/empty states).
- Verified: capture 200, dedup, 404 invalid chatbot, 400 missing fields, owner sees lead,
  cross-user 404, unauth 403, UI renders.

## Known open issues (separately scoped — NOT yet fixed, user deferred)
- P0: Entire admin API is UNAUTHENTICATED (admin_subscriptions, admin_users,
  admin_users_enhanced, admin, admin_chatbots, admin_settings, admin_leads,
  tech_management, payment_settings). Anonymous callers can grant plans,
  lifetime access, escalate roles, impersonate users.
- P1: POST /api/plans/upgrade activates any paid plan with no payment.
- P1: Razorpay cancel/pause/resume-subscription endpoints have no auth (IDOR/DoS).
- P1: payment-callback replay (attacker-controlled payment_id bypasses idempotency).
- P2: Razorpay webhook_secret is only 9 chars (weak); rotate to long random secret.
- Cleanup: dead/unmounted routers razorpay_payment.py, razorpay_sync_fix.py,
  razorpay.py.backup; many *.old.jsx duplicate pages.
