import React, { useEffect, useState } from 'react';
import {
  CalendarDays,
  ExternalLink,
  Loader2,
  CheckCircle2,
  Unplug,
} from 'lucide-react';
import api from '../utils/api';

const Integration = ({ chatbotId }) => {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState('');

  const checkCalendlyStatus = async () => {
    if (!chatbotId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');

      const response = await api.get(
        '/integrations/calendly/status',
        {
          params: {
            chatbot_id: chatbotId,
          },
        }
      );

      setConnected(response.data?.connected === true);
    } catch (err) {
      console.error('Failed to check Calendly status:', err);
      setError('Unable to check Calendly connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkCalendlyStatus();
  }, [chatbotId]);

  const handleConnect = async () => {
    if (!chatbotId || connecting) return;

    try {
      setConnecting(true);
      setError('');

      // Uses the existing authenticated Axios instance.
      // api.js automatically adds:
      // Authorization: Bearer <botsmith_token>
      const response = await api.get(
        '/integrations/calendly/connect',
        {
          params: {
            chatbot_id: chatbotId,
          },
        }
      );

      const authorizationUrl =
        response.data?.authorization_url;

      if (!authorizationUrl) {
        throw new Error(
          'Calendly authorization URL was not returned.'
        );
      }

      // Now redirect to Calendly itself.
      window.location.href = authorizationUrl;
    } catch (err) {
      console.error('Calendly connect error:', err);

      setError(
        err.response?.data?.detail ||
        err.message ||
        'Unable to connect Calendly.'
      );

      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!chatbotId || disconnecting) return;

    const confirmed = window.confirm(
      'Are you sure you want to disconnect Calendly?'
    );

    if (!confirmed) return;

    try {
      setDisconnecting(true);
      setError('');

      await api.delete(
        '/integrations/calendly/disconnect',
        {
          params: {
            chatbot_id: chatbotId,
          },
        }
      );

      setConnected(false);
    } catch (err) {
      console.error(
        'Failed to disconnect Calendly:',
        err
      );

      setError(
        err.response?.data?.detail ||
        'Failed to disconnect Calendly. Please try again.'
      );
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-white p-6 sm:p-8">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold tracking-tight text-gray-950">
            Integrations
          </h2>

          <p className="text-sm text-gray-500 mt-1">
            Connect external tools and services to make your agent more powerful.
          </p>
        </div>

        {/* Calendly */}
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="p-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">

            <div className="flex items-start gap-4">

              {/* Icon */}
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50">
                <CalendarDays className="w-5 h-5 text-gray-700" />
              </div>

              {/* Content */}
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-gray-950">
                    Calendly
                  </h3>

                  {connected && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Connected
                    </span>
                  )}
                </div>

                <p className="text-sm text-gray-500 mt-1">
                  Let your AI schedule meetings directly with your customers.
                </p>

                {!connected && !loading && (
                  <span className="inline-flex mt-3 items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600">
                    Available
                  </span>
                )}

                {loading && (
                  <span className="inline-flex mt-3 items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-500">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Checking connection...
                  </span>
                )}

                {error && (
                  <p className="mt-3 text-xs text-red-600">
                    {error}
                  </p>
                )}
              </div>

            </div>

            {/* Actions */}
            <div className="flex-shrink-0">

              {loading ? (
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-400 cursor-not-allowed"
                >
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Checking...
                </button>
              ) : connected ? (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {disconnecting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Disconnecting...
                    </>
                  ) : (
                    <>
                      <Unplug className="w-4 h-4" />
                      Disconnect
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={connecting || !chatbotId}
                  className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {connecting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      Connect
                      <ExternalLink className="w-4 h-4" />
                    </>
                  )}
                </button>
              )}

            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

export default Integration;