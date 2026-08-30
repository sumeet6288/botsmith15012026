import React, { useState, useEffect } from 'react';
import { Users, RefreshCw, Inbox } from 'lucide-react';
import api from '../utils/api';

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

const LeadCaptured = ({ chatbot }) => {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
    if (chatbot?.id) fetchLeads();
  }, [chatbot?.id]);

  return (
    <div className="space-y-6 animate-fade-in-up" data-testid="lead-captured-tab">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2 bg-gradient-to-r from-gray-900 to-purple-600 bg-clip-text text-transparent">
            Lead Captured
          </h2>
          <p className="text-gray-600">
            Leads submitted through your chatbot's lead form
          </p>
        </div>
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
