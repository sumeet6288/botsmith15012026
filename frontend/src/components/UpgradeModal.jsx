import React, { useEffect, useState } from 'react';
import {
  X,
  AlertCircle,
  ArrowRight,
  Check,
  Sparkles,
  Zap,
  Crown,
  ShieldCheck,
  TrendingUp
} from 'lucide-react';
import { plansAPI } from '../utils/api';
import { Button } from './ui/button';

const UpgradeModal = ({
  isOpen,
  onClose,
  limitType,
  currentUsage,
  maxUsage
}) => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchPlans();
    }
  }, [isOpen]);

  const fetchPlans = async () => {
    setLoading(true);

    try {
      const response = await plansAPI.getAllPlans();

      const paidPlans = Array.isArray(response?.data)
        ? response.data.filter((plan) => plan.id !== 'free')
        : [];

      setPlans(paidPlans);
    } catch (error) {
      console.error('Error fetching plans:', error);
      setPlans([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = () => {
    window.location.href = '/subscription';
  };

  const getPlanIcon = (planId) => {
    const icons = {
      starter: Zap,
      professional: Crown,
      enterprise: Sparkles
    };

    return icons[planId] || Sparkles;
  };

  const getPlanGradient = (planId) => {
    const gradients = {
      starter: 'from-pink-500 via-fuchsia-500 to-purple-500',
      professional: 'from-blue-600 via-indigo-600 to-violet-600',
      enterprise: 'from-purple-600 via-fuchsia-600 to-pink-600'
    };

    return gradients[planId] || 'from-gray-500 to-gray-700';
  };

  const getPlanAccent = (planId) => {
    const accents = {
      starter: 'bg-pink-50 text-pink-700 border-pink-100',
      professional: 'bg-blue-50 text-blue-700 border-blue-100',
      enterprise: 'bg-purple-50 text-purple-700 border-purple-100'
    };

    return accents[planId] || 'bg-gray-50 text-gray-700 border-gray-100';
  };

  const getLimitLabel = (type) => {
    const labels = {
      chatbots: 'Agents',
      messages: 'Messages per Month',
      file_uploads: 'File Uploads',
      website_sources: 'Website Sources',
      text_sources: 'Text Sources'
    };

    return labels[type] || type;
  };

  // Backend plan data may still contain "chatbot/chatbots".
  // Keep the backend/API terminology unchanged and translate only
  // the customer-facing text here.
  const formatFeature = (feature) => {
    if (!feature || typeof feature !== 'string') {
      return feature;
    }

    return feature
      .replace(/\bchatbots\b/gi, 'agents')
      .replace(/\bchatbot\b/gi, 'agent')
      .replace(/\b1 agents\b/gi, '1 agent');
  };

  const formatLimitCount = (type, count) => {
    const label = getLimitLabel(type);

    if (label === 'Agents') {
      return Number(count) === 1 ? 'agent' : 'agents';
    }

    return label.toLowerCase();
  };

  if (!isOpen) return null;

  const limitLabel = getLimitLabel(limitType);
  const usagePercentage =
    maxUsage && Number(maxUsage) > 0
      ? Math.min((Number(currentUsage) / Number(maxUsage)) * 100, 100)
      : 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
    >
      <div className="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-white/60 bg-white shadow-[0_30px_100px_rgba(15,23,42,0.28)]">
        {/* Decorative glow */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-purple-200/40 blur-3xl" />
        <div className="pointer-events-none absolute -left-24 top-32 h-48 w-48 rounded-full bg-blue-200/30 blur-3xl" />

        {/* Header */}
        <div className="relative flex items-center justify-between border-b border-slate-200/80 bg-white/95 px-6 py-5 backdrop-blur md:px-8">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600 to-pink-500 shadow-lg shadow-purple-500/20">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>

            <div>
              <h2
                id="upgrade-modal-title"
                className="text-xl font-bold tracking-tight text-slate-950 md:text-2xl"
              >
                Upgrade Your Plan
              </h2>
              <p className="mt-0.5 text-sm text-slate-500 md:text-base">
                Unlock more features and higher limits
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close upgrade modal"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto">
          {/* Limit Warning */}
          <div className="px-6 pt-6 md:px-8">
            <div className="relative overflow-hidden rounded-2xl border border-orange-200 bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 p-4 md:p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-orange-100">
                  <AlertCircle className="h-5 w-5 text-orange-600" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold text-orange-950">
                      {limitLabel} Limit Reached
                    </h3>

                    <span className="rounded-full border border-orange-200 bg-white/70 px-3 py-1 text-xs font-semibold text-orange-700">
                      {currentUsage} / {maxUsage}
                    </span>
                  </div>

                  <p className="mt-1 text-sm leading-6 text-orange-800/80">
                    You've used {currentUsage} of {maxUsage} available{' '}
                    {formatLimitCount(limitType, maxUsage)}. Upgrade your plan
                    to continue using this feature.
                  </p>

                  {maxUsage > 0 && (
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-orange-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-orange-400 to-red-500 transition-all"
                        style={{ width: `${usagePercentage}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Plans */}
          <div className="px-6 py-6 md:px-8 md:py-8">
            {loading ? (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                {[1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
                  >
                    <div className="h-44 animate-pulse bg-slate-100" />
                    <div className="space-y-4 p-6">
                      <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
                      <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                      <div className="h-4 w-5/6 animate-pulse rounded bg-slate-100" />
                      <div className="h-11 w-full animate-pulse rounded-xl bg-slate-100" />
                    </div>
                  </div>
                ))}
              </div>
            ) : plans.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
                <p className="font-semibold text-slate-900">
                  Plans are temporarily unavailable
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Please try again in a moment.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                {plans.map((plan) => {
                  const Icon = getPlanIcon(plan.id);
                  const gradient = getPlanGradient(plan.id);
                  const accent = getPlanAccent(plan.id);
                  const features = Array.isArray(plan.features)
                    ? plan.features.slice(0, 6)
                    : [];

                  return (
                    <div
                      key={plan.id}
                      className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-purple-200 hover:shadow-[0_18px_45px_rgba(76,29,149,0.12)]"
                    >
                      {/* Plan Header */}
                      <div
                        className={`relative overflow-hidden bg-gradient-to-br ${gradient} p-6 text-white`}
                      >
                        <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />

                        <div className="relative">
                          <div className="mb-5 flex items-center justify-between">
                            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20 backdrop-blur">
                              <Icon className="h-6 w-6" />
                            </div>

                            {plan.id === 'professional' && (
                              <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider ring-1 ring-white/20">
                                Popular
                              </span>
                            )}
                          </div>

                          <h3 className="text-lg font-bold md:text-xl">
                            {plan.name}
                          </h3>

                          <div className="mt-2 flex items-end gap-1">
                            <span className="text-3xl font-extrabold tracking-tight md:text-4xl">
                              {plan.price === -1
                                ? 'Custom'
                                : `₹${Number(plan.price || 0).toLocaleString(
                                    'en-IN'
                                  )}`}
                            </span>

                            {plan.price > 0 && plan.price !== -1 && (
                              <span className="pb-1 text-sm text-white/75">
                                /month
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Plan Body */}
                      <div className="flex flex-1 flex-col p-6">
                        <div className="mb-5 flex items-center justify-between">
                          <span
                            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${accent}`}
                          >
                            {plan.id === 'enterprise'
                              ? 'For larger teams'
                              : 'Ready to upgrade'}
                          </span>

                          <ShieldCheck className="h-4 w-4 text-emerald-500" />
                        </div>

                        <ul className="mb-6 space-y-3">
                          {features.map((feature, idx) => (
                            <li
                              key={`${plan.id}-feature-${idx}`}
                              className="flex items-start gap-2.5 text-sm leading-5"
                            >
                              <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-50">
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                              </span>

                              <span className="text-slate-700">
                                {formatFeature(feature)}
                              </span>
                            </li>
                          ))}
                        </ul>

                        <Button
                          onClick={() => handleUpgrade(plan.id)}
                          className={`mt-auto w-full rounded-xl border-0 bg-gradient-to-r ${gradient} py-3 font-semibold text-white shadow-sm transition-all hover:shadow-lg hover:brightness-[1.03]`}
                        >
                          <span className="flex items-center justify-center gap-2">
                            View {plan.name} Plan
                            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                          </span>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-200 bg-slate-50/80 px-6 py-5 md:px-8">
            <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
              <div>
                <p className="font-medium text-slate-800">
                  Need help choosing the right plan?
                </p>
                <p className="mt-0.5 text-sm text-slate-500">
                  Compare features, limits, and pricing before upgrading.
                </p>
              </div>

              <Button
                variant="outline"
                onClick={() => window.open('/pricing', '_blank')}
                className="rounded-xl border-slate-300 bg-white px-5 font-semibold text-slate-700 hover:bg-slate-50"
              >
                Compare All Plans
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpgradeModal;
