import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, LockKeyhole, Languages } from 'lucide-react';
import BotSmithLogo from '../components/BotSmithLogo';
import GoogleAuthButton from '../components/GoogleAuthButton';

const SignUp = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F7F7F5] text-[#171717] font-sans">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&display=swap');

        .font-heading,
        .font-display {
          font-family: "Instrument Serif", Georgia, serif !important;
          font-weight: 400 !important;
        }

        .font-body {
          font-family: "Inter", system-ui, sans-serif !important;
        }
      `}</style>

      <main className="min-h-screen grid md:grid-cols-[minmax(420px,0.9fr)_minmax(0,1fr)]">
        {/* Left: editorial product panel */}
        <aside className="hidden min-h-screen border-r border-[#DEDED9] bg-[#EFEFEA] md:flex md:flex-col">
          <div className="flex flex-1 items-center px-10 py-12 lg:px-16">
            <div className="max-w-xl">
              <p className="mb-6 font-body text-[11px] font-semibold uppercase tracking-[0.2em] text-[#777]">
                BotSmith AI
              </p>

              <h2 className="font-heading text-7xl leading-[0.86] tracking-tight text-[#171717] lg:text-8xl">
                Join BotSmith
                <br />
                <span className="italic">today.</span>
              </h2>

              <div className="mt-8 h-px w-20 bg-[#171717]" />

              <p className="mt-7 max-w-md font-body text-base leading-7 text-[#555]">
                Start building AI agents that help your users get answers,
                guidance, and support without unnecessary complexity.
              </p>

              <div className="mt-12 grid max-w-md grid-cols-2 border-y border-[#D3D3CE]">
                <Metric value="Free" label="To Start" />
                <Metric value="5 min" label="Setup Time" />
              </div>
            </div>
          </div>

          <div className="border-t border-[#D3D3CE] px-10 py-5 lg:px-16">
            <div className="flex items-center justify-between font-body text-[10px] uppercase tracking-[0.14em] text-[#888]">
              <span>Simple by design</span>
              <span>Built for growth</span>
            </div>
          </div>
        </aside>

        {/* Right: sign-up module */}
        <section className="flex items-center justify-center px-5 py-10 sm:px-8 lg:px-14">
          <div className="w-full max-w-md">
            {/* Brand */}
            <button
              type="button"
              onClick={() => navigate('/')}
              className="mb-10 flex items-center gap-2 text-left"
            >
              <BotSmithLogo size="sm" showGlow={false} animate={false} />
              <div className="flex items-baseline gap-2">
                <span className="font-heading text-3xl leading-none tracking-tight">
                  BotSmith
                </span>
                <span className="rounded-full border border-[#D9D9D4] bg-white px-2 py-0.5 text-[9px] font-semibold tracking-wide text-[#555]">
                  AI
                </span>
              </div>
            </button>

            {/* Main card */}
            <div className="rounded-[20px] border border-[#DEDED9] bg-white p-6 shadow-[0_12px_35px_rgba(0,0,0,0.06)] sm:p-8">
              <div className="mb-8">
                <p className="mb-3 font-body text-[11px] font-semibold uppercase tracking-[0.18em] text-[#777]">
                  Get started
                </p>

                <h1 className="font-heading text-5xl leading-[0.95] tracking-tight text-[#171717] sm:text-6xl">
                  Create your account
                </h1>

                <p className="mt-4 font-body text-sm leading-6 text-[#6B6B66]">
                  Start building your AI agents today.
                </p>
              </div>

              <div className="space-y-5">
                <GoogleAuthButton />

                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-[#E7E7E2]" />
                  <span className="font-body text-[10px] uppercase tracking-[0.14em] text-[#999]">
                    Secure access
                  </span>
                  <div className="h-px flex-1 bg-[#E7E7E2]" />
                </div>

                <p className="text-center font-body text-xs leading-5 text-[#777]">
                  By continuing, you agree to BotSmith's Terms of Service and
                  Privacy Policy.
                </p>
              </div>

              <div className="mt-8 border-t border-[#E8E8E3] pt-6">
                <p className="text-center font-body text-sm text-[#666]">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => navigate('/signin')}
                    className="font-semibold text-[#171717] underline decoration-[#BEBEB8] underline-offset-4"
                  >
                    Sign in
                  </button>
                </p>
              </div>

              {/* Trust modules */}
              <div className="mt-7 grid grid-cols-3 divide-x divide-[#E8E8E3] border-t border-[#E8E8E3] pt-6">
                <TrustItem icon={ShieldCheck} label="SSL Secure" />
                <TrustItem icon={LockKeyhole} label="Encrypted" />
                <TrustItem icon={Languages} label="Multi-Lang" />
              </div>

              {/* Legal */}
              <div className="mt-6 text-center font-body text-[10px] text-[#999]">
                <button
                  type="button"
                  onClick={() => navigate('/privacy-policy')}
                  className="hover:text-[#333]"
                >
                  Privacy Policy
                </button>
                <span className="mx-2">·</span>
                <button
                  type="button"
                  onClick={() => navigate('/terms-of-service')}
                  className="hover:text-[#333]"
                >
                  Terms of Service
                </button>
                <span className="mx-2">·</span>
                <button
                  type="button"
                  onClick={() => navigate('/resources/help-center')}
                  className="hover:text-[#333]"
                >
                  Help Center
                </button>
              </div>
            </div>

            <div className="mt-6 text-center font-body text-[11px] leading-5 text-[#999]">
              <p>© 2025 BotSmith. All rights reserved.</p>
              <p>Made for better conversations.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

const TrustItem = ({ icon: Icon, label }) => (
  <div className="flex flex-col items-center gap-2 px-2 text-center">
    <Icon className="h-4 w-4 text-[#555]" strokeWidth={1.7} />
    <span className="font-body text-[9px] font-semibold uppercase tracking-[0.08em] text-[#777]">
      {label}
    </span>
  </div>
);

const Metric = ({ value, label }) => (
  <div className="py-5">
    <div className="font-heading text-4xl leading-none text-[#171717]">
      {value}
    </div>
    <div className="mt-2 font-body text-[10px] font-semibold uppercase tracking-[0.14em] text-[#888]">
      {label}
    </div>
  </div>
);

export default SignUp;
