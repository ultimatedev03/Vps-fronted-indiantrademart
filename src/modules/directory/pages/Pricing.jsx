import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { fetchWithCsrf } from '@/lib/fetchWithCsrf';
import { apiUrl } from '@/lib/apiBase';
import {
  BadgeCheck,
  BarChart3,
  Check,
  Crown,
  Gem,
  Headphones,
  MapPin,
  Rocket,
  ShieldCheck,
  Sparkles,
  Star,
  Zap,
} from 'lucide-react';

const cx = (...arr) => arr.filter(Boolean).join(' ');

const asObject = (value) => {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof value === 'object' && !Array.isArray(value) ? value : {};
};

const toNonNegativeNumber = (value, fallback = 0) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
};

const formatINR = (value) => {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return '0';
  const hasFraction = !Number.isInteger(n);
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  });
};

const getPlanDisplayPricing = (plan) => {
  const nowPrice = toNonNegativeNumber(plan?.price, 0);
  const features = asObject(plan?.features);
  const pricing = asObject(features?.pricing);

  const configuredOriginalPrice = toNonNegativeNumber(pricing.original_price, 0);
  const configuredDiscountPercent = Number(pricing.discount_percent || 0);

  let originalPrice = configuredOriginalPrice;
  let discountPercent = Number.isFinite(configuredDiscountPercent)
    ? Math.max(0, Math.min(100, configuredDiscountPercent))
    : 0;

  if ((!Number.isFinite(originalPrice) || originalPrice <= nowPrice) && discountPercent > 0 && discountPercent < 100) {
    originalPrice = Number(((nowPrice * 100) / (100 - discountPercent)).toFixed(2));
  }

  if (!Number.isFinite(originalPrice) || originalPrice <= nowPrice) {
    originalPrice = 0;
  }

  if ((!discountPercent || discountPercent <= 0) && originalPrice > nowPrice && originalPrice > 0) {
    discountPercent = Number((((originalPrice - nowPrice) / originalPrice) * 100).toFixed(2));
  }

  const discountLabel = String(pricing.discount_label || '').trim();

  return {
    nowPrice,
    originalPrice,
    discountPercent,
    discountLabel,
  };
};

const getMonthlyPricing = (plan) => {
  const annual = getPlanDisplayPricing(plan);
  return {
    ...annual,
    nowPrice: Number((annual.nowPrice / 12).toFixed(2)),
    originalPrice: Number((annual.originalPrice / 12).toFixed(2)),
  };
};

const getBillingPricing = (plan, billing) => {
  const annual = getPlanDisplayPricing(plan);
  if (billing === 'yearly') return annual;
  return getMonthlyPricing(plan);
};

const getDiscountTag = (pricing) => {
  const label = String(pricing?.discountLabel || '').trim();
  if (label) return label;
  const percent = Number(pricing?.discountPercent || 0);
  if (percent > 0) return `${Math.round(percent)}% OFF`;
  return '';
};

const getCoverage = (plan) => {
  const features = asObject(plan?.features);
  const coverage = asObject(features?.coverage);

  const rawStates = coverage.states_limit ?? features.states_limit;
  const rawCities = coverage.cities_limit ?? features.cities_limit;

  const states = Number(rawStates);
  const cities = Number(rawCities);

  return {
    states: Number.isFinite(states) && states >= 0 ? Math.floor(states) : 0,
    cities: Number.isFinite(cities) && cities >= 0 ? Math.floor(cities) : 0,
  };
};

const parsePlanMeta = (plan) => {
  if (Array.isArray(plan?.features)) {
    const items = plan.features.map((item) => String(item || '').trim()).filter(Boolean);
    return {
      badge: { label: plan?.name || 'Plan', variant: 'neutral' },
      highlights: [],
      groups: items.length > 0 ? [{ title: 'Features', Icon: Sparkles, items }] : [],
    };
  }

  const features = asObject(plan?.features);
  const badge = asObject(features?.badge);
  const listing = asObject(features?.listing);
  const verification = asObject(features?.verification);
  const leadsConfig = asObject(features?.leads);
  const supportConfig = asObject(features?.support);
  const analyticsConfig = asObject(features?.analytics);
  const coverage = getCoverage(plan);
  const visibility = [];
  const leads = [];
  const support = [];
  const analytics = [];
  const coverageItems = [];
  const highlights = [];

  if (badge?.label) highlights.push(`Badge: ${badge.label}`);
  if (verification?.kyc_required) highlights.push('KYC required');

  if (listing?.highlight) visibility.push('Highlighted listing');
  if (listing?.featured) visibility.push('Featured listing');
  if (listing?.homepage_featured) visibility.push('Homepage featured');
  if (listing?.category_top_ranking) visibility.push('Category top ranking');
  if (listing?.home_category_boost) visibility.push('Category boost');
  if (Number(listing?.top_slots) > 0) visibility.push(`${Math.floor(Number(listing.top_slots))} top slots`);
  if (verification?.trust_seal) visibility.push('Trust seal');
  if (listing?.profile_verified_tick) visibility.push('Verified tick on profile');

  if (leadsConfig?.priority_leads) leads.push('Priority leads');
  if (leadsConfig?.exclusive_leads) leads.push('Exclusive leads');
  if (leadsConfig?.early_access_leads) leads.push('Early access leads');
  if (leadsConfig?.rfq_access) leads.push('RFQ access');
  if (leadsConfig?.direct_call_whatsapp) leads.push('Direct call/WhatsApp');

  if (supportConfig?.level) support.push(`${String(supportConfig.level).toUpperCase()} support`);
  if (supportConfig?.response_sla_hours) support.push(`SLA ${supportConfig.response_sla_hours} hrs`);
  if (supportConfig?.account_manager) support.push('Dedicated account manager');

  if (analyticsConfig?.enabled) analytics.push('Analytics dashboard');
  if (analyticsConfig?.export_csv) analytics.push('Export reports (CSV)');
  if (analyticsConfig?.campaign_insights) analytics.push('Campaign insights');
  if (analyticsConfig?.competitor_insights) analytics.push('Competitor insights');

  if (coverage.states > 0) coverageItems.push(`Up to ${coverage.states} states`);
  if (coverage.cities > 0) coverageItems.push(`Up to ${coverage.cities} cities`);

  return {
    badge: { label: badge?.label || plan?.name || 'Plan', variant: badge?.variant || 'neutral' },
    highlights,
    groups: [
      { title: 'Visibility', Icon: Star, items: visibility },
      { title: 'Leads', Icon: Rocket, items: leads },
      { title: 'Support', Icon: Headphones, items: support },
      { title: 'Analytics', Icon: BarChart3, items: analytics },
      { title: 'Coverage', Icon: MapPin, items: coverageItems },
    ].filter((group) => group.items.length > 0),
  };
};

const getPlanFeatureSummary = (plan) => {
  const meta = parsePlanMeta(plan);
  return meta.groups.flatMap((group) => group.items.map((text) => ({ group: group.title, text })));
};

const getTopSlots = (plan) => {
  const features = asObject(plan?.features);
  const listing = asObject(features?.listing);
  const topSlots = Number(listing?.top_slots);
  if (Number.isFinite(topSlots) && topSlots > 0) return Math.floor(topSlots);
  return 0;
};

const getRankingText = (plan) => {
  const features = asObject(plan?.features);
  const listing = asObject(features?.listing);
  const ranking =
    String(features?.ranking || '').trim() ||
    String(features?.rank || '').trim() ||
    String(listing?.rank_text || '').trim() ||
    String(listing?.ranking_text || '').trim();
  if (ranking) return ranking;
  if (toNonNegativeNumber(plan?.price, 0) <= 0) return 'Remaining all';
  return `All ${String(plan?.name || 'Plan')} member`;
};

const getPlanTag = (plan) => {
  const badge = asObject(asObject(plan?.features)?.badge);
  const label = String(badge?.label || '').trim();
  if (label) return label;
  return String(plan?.name || 'Plan');
};

const isPlanPopularFromBadge = (plan) => {
  const badge = asObject(asObject(plan?.features)?.badge);
  const label = String(badge?.label || '').trim().toLowerCase();
  return label.includes('popular');
};

const getPlanIcon = (name) => {
  const n = String(name || '').toLowerCase();
  if (n.includes('trial')) return Star;
  if (n.includes('startup') || n.includes('starter')) return Zap;
  if (n.includes('certified') || n.includes('verified')) return ShieldCheck;
  if (n.includes('booster') || n.includes('boost')) return Sparkles;
  if (n.includes('silver')) return BadgeCheck;
  if (n.includes('gold')) return Crown;
  if (n.includes('diamond') || n.includes('dimond')) return Gem;
  return Star;
};

const Pricing = () => {
  const [billing, setBilling] = useState('yearly');
  const [open, setOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadPlans = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetchWithCsrf(apiUrl('/api/payment/plans'));
        const payload = await response.json().catch(() => ({}));

        if (!response.ok || payload?.success === false) {
          throw new Error(payload?.error || 'Failed to load plans');
        }

        const rawList = Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.plans)
            ? payload.plans
            : [];

        const nextPlans = rawList
          .filter((plan) => plan && plan.is_active !== false)
          .sort((a, b) => toNonNegativeNumber(a?.price, 0) - toNonNegativeNumber(b?.price, 0));

        if (!cancelled) {
          setPlans(nextPlans);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Failed to load pricing');
          setPlans([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadPlans();
    return () => {
      cancelled = true;
    };
  }, []);

  const mostPopularPlanId = useMemo(() => {
    if (!plans.length) return null;
    const paid = plans
      .filter((p) => toNonNegativeNumber(p?.price, 0) > 0)
      .sort((a, b) => toNonNegativeNumber(a?.price, 0) - toNonNegativeNumber(b?.price, 0));
    if (paid.length >= 2) return paid[Math.max(0, paid.length - 2)].id;
    if (paid.length === 1) return paid[0].id;
    return plans[0]?.id || null;
  }, [plans]);

  const openPlan = (plan) => {
    setSelectedPlan(plan);
    setOpen(true);
  };

  const selectedPricing = useMemo(() => {
    if (!selectedPlan) return null;
    return getBillingPricing(selectedPlan, billing);
  }, [selectedPlan, billing]);

  const selectedCoverage = useMemo(() => {
    if (!selectedPlan) return { states: 0, cities: 0 };
    return getCoverage(selectedPlan);
  }, [selectedPlan]);

  const selectedTopSlots = useMemo(() => {
    if (!selectedPlan) return 0;
    return getTopSlots(selectedPlan);
  }, [selectedPlan]);

  const selectedPlanMeta = useMemo(() => {
    if (!selectedPlan) return { groups: [], highlights: [] };
    return parsePlanMeta(selectedPlan);
  }, [selectedPlan]);

  return (
    <>
      <Helmet>
        <title>Pricing - IndianTradeMart</title>
      </Helmet>

      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 py-14">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border bg-white shadow-sm text-xs text-slate-700">
              <Crown className="w-4 h-4" />
              Vendor Subscription Plans
            </div>

            <h1 className="mt-4 text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900">
              Choose your growth plan
            </h1>
            <div className="mt-6 flex items-center justify-center gap-3">
              <Link to="/vendor/register">
                <Button className="h-10 px-5">Register as Vendor</Button>
              </Link>
              <Link to="/vendor/login">
                <Button variant="outline" className="h-10 px-5">
                  Vendor Login
                </Button>
              </Link>
            </div>

            <div className="mt-8 inline-flex rounded-full border bg-white p-1 shadow-sm">
              <button
                onClick={() => setBilling('monthly')}
                className={cx(
                  'px-4 py-2 text-sm rounded-full transition',
                  billing === 'monthly' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50'
                )}
              >
                Monthly
              </button>
              <button
                onClick={() => setBilling('yearly')}
                className={cx(
                  'px-4 py-2 text-sm rounded-full transition',
                  billing === 'yearly' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50'
                )}
              >
                Yearly
              </button>
            </div>

          </div>

          {loading ? (
            <div className="mt-12 max-w-6xl mx-auto rounded-2xl border bg-white p-8 text-center text-slate-600">
              Loading pricing plans...
            </div>
          ) : null}

          {!loading && error ? (
            <div className="mt-12 max-w-6xl mx-auto rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
              <p className="text-red-700 font-semibold">Unable to load pricing right now.</p>
              <p className="text-red-600 text-sm mt-1">{error}</p>
            </div>
          ) : null}

          {!loading && !error && plans.length === 0 ? (
            <div className="mt-12 max-w-6xl mx-auto rounded-2xl border bg-white p-8 text-center text-slate-600">
              No active plans found.
            </div>
          ) : null}

          {!loading && !error && plans.length > 0 ? (
            <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {plans.map((plan) => {
                const Icon = getPlanIcon(plan?.name);
                const pricing = getBillingPricing(plan, billing);
                const coverage = getCoverage(plan);
                const topSlots = getTopSlots(plan);
                const ranking = getRankingText(plan);
                const featureSummary = getPlanFeatureSummary(plan);
                const discountTag = getDiscountTag(pricing);
                const isFree = toNonNegativeNumber(pricing?.nowPrice, 0) === 0;
                const hasOldPrice =
                  toNonNegativeNumber(pricing?.originalPrice, 0) > toNonNegativeNumber(pricing?.nowPrice, 0);
                const isPopular = plan?.id === mostPopularPlanId || isPlanPopularFromBadge(plan);
                const compactFeatures = featureSummary.slice(0, 5);
                const hiddenFeatures = Math.max(0, featureSummary.length - compactFeatures.length);

                return (
                  <motion.button
                    key={plan?.id || plan?.name}
                    type="button"
                    onClick={() => openPlan(plan)}
                    whileHover={{ y: -4 }}
                    whileTap={{ scale: 0.99 }}
                    className="group text-left"
                  >
                    <div
                      className={cx(
                        'rounded-2xl p-[1px] transition',
                        isPopular
                          ? 'bg-gradient-to-br from-blue-500 via-emerald-500 to-indigo-500'
                          : 'bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200'
                      )}
                    >
                      <div
                        className={cx(
                          'rounded-2xl bg-white/90 backdrop-blur px-5 py-5 shadow-sm transition',
                          'hover:shadow-xl',
                          isPopular ? 'ring-1 ring-emerald-500/20' : 'ring-1 ring-slate-200/60'
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div
                              className={cx(
                                'h-10 w-10 rounded-xl grid place-items-center border',
                                isPopular ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'
                              )}
                            >
                              <Icon className={cx('w-5 h-5', isPopular ? 'text-emerald-600' : 'text-slate-700')} />
                            </div>

                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-lg font-bold text-slate-900">{plan?.name || 'Plan'}</h3>
                                <span className="text-xs px-2 py-0.5 rounded-full border bg-white text-slate-700">
                                  {getPlanTag(plan)}
                                </span>
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5">Tap card to view full details</div>
                            </div>
                          </div>

                          {isPopular ? (
                            <div className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                              MOST POPULAR
                            </div>
                          ) : null}
                        </div>

                        <div className="mt-4 flex items-end justify-between gap-3">
                          <div>
                            {isFree ? (
                              <div className="text-3xl font-extrabold text-slate-900">Rs.0</div>
                            ) : (
                              <div className="flex items-end gap-2">
                                <div className="text-3xl font-extrabold text-slate-900">
                                  Rs.{formatINR(pricing.nowPrice)}
                                </div>
                                <div className="text-sm text-slate-500">/{billing === 'monthly' ? 'month' : 'year'}</div>
                              </div>
                            )}

                            {hasOldPrice ? (
                              <div className="mt-1 text-xs text-slate-500">
                                <span className="line-through mr-2">Rs.{formatINR(pricing.originalPrice)}</span>
                                {discountTag ? (
                                  <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                                    <Sparkles className="w-3.5 h-3.5" /> {discountTag}
                                  </span>
                                ) : null}
                              </div>
                            ) : null}
                          </div>

                          <div className="text-xs text-slate-500 text-right">
                            <div className="font-semibold text-slate-700">Ranking</div>
                            <div>{ranking || '-'}</div>
                          </div>
                        </div>

                        <div className="mt-4 rounded-xl border bg-slate-50 p-3">
                          <div className="text-xs font-semibold text-slate-700 mb-2">Lead Limits</div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-lg border bg-white p-2 text-center">
                              <div className="text-[11px] text-slate-500">Daily Bonus</div>
                              <div className="text-sm font-bold text-slate-900">{Math.floor(toNonNegativeNumber(plan?.daily_limit, 0))}</div>
                            </div>
                            <div className="rounded-lg border bg-white p-2 text-center">
                              <div className="text-[11px] text-slate-500">Weekly</div>
                              <div className="text-sm font-bold text-slate-900">{Math.floor(toNonNegativeNumber(plan?.weekly_limit, 0))}</div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 space-y-2 text-sm text-slate-700">
                          <div className="flex items-center gap-2">
                            <Check className="w-4 h-4 text-emerald-600" />
                            <span>Up to {coverage.states} states</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Check className="w-4 h-4 text-emerald-600" />
                            <span>Up to {coverage.cities} cities</span>
                          </div>
                          {topSlots > 0 ? (
                            <div className="flex items-center gap-2">
                              <Check className="w-4 h-4 text-emerald-600" />
                              <span>Top level listing: {topSlots}</span>
                            </div>
                          ) : null}
                        </div>

                        <div className="mt-4 rounded-xl border bg-white p-3">
                          <div className="text-xs font-semibold text-slate-700 mb-2">Plan Features</div>
                          <div className="space-y-1.5">
                            {compactFeatures.length > 0 ? (
                              compactFeatures.map((feature, index) => (
                                <div key={`${feature.group}-${index}`} className="flex items-start gap-2 text-xs text-slate-700">
                                  <Check className="w-3.5 h-3.5 shrink-0 text-emerald-600 mt-0.5" />
                                  <span>{feature.text}</span>
                                </div>
                              ))
                            ) : (
                              <div className="text-xs text-slate-500">Tap card to view plan details.</div>
                            )}
                            {hiddenFeatures > 0 ? (
                              <div className="pl-5 text-xs font-medium text-slate-500">
                                +{hiddenFeatures} more features
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          {selectedPlan && selectedPricing ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between gap-3">
                  <span className="text-slate-900 font-extrabold">{selectedPlan.name} Plan Details</span>
                  {selectedPlan.id === mostPopularPlanId || isPlanPopularFromBadge(selectedPlan) ? (
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                      MOST POPULAR
                    </span>
                  ) : null}
                </DialogTitle>
              </DialogHeader>

              <div className="grid md:grid-cols-2 gap-6 mt-2">
                <div className="rounded-2xl border bg-gradient-to-b from-slate-50 to-white p-5">
                  <div className="text-xs text-slate-500">Billing</div>
                  <div className="mt-1 text-sm font-semibold text-slate-800">
                    {billing === 'monthly' ? 'Monthly (derived from yearly)' : 'Yearly (superadmin value)'}
                  </div>

                  <div className="mt-4">
                    {toNonNegativeNumber(selectedPricing.nowPrice, 0) <= 0 ? (
                      <div className="text-4xl font-extrabold text-slate-900">Rs.0</div>
                    ) : (
                      <>
                        <div className="flex items-end gap-2">
                          <div className="text-4xl font-extrabold text-slate-900">Rs.{formatINR(selectedPricing.nowPrice)}</div>
                          <div className="text-sm text-slate-500">/{billing === 'monthly' ? 'month' : 'year'}</div>
                        </div>
                        {toNonNegativeNumber(selectedPricing.originalPrice, 0) > toNonNegativeNumber(selectedPricing.nowPrice, 0) ? (
                          <div className="mt-1 text-sm text-slate-500">
                            <span className="line-through mr-2">Rs.{formatINR(selectedPricing.originalPrice)}</span>
                            <span className="text-emerald-700 font-semibold">{getDiscountTag(selectedPricing) || 'Discount active'}</span>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <Link to="/vendor/register">
                      <Button className="w-full">Register as Vendor</Button>
                    </Link>
                    <Link to="/vendor/login">
                      <Button variant="outline" className="w-full">
                        Vendor Login
                      </Button>
                    </Link>
                  </div>

                  <div className="mt-4 text-xs text-slate-500">
                    Note: Final activation depends on payment and verification (if applicable).
                  </div>
                </div>

                <div className="rounded-2xl border bg-white p-5">
                  <div className="text-sm font-bold text-slate-900 mb-3">What you get</div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl border bg-slate-50 p-3">
                      <div className="text-xs text-slate-500">Daily Bonus</div>
                      <div className="text-lg font-extrabold text-slate-900">{Math.floor(toNonNegativeNumber(selectedPlan?.daily_limit, 0))}</div>
                    </div>
                    <div className="rounded-xl border bg-slate-50 p-3">
                      <div className="text-xs text-slate-500">Weekly Leads</div>
                      <div className="text-lg font-extrabold text-slate-900">{Math.floor(toNonNegativeNumber(selectedPlan?.weekly_limit, 0))}</div>
                    </div>
                    <div className="rounded-xl border bg-slate-50 p-3">
                      <div className="text-xs text-slate-500">States</div>
                      <div className="text-lg font-extrabold text-slate-900">{selectedCoverage.states}</div>
                    </div>
                    <div className="rounded-xl border bg-slate-50 p-3">
                      <div className="text-xs text-slate-500">Cities</div>
                      <div className="text-lg font-extrabold text-slate-900">{selectedCoverage.cities}</div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 text-sm text-slate-700">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>Ranking: {getRankingText(selectedPlan) || '-'}</span>
                    </div>

                    {selectedTopSlots > 0 ? (
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span>Top Level (City/Services): {selectedTopSlots}</span>
                      </div>
                    ) : null}
                  </div>

                  {selectedPlanMeta.highlights.length > 0 ? (
                    <div className="mt-5 rounded-xl border bg-amber-50 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <Sparkles className="w-4 h-4 text-amber-600" />
                        Highlights
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {selectedPlanMeta.highlights.map((item, index) => (
                          <span key={index} className="rounded-full border border-amber-100 bg-white px-2.5 py-1 text-xs font-medium text-amber-800">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {selectedPlanMeta.groups.length > 0 ? (
                    <div className="mt-5 space-y-3">
                      {selectedPlanMeta.groups.map(({ title, Icon, items }) => (
                        <div key={title} className="rounded-xl border bg-slate-50 p-4">
                          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                            <Icon className="w-4 h-4 text-[#003D82]" />
                            {title}
                          </div>
                          <div className="mt-3 space-y-2">
                            {items.map((item, index) => (
                              <div key={index} className="flex items-start gap-2 text-sm text-slate-700">
                                <Check className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                                <span>{item}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-5 rounded-xl border bg-slate-50 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <Sparkles className="w-4 h-4 text-emerald-600" />
                        Plan visibility
                      </div>
                      <p className="mt-1 text-xs text-slate-600">
                        Higher plans get better placement and stronger profile trust to improve conversions.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Pricing;
