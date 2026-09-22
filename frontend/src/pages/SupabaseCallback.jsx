/**
 * Supabase OAuth Callback Page
 * 
 * This page handles the redirect after successful Google OAuth authentication.
 * It extracts the session from URL, syncs with backend, and redirects to dashboard.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const Loader = () => {
  return (
    <>
      <style>{`
        .botsmith-loader {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .botsmith-loader .loader {
          --path: #2f3545;
          --dot: #5628ee;
          --duration: 3s;
          width: 44px;
          height: 44px;
          position: relative;
          display: inline-block;
          margin: 0 16px;
        }

        .botsmith-loader .loader:before {
          content: "";
          width: 6px;
          height: 6px;
          border-radius: 50%;
          position: absolute;
          display: block;
          background: var(--dot);
          top: 37px;
          left: 19px;
          transform: translate(-18px, -18px);
          animation: botsmithDotRect var(--duration)
            cubic-bezier(0.785, 0.135, 0.15, 0.86) infinite;
        }

        .botsmith-loader .loader svg {
          display: block;
          width: 100%;
          height: 100%;
        }

        .botsmith-loader .loader svg rect,
        .botsmith-loader .loader svg polygon,
        .botsmith-loader .loader svg circle {
          fill: none;
          stroke: var(--path);
          stroke-width: 10px;
          stroke-linejoin: round;
          stroke-linecap: round;
        }

        .botsmith-loader .loader svg polygon {
          stroke-dasharray: 145 76 145 76;
          stroke-dashoffset: 0;
          animation: botsmithPathTriangle var(--duration)
            cubic-bezier(0.785, 0.135, 0.15, 0.86) infinite;
        }

        .botsmith-loader .loader svg rect {
          stroke-dasharray: 192 64 192 64;
          stroke-dashoffset: 0;
          animation: botsmithPathRect 3s
            cubic-bezier(0.785, 0.135, 0.15, 0.86) infinite;
        }

        .botsmith-loader .loader svg circle {
          stroke-dasharray: 150 50 150 50;
          stroke-dashoffset: 75;
          animation: botsmithPathCircle var(--duration)
            cubic-bezier(0.785, 0.135, 0.15, 0.86) infinite;
        }

        .botsmith-loader .loader.triangle {
          width: 48px;
        }

        .botsmith-loader .loader.triangle:before {
          left: 21px;
          transform: translate(-10px, -18px);
          animation: botsmithDotTriangle var(--duration)
            cubic-bezier(0.785, 0.135, 0.15, 0.86) infinite;
        }

        @keyframes botsmithPathTriangle {
          33% {
            stroke-dashoffset: 74;
          }

          66% {
            stroke-dashoffset: 147;
          }

          100% {
            stroke-dashoffset: 221;
          }
        }

        @keyframes botsmithDotTriangle {
          33% {
            transform: translate(0, 0);
          }

          66% {
            transform: translate(10px, -18px);
          }

          100% {
            transform: translate(-10px, -18px);
          }
        }

        @keyframes botsmithPathRect {
          25% {
            stroke-dashoffset: 64;
          }

          50% {
            stroke-dashoffset: 128;
          }

          75% {
            stroke-dashoffset: 192;
          }

          100% {
            stroke-dashoffset: 256;
          }
        }

        @keyframes botsmithDotRect {
          25% {
            transform: translate(0, 0);
          }

          50% {
            transform: translate(18px, -18px);
          }

          75% {
            transform: translate(0, -36px);
          }

          100% {
            transform: translate(-18px, -18px);
          }
        }

        @keyframes botsmithPathCircle {
          25% {
            stroke-dashoffset: 125;
          }

          50% {
            stroke-dashoffset: 175;
          }

          75% {
            stroke-dashoffset: 225;
          }

          100% {
            stroke-dashoffset: 275;
          }
        }
      `}</style>

      <div className="botsmith-loader">
        <div className="loader">
          <svg viewBox="0 0 80 80">
            <circle r={32} cy={40} cx={40} />
          </svg>
        </div>

        <div className="loader triangle">
          <svg viewBox="0 0 86 80">
            <polygon points="43 8 79 72 7 72" />
          </svg>
        </div>

        <div className="loader">
          <svg viewBox="0 0 80 80">
            <rect height={64} width={64} y={8} x={8} />
          </svg>
        </div>
      </div>
    </>
  );
};

const SupabaseCallback = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState('Processing authentication...');
  const [error, setError] = useState(null);

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    if (!isSupabaseConfigured) {
      setError('Supabase is not configured');
      toast.error('Authentication service not configured');
      setTimeout(() => navigate('/signin'), 2000);
      return;
    }

    try {
      setStatus('Verifying your credentials...');

      // Get the session from Supabase
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        throw new Error(`Session error: ${sessionError.message}`);
      }

      if (!session) {
        throw new Error('No session found. Please try signing in again.');
      }

      const token = session.access_token;
      const user = session.user;

      console.log('✅ Supabase session obtained:', {
        userId: user.id,
        email: user.email,
        provider: user.app_metadata?.provider
      });

      setStatus('Syncing with backend...');

      // Sync user with backend
      const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
      const response = await axios.post(
        `${backendUrl}/api/auth/supabase/callback`,
        { access_token: token },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.access_token && response.data.user) {
        console.log('✅ User synced with backend:', response.data.user);

        // Store our app's JWT token and user data
        localStorage.setItem('botsmith_token', response.data.access_token);
        localStorage.setItem('botsmith_user', JSON.stringify(response.data.user));

        setStatus('Success! Redirecting to dashboard...');
        toast.success('Successfully signed in!');

        // Redirect to dashboard
        setTimeout(() => {
          navigate('/dashboard');
        }, 1000);
      } else {
        throw new Error('Invalid response from backend');
      }
    } catch (err) {
      console.error('❌ Authentication callback error:', err);
      const errorMessage = err.response?.data?.detail || err.message || 'Authentication failed';
      setError(errorMessage);
      toast.error(errorMessage);

      // Redirect to signin after error
      setTimeout(() => {
        navigate('/signin');
      }, 3000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">

          {/* Title */}
          <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">
            BotSmith AI
          </h1>

          {/* Status or Error */}
          {error ? (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <svg
                    className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div>
                    <h3 className="text-sm font-semibold text-red-900 mb-1">
                      Authentication Failed
                    </h3>
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>

              <p className="text-sm text-gray-600 text-center">
                Redirecting to sign in page...
              </p>
            </div>
          ) : (
            <div className="space-y-6">

              {/* New Loading Animation */}
              <div className="flex justify-center items-center">
                <Loader />
              </div>

              {/* Status Message */}
              <div className="text-center space-y-2">
                <p className="text-lg font-medium text-gray-900">{status}</p>
                <p className="text-sm text-gray-600">
                  Please wait while we complete the sign-in process
                </p>
              </div>

              {/* Progress Steps */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-gray-600">
                    Google authentication
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      status.includes('backend') || status.includes('Success')
                        ? 'bg-green-500'
                        : 'bg-gray-300'
                    }`}
                  ></div>
                  <span className="text-sm text-gray-600">
                    Account verification
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      status.includes('Success')
                        ? 'bg-green-500'
                        : 'bg-gray-300'
                    }`}
                  ></div>
                  <span className="text-sm text-gray-600">
                    Setting up your dashboard
                  </span>
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Additional Info */}
        <p className="text-center text-sm text-gray-500 mt-4">
          Secured by Supabase Authentication
        </p>
      </div>
    </div>
  );
};

export default SupabaseCallback;