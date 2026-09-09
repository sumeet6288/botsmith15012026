import React, { useState, useEffect } from 'react'; 
import { Users, RefreshCw, Inbox, Download, Calendar } from 'lucide-react'; 
import api, { chatbotAPI, plansAPI } from '../utils/api'; 
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
  const [emailAlertsEnabled, setEmailAlertsEnabled] = useState(false);
  const [savingEmailAlert, setSavingEmailAlert] = useState(false);
  const [showUpgradeMessage, setShowUpgradeMessage] = useState(false);
  const [userPlan, setUserPlan] = useState(null);
  const [loadingPlan, setLoadingPlan] = useState(true);

  // Use the same paid-plan permission as the White Label Branding feature.
  const isPaidUser = Boolean(userPlan?.limits?.custom_branding);

  const leadCaptureEnabled = chatbot?.lead_capture_enabled !== false;

  useEffect(() => {
    const fetchUserPlan = async () => {
      try {
        const response = await plansAPI.getUsageStats();
        setUserPlan(response.data.plan);
      } catch (err) {
        console.error('Error fetching user plan:', err);
      } finally {
        setLoadingPlan(false);
      }
    };

    fetchUserPlan();
  }, []);

  const handleToggleLeadCapture = async (checked) => {
    if (!chatbot?.id || togglingCapture) return;

    // Free users cannot enable Lead Capture.
    // Keep the switch OFF and show only the inline upgrade message.
    if (checked && !isPaidUser) {
      setShowUpgradeMessage(true);
      return;
    }

    setShowUpgradeMessage(false);

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

  const handleSaveEmailAlert = async () => {
    if (!emailAlertAddress.trim()) {
      toast({
        title: 'Email required',
        description: 'Please enter an email address.',
        variant: 'destructive'
      });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAlertAddress.trim())) {
      toast({
        title: 'Invalid email',
        description: 'Please enter a valid email address.',
        variant: 'destructive'
      });
      return;
    }

    try {
      setSavingEmailAlert(true);
      await chatbotAPI.update(chatbot.id, {
        email_alerts_enabled: true,
        email_alert_address: emailAlertAddress.trim()
      });
      setEmailAlertsEnabled(true);
      toast({
        title: 'Email Alert Saved',
        description: `New lead alerts will be sent to ${emailAlertAddress.trim()}.`
      });
      if (onUpdate) await onUpdate();
    } catch (err) {
      console.error('Error saving email alert settings:', err);
      toast({
        title: 'Error',
        description: err.response?.data?.detail || 'Failed to save email alert settings',
        variant: 'destructive'
      });
    } finally {
      setSavingEmailAlert(false);
    }
  };

  const fetchLeads = async () => { 
    try { 
      setLoading(true); 
      setError(null); 
      const response = await api.get(`/chatbot-leads/${chatbot.id}`); 
      setLeads(response.data); 
    } catch (err) { 
      console.error('Error fetching captured leads:', err); 
      setError(err.response?.data?.detail || 'Failed to load leads'); 
    } finally { 
      setLoading(false); 
    } 
  }; 

  useEffect(() => { 
    if (chatbot?.id) {
      setEmailAlertsEnabled(chatbot.email_alerts_enabled === true);
      setEmailAlertAddress(chatbot.email_alert_address || '');
      setShowEmailAlerts(chatbot.email_alerts_enabled === true);
      fetchLeads();
    }
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
      <div
        className="p-5 bg-white rounded-xl border-2 border-purple-200/50 shadow-sm"
        data-testid="lead-capture-settings-card"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Lead Capture</h3>
            <p className="text-sm text-gray-600 mt-1 max-w-md">
              Require visitors to provide their details before starting a conversation with the AI.
            </p>

            {showUpgradeMessage && !isPaidUser && (
              <p className="mt-2 text-sm text-purple-600">
                Please upgrade to use the Lead Capture feature.
              </p>
            )}
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setShowEmailAlerts(!showEmailAlerts)}
              data-testid="email-alerts-button"
              aria-pressed={showEmailAlerts}
              className={`inline-flex items-center px-3.5 py-2 border rounded-lg transition-colors text-sm font-medium ${showEmailAlerts || emailAlertsEnabled ? 'border-purple-600 bg-purple-50 text-purple-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              Email Alerts
            </button>

            <Switch
              checked={leadCaptureEnabled}
              onCheckedChange={handleToggleLeadCapture}
              disabled={togglingCapture || loadingPlan}
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
                disabled={savingEmailAlert}
                data-testid="save-email-alert-button"
                className="inline-flex items-center justify-center px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all text-sm font-medium shadow-lg shadow-purple-500/20 disabled:opacity-50"
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