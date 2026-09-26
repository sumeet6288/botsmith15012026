# BotSmith Calendly Tool Foundation

Files:
- `service.py` — Calendly API client.
- `tools.py` — three structured BotSmith tools.
- `__init__.py` — package exports.

Tools:
- `calendly_get_event_types`
- `calendly_get_available_times`
- `calendly_book_meeting`

OAuth is intentionally not included in this package yet. The access token must
come from BotSmith's authenticated integration layer and must never be supplied
by the model as a tool argument.

`calendly_book_meeting` is marked `high` risk because it creates an external
calendar event. Approval enforcement should be added before production booking.

Next:
1. Calendly OAuth endpoints.
2. Secure per-user/per-chatbot credential storage.
3. Server-side credential resolution.
4. ToolRegistry registration.
5. Structured tool-call execution in AgentRuntime.
6. Approval enforcement for booking.
