Pasted code(20260902-174913).js
JavaScript
do changes in this code and show me in html file 

Done. I took your exact LeadCaptured code and added only the frontend UI for Email Alerts—no backend or Resend integration yet.

Preview

Open the modified HTML preview

React version

I also created the modified LeadCaptured.jsx version:

Download the modified React code

The behavior is:

Email Alerts → click → email input appears → enter email → Save → validation/success message.

I deliberately did not connect Save to your backend yet. This is just the UI stage, as you requested. 

botsmith_email_alerts_modified_preview.html
HTML
LeadCaptured_email_alerts_ui_version.jsx
Code
Pasted text(5).txt
Document
what changes do you made in this code tell me 

I made only the frontend changes for the Email Alerts UI. Your existing lead capture, export, refresh, and lead table logic was left alone.

Specifically, I added:

Two new state variables
showEmailAlerts — controls whether the email settings are visible.
emailAlertAddress — stores what the user types.
Email Alerts button
Added next to the existing Lead Capture switch.
Clicking it opens/closes the email configuration.
Email input
Label: “Send new lead alerts to”
Placeholder: counsellor@example.com
Save button
Added beside the input.
Basic email validation
Empty email → error toast.
Invalid email → error toast.
Valid email → success toast.
Important: Save does NOT save to MongoDB yet.
Right now it only demonstrates the UI and shows a success toast.
Resend is not connected yet.

So currently:

Email Alerts
      ↓
Enter email
      ↓
Save
      ↓
Success message

Next stage would be:

Save
  ↓
Backend
  ↓
MongoDB

And only after that:

New Lead
   ↓
Resend
   ↓
Counsellor Email

That's the safer way to build this feature incrementally.

and what are next steps then 

Absolutely. Give Copilot one master prompt that tells it the complete feature, the order of implementation, and—most importantly—not to touch unrelated BotSmith code.

Copy-paste this into GitHub Copilot:

I want you to implement a new BotSmith feature called:

EMAIL ALERTS FOR NEW LEADS

IMPORTANT:
Before making ANY changes, inspect the existing codebase and understand the current implementation.

Do NOT rewrite, refactor, redesign, or modify unrelated functionality.

Do NOT change:
- Existing Lead Capture behavior
- Lead table
- Lead export functionality
- Refresh functionality
- Chatbot widget behavior
- Authentication
- Existing integrations
- Existing UI styling unless required for this feature
- Existing API behavior unless required for this feature

Use the existing BotSmith architecture and conventions.

The feature should be implemented safely in stages:

==================================================
PART 1 — FRONTEND UI
==================================================

There is already a Lead Capture settings card in:

LeadCaptured.jsx

It currently contains:

Lead Capture
"Require visitors to provide their details before starting a conversation with the AI."

and the existing Lead Capture switch.

I want an "Email Alerts" button/control next to the Lead Capture switch.

The UI should look approximately like:

Lead Capture                                      Email Alerts    [Lead Capture Switch]
Require visitors to provide their details
before starting a conversation with the AI.

When the user clicks "Email Alerts", expand a configuration section underneath.

Show:

Send new lead alerts to

[ counsellor@example.com                         ] [ Save ]

Use the existing BotSmith UI styling, Tailwind classes, buttons, inputs, spacing, borders, colors, and toast system.

Do not redesign the whole card.

The Email Alerts button should only control showing/hiding the email configuration UI.

==================================================
PART 2 — EMAIL INPUT
==================================================

Add an email input.

Requirements:

- type="email"
- Placeholder:
  counsellor@example.com
- Controlled React state
- Validate that the email is not empty
- Validate that the email has a reasonable valid email format
- Show errors using the existing toast system

Do NOT send an email from the frontend.

Do NOT put the Resend API key in the frontend.

==================================================
PART 3 — SAVE EMAIL ALERT CONFIGURATION
==================================================

The Save button must actually save the configuration.

Do NOT leave the Save button as a frontend-only/demo toast.

Use the EXISTING chatbot update API if possible.

The saved configuration belongs to the specific chatbot.

Add these chatbot settings:

email_alerts_enabled
email_alert_address

Example:

email_alerts_enabled: true
email_alert_address: "counsellor@example.com"

The settings must be stored with the chatbot in MongoDB.

Do NOT create a new collection unless the existing architecture absolutely requires it.

Do NOT store the email address inside every lead.

The email belongs to the chatbot configuration.

When the user saves successfully:

Show:

Email Alert Saved

New lead alerts will be sent to counsellor@example.com.

Then refresh/update the chatbot state using the existing onUpdate mechanism if appropriate.

If saving fails:

Show an error toast.

==================================================
PART 4 — BACKEND CHATBOT MODEL
==================================================

Inspect backend/models.py.

Find the existing Chatbot model and ChatbotUpdate model.

Add the minimum required fields:

email_alerts_enabled: bool = False
email_alert_address: Optional[str] = None

Adapt this to the project's actual Pydantic/model conventions.

Do not blindly copy this if the existing model uses a different pattern.

Make sure existing chatbot documents without these fields continue working.

Default:

email_alerts_enabled = false
email_alert_address = null

Do not expose email_alert_address through any PUBLIC chatbot/widget response.

The public chatbot/widget does not need to know the counsellor's email.

==================================================
PART 5 — EXISTING CHATBOT UPDATE API
==================================================

Inspect:

backend/routers/chatbots.py

There is already an authenticated chatbot update endpoint.

Reuse it.

Do NOT create a new settings endpoint if the existing PUT/update endpoint can safely handle these fields.

Maintain the existing ownership/authorization checks.

A user must only be able to update Email Alerts for chatbots they are authorized to manage.

==================================================
PART 6 — RESEND BACKEND INTEGRATION
==================================================

Resend has already been successfully tested separately.

Now integrate Resend into the BotSmith BACKEND.

Do NOT put Resend code in React.

Do NOT expose the Resend API key to the browser.

Use an environment variable:

RESEND_API_KEY

Also support a configurable sender email if appropriate:

RESEND_FROM_EMAIL

Do not hardcode the API key.

Do not log the API key.

Use the existing backend dependency/service architecture.

Inspect whether an existing email/notification service can be extended.

If the existing notification service is only test-mode logging and is not appropriate for transactional lead emails, create a small dedicated Resend email service rather than breaking the existing notification system.

Keep provider-specific Resend code isolated from the lead router as much as reasonably possible.

==================================================
PART 7 — EMAIL CONTENT
==================================================

When a NEW lead is successfully captured and Email Alerts are enabled, send an email to the configured recipient.

Subject:

New Lead Received - {chatbot_name}

Email should contain:

New Student Lead

Name: {lead name}
Phone: {lead phone}
Email: {lead email, if available}

Message:
{lead message/question, if available}

Chatbot:
{chatbot name}

Captured:
{lead date/time}

Keep the first version simple and professional.

Do not over-engineer the email template.

==================================================
PART 8 — CONNECT EMAIL TO NEW LEAD CREATION
==================================================

Inspect the existing lead creation flow.

Find:

capture_chatbot_lead()

in the existing leads router/service.

The correct order must be:

1. Validate lead
2. Check existing duplicate/deduplication logic
3. Insert the NEW lead into MongoDB
4. Confirm the lead was successfully inserted
5. Check whether Email Alerts are enabled for that chatbot
6. Get that chatbot's configured recipient email
7. Queue/send the email notification
8. Return the normal successful lead response

VERY IMPORTANT:

Do NOT send an email before the lead is successfully stored.

Do NOT send duplicate email alerts when the existing 15-second lead deduplication logic returns an already-existing lead.

Only send an email for an actual NEW lead.

==================================================
PART 9 — BACKGROUND EMAIL SENDING
==================================================

Inspect the existing Celery/Redis infrastructure.

If the existing project already uses Celery for background tasks, use it.

The Resend API call should preferably happen in a background task.

For example:

send_lead_email_alert()

The lead API should NOT wait for Resend to finish before returning success to the student.

Desired flow:

Student submits lead
        ↓
Lead saved to MongoDB
        ↓
Email task queued
        ↓
API returns success
        ↓
Celery task calls Resend
        ↓
Counsellor receives email

==================================================
PART 10 — EMAIL FAILURE MUST NOT BREAK LEAD CAPTURE
==================================================

This is extremely important.

If Resend fails:

The lead MUST still exist in MongoDB.

Example:

Lead saved successfully ✅
Resend email failed ❌

The frontend should still receive the normal successful lead submission response.

Log the email failure appropriately.

Use retries if compatible with the existing Celery architecture.

Do not make Resend a dependency for successful lead capture.

==================================================
PART 11 — MULTIPLE CHATBOTS
==================================================

Email configuration must belong to the individual chatbot.

Example:

Chatbot A:
email_alerts_enabled = true
email_alert_address = admissions@college.com

Chatbot B:
email_alerts_enabled = true
email_alert_address = placement@college.com

A lead from Chatbot A must NEVER be sent to Chatbot B's email.

A lead from Chatbot B must NEVER be sent to Chatbot A's email.

Use chatbot_id / existing chatbot ownership relationships.

==================================================
PART 12 — EMAIL ALERT DISABLED
==================================================

If:

email_alerts_enabled = false

then:

- Lead should still be saved normally.
- No email should be sent.
- Existing lead capture behavior must remain unchanged.

If Email Alerts is disabled, the configured email address may remain stored, but no email should be dispatched.

==================================================
PART 13 — SECURITY
==================================================

Follow existing authentication and authorization.

Backend must validate the email address.

Do not trust frontend validation alone.

Do not expose:

RESEND_API_KEY

to the frontend.

Do not expose the counsellor email through public chatbot configuration endpoints.

Do not log sensitive credentials.

==================================================
PART 14 — LOADING / UX
==================================================

When saving the email configuration, prevent accidental multiple submissions if appropriate.

Use the existing toast system.

Success:

Email Alert Saved
New lead alerts will be sent to counsellor@example.com.

Invalid email:

Invalid email
Please enter a valid email address.

Empty email:

Email required
Please enter an email address.

Backend failure:

Error
Failed to save email alert settings.

Keep the UX simple.

==================================================
PART 15 — TESTING
==================================================

After implementation, test:

TEST 1:
Email Alerts OFF.

Submit a lead.

Expected:
Lead saved.
No email sent.

TEST 2:
Email Alerts ON.

Configure:
test@example.com

Submit a NEW lead.

Expected:
Lead saved.
Email task created.
Resend sends email.

TEST 3:
Invalid email.

Expected:
Configuration is rejected.
No invalid configuration saved.

TEST 4:
Resend failure.

Expected:
Lead remains saved.
Email failure is logged.
Lead API does not fail because of Resend.

TEST 5:
Duplicate lead within existing deduplication window.

Expected:
Existing duplicate behavior remains unchanged.
Do NOT send another alert email.

TEST 6:
Two chatbots with different recipients.

Expected:
Each chatbot sends only to its configured recipient.

TEST 7:
Unauthorized user attempts to modify another chatbot.

Expected:
Existing authorization rules prevent the update.

TEST 8:
Existing Lead Capture.

Expected:
Existing Lead Capture toggle and behavior work exactly as before.

TEST 9:
Existing Export Leads.

Expected:
Export still works exactly as before.

TEST 10:
Existing Refresh / Lead table.

Expected:
No regression.

==================================================
PART 16 — ENVIRONMENT VARIABLES
==================================================

Tell me exactly which environment variables are required.

At minimum:

RESEND_API_KEY

Prefer:

RESEND_FROM_EMAIL

Do not add unnecessary environment variables.

==================================================
PART 17 — IMPORTANT IMPLEMENTATION RULE
==================================================

Before editing anything:

FIRST inspect the actual repository.

Identify the actual files and functions.

Then provide me with:

1. Files you will modify
2. Exact reason for modifying each file
3. Where Email Alerts will be stored
4. Where the Resend integration will live
5. Where the lead email will be triggered
6. How email failure will be prevented from breaking lead creation

Then implement.

Do NOT ask me to manually create duplicate files if an appropriate existing file already exists.

Do NOT change unrelated code.

Do NOT rewrite large files unnecessarily.

Make the smallest clean production-safe changes possible.

==================================================
FINAL RESULT
==================================================

The final BotSmith behavior should be:

Dashboard
    ↓
Lead Capture
    ↓
Email Alerts
    ↓
Enable/configure recipient
    ↓
Save
    ↓
MongoDB stores chatbot email configuration

Then:

Student submits lead
    ↓
Lead saved to MongoDB
    ↓
Email Alerts enabled?
    ↓
YES
    ↓
Background email task
    ↓
Resend
    ↓
Counsellor receives:

"New Lead Received - ABC College"

with the student's lead information.

If Resend fails:

Lead remains saved.

IMPORTANT:
Do not implement any unrelated improvements or refactoring while doing this feature.
One important thing

I'd use this prompt as-is for Copilot, because it explicitly tells it to inspect first and then implement.

And after Copilot makes the changes, don't immediately accept everything blindly. Send me the files/diff it changed. I'll review the implementation for you before you test it in production.

## Plan: Email Alerts For Leads

Yes, this is possible with the current architecture.

**Steps**

1. Extend chatbot settings in models.py:
   - Add email_alerts_enabled.
   - Add email_alert_address.
   - Update Chatbot, ChatbotUpdate, and ChatbotResponse.
   - Keep the email address out of PublicChatbotInfo.

2. Update LeadCaptured.jsx:
   - Add an Email Alerts toggle beside Lead Capture.
   - Display an email input when enabled.
   - Validate the address.
   - Persist settings through the existing chatbotAPI.update() method.

3. Reuse the existing chatbot update endpoint in chatbots.py:
   - No separate settings endpoint should be necessary.
   - Existing ownership validation and MongoDB persistence can remain in use.

4. Add Resend integration:
   - Add Resend configuration such as RESEND_API_KEY.
   - Configure a verified sender address.
   - Create a dedicated email service.
   - Do not reuse the current test-mode email logger unchanged.

5. Trigger alerts in leads.py:
   - Only after a new lead is successfully inserted.
   - Check the chatbot’s alert settings.
   - Do not send an alert for a deduplicated submission.

6. Add a background task using the existing Celery/Redis setup:
   - Send the Resend email asynchronously.
   - Add retry and failure logging.
   - Keep the widget API response independent of Resend availability.

7. Add tests:
   - Settings persistence and ownership.
   - Valid and invalid email addresses.
   - Alerts enabled and disabled.
   - One email for a new lead.
   - No duplicate email for the 15-second deduplication path.
   - Resend failure and retry behavior.
   - Destination email not exposed to the public widget.

**Relevant files**

- models.py
- chatbots.py
- leads.py
- tasks.py
- celery_app.py
- notification_service.py
- requirements.txt
- LeadCaptured.jsx
- api.js
- backend_test.py

**Verification**

1. Confirm the UI saves and reloads the alert settings.
2. Confirm chatbot settings persist in MongoDB.
3. Mock Resend and verify dispatch behavior.
4. Test duplicate submissions do not send duplicate alerts.
5. Run the frontend build and backend tests.
6. With a verified Resend sender and active Celery worker, submit a real widget lead and confirm delivery.

**Decisions**

- Store the destination email on the chatbot document.
- Keep the email address server-side.
- Trigger the email after successful lead insertion.
- Use Celery for asynchronous delivery and retries.
- Make no code changes, dependency changes, migrations, or environment changes during planning.

Yes — this plan is correct and production-sensible.

One thing I would change before implementation: don't add ChatbotResponse fields unless the frontend actually needs them. Since the recipient email should stay private, the cleanest design is to keep the configuration in the authenticated chatbot settings response, while explicitly excluding it from PublicChatbotInfo.

Other than that, I agree with the plan.

I would implement in this exact order
1. models.py
   ↓
   Add email_alerts_enabled
   Add email_alert_address
   ↓
2. LeadCaptured.jsx
   ↓
   Connect Email Alerts UI to chatbotAPI.update()
   ↓
3. Test settings
   ↓
   Enable → enter email → Save → refresh → verify it remains
   ↓
4. Resend service
   ↓
   RESEND_API_KEY
   RESEND_FROM_EMAIL
   ↓
5. tasks.py
   ↓
   Background Resend task
   ↓
6. leads.py
   ↓
   New lead → queue email
   ↓
7. Test end-to-end
The most important rule

The lead endpoint should behave like this:

New lead
   ↓
MongoDB insert succeeds
   ↓
Email alert task queued
   ↓
Return success to student

Never:

New lead
   ↓
Wait for Resend
   ↓
Resend fails
   ↓
Lead submission fails

That would be a bad implementation.

One other thing I'd verify

The plan says:

"Add an Email Alerts toggle beside Lead Capture."

But your current UI work was a button that opens the email input, not another ON/OFF switch. If that's still the UX you want, tell Copilot not to replace your existing design with a second toggle.

I'd keep:

Lead Capture                         Email Alerts    [Lead Capture ON]
                                        ↓
                              click Email Alerts
                                        ↓
                         Send new lead alerts to
                         [ counsellor@email.com ] [Save]

Then the backend can use email_alerts_enabled internally based on whether the configuration is enabled.

Verdict: Proceed. The plan is technically sound; just make sure Copilot preserves the UI you actually chose and doesn't unnecessarily expose the recipient email publicly.

Today 11:57 AM
leys get on email alert part 

Yes. Let's work on Email Alerts now.

We'll do it in this order:

Save the recipient email in the chatbot settings.
Connect Resend in the backend.
Send an email after a new lead is saved.
Test the complete flow.

Since your UI is already added, the next actual code change is making the Save button persist the email address.

Tell Copilot:

Let's implement the Email Alerts feature now.

Start with only the settings persistence part.

Inspect the existing code first, then make these changes:

1. In the chatbot model, add:
   - email_alerts_enabled
   - email_alert_address

2. Update the existing chatbot update model so these fields can be saved.

3. Reuse the existing chatbot update endpoint and ownership checks.

4. Update LeadCaptured.jsx:
   - Load the saved Email Alerts settings when the component opens.
   - Display the saved recipient email in the input.
   - Make the Save button call the existing chatbotAPI.update() method.
   - Save email_alerts_enabled and email_alert_address.
   - Show success/error toasts.
   - Do not connect Resend yet.

5. Keep the existing Lead Capture, export, refresh, and lead table functionality unchanged.

6. Do not modify leads.py, tasks.py, notification_service.py, or Resend integration yet.

Before editing, show me:
- Exact files to modify
- Exact fields being added
- Exact API request body
- How the settings will be loaded again after refresh

Then implement only this first stage.

After this stage, test:

Email Alerts → enter email → Save → refresh page

If the email is still there after refreshing, Stage 1 is working. Then we'll connect Resend.

import React, { useState, useEffect } from 'react';
import { Users, RefreshCw, Inbox, Download, Calendar } from 'lucide-react';
import api, { chatbotAPI } from '../utils/api';
import { Switch } from './ui/switch';
import { useToast } from '../hooks/use-toast';

const formatDateTime = (iso) => {
try {
const d = new Date(iso);
return d.toLocaleString(undefined, {
day: '2-digit',
month: 'short',
year: 'numeric',
hour: '2-digit',
minute: '2-digit',
hour12: true,
});
} catch (e) {
return iso;
}
};

const LeadCaptured = ({ chatbot, onUpdate }) => {
const { toast } = useToast();
const [leads, setLeads] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);
const [togglingCapture, setTogglingCapture] = useState(false);
const [showExport, setShowExport] = useState(false);
const [exportStartDate, setExportStartDate] = useState('');
const [exportEndDate, setExportEndDate] = useState('');
const [exporting, setExporting] = useState(false);
const [showEmailAlerts, setShowEmailAlerts] = useState(false);
const [emailAlertAddress, setEmailAlertAddress] = useState('');

const leadCaptureEnabled = chatbot?.lead_capture_enabled !== false;

const handleToggleLeadCapture = async (checked) => {
if (!chatbot?.id || togglingCapture) return;
try {
setTogglingCapture(true);
await chatbotAPI.update(chatbot.id, { lead_capture_enabled: checked });
toast({
title: checked ? 'Lead Capture Enabled' : 'Lead Capture Disabled',
description: checked
? 'Visitors will see the lead form before chatting.'
: 'Visitors will chat directly without submitting details.'
});
if (onUpdate) await onUpdate();
} catch (err) {
console.error('Error updating lead capture setting:', err);
toast({
title: 'Error',
description: 'Failed to update lead capture setting',
variant: 'destructive'
});
} finally {
setTogglingCapture(false);
}
};

const handleSaveEmailAlert = () => {
if (!emailAlertAddress.trim()) {
toast({
title: 'Email required',
description: 'Please enter an email address.',
variant: 'destructive'
});
return;
}

if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(emailAlertAddress.trim())) {
  toast({
    title: 'Invalid email',
    description: 'Please enter a valid email address.',
    variant: 'destructive'
  });
  return;
}

toast({
  title: 'Email Alert Saved',
  description: `New lead alerts will be sent to ${emailAlertAddress.trim()}.`
});

};

const fetchLeads = async () => {
try {
setLoading(true);
setError(null);
const response = await api.get(/chatbot-leads/${chatbot.id});
setLeads(response.data);
} catch (err) {
console.error('Error fetching captured leads:', err);
setError(err.response?.data?.detail || 'Failed to load leads');
} finally {
setLoading(false);
}
};

useEffect(() => {
if (chatbot?.id) fetchLeads();
}, [chatbot?.id]);

const handleExportLeads = async () => {
if (!exportStartDate || !exportEndDate) {
toast({
title: 'Select dates',
description: 'Please select both a From Date and To Date.',
variant: 'destructive'
});
return;
}

if (exportStartDate > exportEndDate) {
  toast({
    title: 'Invalid date range',
    description: 'From Date cannot be after To Date.',
    variant: 'destructive'
  });
  return;
}

try {
  setExporting(true);

  const response = await api.get(`/chatbot-leads/${chatbot.id}`);
  const allLeads = Array.isArray(response.data) ? response.data : [];

  const startDate = new Date(`${exportStartDate}T00:00:00`);
  const endDate = new Date(`${exportEndDate}T23:59:59.999`);

  const filteredLeads = allLeads.filter((lead) => {
    if (!lead.created_at) return false;
    const leadDate = new Date(lead.created_at);
    return leadDate >= startDate && leadDate <= endDate;
  });

  if (filteredLeads.length === 0) {
    toast({
      title: 'No leads found',
      description: 'There are no leads captured during the selected dates.'
    });
    return;
  }

  const headers = ['Name', 'Phone Number', 'Date & Time'];

  const rows = filteredLeads.map((lead) => [
    lead.name || '',
    `'${lead.phone || ''}`,
    lead.created_at ? formatDateTime(lead.created_at) : ''
  ]);

  const csvContent = [headers, ...rows]
    .map((row) =>
      row
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(',')
    )
    .join('\n');

  const blob = new Blob([csvContent], {
    type: 'text/csv;charset=utf-8;'
  });

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `botsmith-leads-${exportStartDate}-to-${exportEndDate}.csv`;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  window.URL.revokeObjectURL(url);

  toast({
    title: 'Export successful',
    description: `${filteredLeads.length} ${filteredLeads.length === 1 ? 'lead' : 'leads'} exported successfully.`
  });

  setShowExport(false);
} catch (err) {
  console.error('Error exporting leads:', err);
  toast({
    title: 'Export failed',
    description: 'Failed to export leads. Please try again.',
    variant: 'destructive'
  });
} finally {
  setExporting(false);
}

};

return (
<div className="space-y-6 animate-fade-in-up" data-testid="lead-captured-tab">
{/* Lead Capture & Email Alerts Settings */}
<div className="p-5 bg-white rounded-xl border-2 border-purple-200/50 shadow-sm" data-testid="lead-capture-settings-card" >
<div className="flex items-center justify-between gap-4">
<div>
<h3 className="text-base font-semibold text-gray-900">Lead Capture</h3>
<p className="text-sm text-gray-600 mt-1 max-w-md">
Require visitors to provide their details before starting a conversation with the AI.
</p>
</div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setShowEmailAlerts(!showEmailAlerts)}
          data-testid="email-alerts-button"
          className="inline-flex items-center px-3.5 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
        >
          Email Alerts
        </button>

        <Switch
          checked={leadCaptureEnabled}
          onCheckedChange={handleToggleLeadCapture}
          disabled={togglingCapture}
          data-testid="lead-capture-toggle"
        />
      </div>
    </div>

    {showEmailAlerts && (
      <div className="mt-5 pt-5 border-t border-gray-100">
        <label
          htmlFor="email-alert-address"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Send new lead alerts to
        </label>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            id="email-alert-address"
            type="email"
            value={emailAlertAddress}
            onChange={(e) => setEmailAlertAddress(e.target.value)}
            placeholder="counsellor@example.com"
            className="flex-1 px-3.5 py-2.5 border border-gray-300 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none transition-all text-sm"
            data-testid="email-alert-input"
          />

          <button
            type="button"
            onClick={handleSaveEmailAlert}
            data-testid="save-email-alert-button"
            className="inline-flex items-center justify-center px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all text-sm font-medium shadow-lg shadow-purple-500/20"
          >
            Save
          </button>
        </div>
      </div>
    )}
  </div> 

  {/* Header */} 
  <div className="flex items-center justify-between gap-4"> 
    <div> 
      <h2 className="text-2xl font-bold mb-2 bg-gradient-to-r from-gray-900 to-purple-600 bg-clip-text text-transparent"> 
        Lead Captured 
      </h2> 
      <p className="text-gray-600"> 
        Leads submitted through your chatbot's lead form 
      </p> 
    </div> 

    <div className="flex items-center gap-3">
      <button
        onClick={() => setShowExport(!showExport)}
        data-testid="export-leads-button"
        className="inline-flex items-center gap-2 px-4 py-2 border-2 border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50 transition-colors text-sm font-medium"
      >
        <Download className="w-4 h-4" />
        Export Leads
      </button>

      <button 
        onClick={fetchLeads} 
        disabled={loading} 
        data-testid="refresh-leads-button" 
        className="inline-flex items-center gap-2 px-4 py-2 border-2 border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50 transition-colors text-sm font-medium disabled:opacity-50" 
      > 
        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> 
        Refresh 
      </button> 
    </div>
  </div> 

  {/* Export Leads Panel */}
  {showExport && (
    <div className="bg-white rounded-xl border-2 border-purple-200/50 p-6 shadow-sm animate-fade-in-up">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-9 h-9 bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg flex items-center justify-center">
          <Calendar className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Export Leads</h3>
          <p className="text-sm text-gray-500">
            Select the date range for the leads you want to export
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            From Date
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="date"
              value={exportStartDate}
              onChange={(e) => setExportStartDate(e.target.value)}
              max={exportEndDate || undefined}
              className="w-full pl-10 pr-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none transition-all text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            To Date
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="date"
              value={exportEndDate}
              onChange={(e) => setExportEndDate(e.target.value)}
              min={exportStartDate || undefined}
              className="w-full pl-10 pr-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none transition-all text-sm"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-6">
        <button
          onClick={() => {
            setShowExport(false);
            setExportStartDate('');
            setExportEndDate('');
          }}
          className="px-4 py-2 border-2 border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
        >
          Cancel
        </button>

        <button
          onClick={handleExportLeads}
          disabled={exporting || !exportStartDate || !exportEndDate}
          className="inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all text-sm font-medium shadow-lg shadow-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" />
          {exporting ? 'Exporting...' : 'Export CSV'}
        </button>
      </div>
    </div>
  )}

  {/* Loading state */} 
  {loading ? ( 
    <div className="flex items-center justify-center py-16" data-testid="leads-loading"> 
      <RefreshCw className="w-8 h-8 text-purple-600 animate-spin" /> 
    </div> 
  ) : error ? ( 
    <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl text-red-700 text-sm" data-testid="leads-error"> 
      {error} 
    </div> 
  ) : leads.length === 0 ? ( 
    /* Empty state */ 
    <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="leads-empty"> 
      <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-pink-100 rounded-2xl flex items-center justify-center mb-4"> 
        <Inbox className="w-8 h-8 text-purple-500" /> 
      </div> 
      <h3 className="text-lg font-semibold text-gray-900 mb-1">No leads captured yet</h3> 
      <p className="text-sm text-gray-600 max-w-md"> 
        Leads submitted through your chatbot's lead form will appear here. 
      </p> 
    </div> 
  ) : ( 
    /* Leads table */ 
    <div className="bg-white rounded-xl border-2 border-purple-200/50 overflow-hidden shadow-sm" data-testid="leads-table"> 
      <div className="overflow-x-auto"> 
        <table className="w-full text-left"> 
          <thead> 
            <tr className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-100"> 
              <th className="px-6 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wider">Name</th> 
              <th className="px-6 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wider">Number</th> 
              <th className="px-6 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wider">Date &amp; Time</th> 
            </tr> 
          </thead> 
          <tbody className="divide-y divide-gray-100"> 
            {leads.map((lead) => ( 
              <tr key={lead.id} className="hover:bg-purple-50/40 transition-colors" data-testid={`lead-row-${lead.id}`}> 
                <td className="px-6 py-4 text-sm font-medium text-gray-900 whitespace-nowrap">{lead.name}</td> 
                <td className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap">{lead.phone}</td> 
                <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">{formatDateTime(lead.created_at)}</td> 
              </tr> 
            ))} 
          </tbody> 
        </table> 
      </div> 
      <div className="px-6 py-3 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-500"> 
        <Users className="w-3.5 h-3.5" /> 
        {leads.length} {leads.length === 1 ? 'lead' : 'leads'} captured 
      </div> 
    </div> 
  )} 
</div> 
);
};

export default LeadCaptured;