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
    <div className="w-full bg-white px-2 py-5 sm:py-6">
      <div className="w-full max-w-4xl">
        <div className="mb-6">
          <h2 className="text-xl font-semibold tracking-tight text-gray-950">
            Integrations
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Connect external tools and services to make your agent more powerful.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <section className="flex min-h-[224px] flex-col rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-gray-200 bg-gray-50">
              <CalendarDays className="h-5 w-5 text-gray-700" />
            </div>

            <div className="mt-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-gray-950">Calendly</h3>
                {connected && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Connected
                  </span>
                )}
              </div>

              <p className="mt-1 text-sm leading-6 text-gray-500">
                Let your AI schedule meetings directly with your customers.
              </p>

              {!connected && !loading && (
                <span className="mt-3 inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600">
                  Available
                </span>
              )}

              {loading && (
                <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-500">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Checking connection...
                </span>
              )}

              {error && (
                <p role="alert" className="mt-3 text-xs text-red-600">
                  {error}
                </p>
              )}
            </div>

            <div className="mt-auto pt-5">
              {loading ? (
                <button
                  type="button"
                  disabled
                  className="inline-flex cursor-not-allowed items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-400"
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking...
                </button>
              ) : connected ? (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {disconnecting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Disconnecting...
                    </>
                  ) : (
                    <>
                      <Unplug className="h-4 w-4" />
                      Disconnect
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={connecting || !chatbotId}
                  className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {connecting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      Connect
                      <ExternalLink className="h-4 w-4" />
                    </>
                  )}
                </button>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Integration;