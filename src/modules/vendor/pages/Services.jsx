import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { dbClient } from '@/lib/dbClient';
import { fetchWithCsrf } from '@/lib/fetchWithCsrf';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/modules/vendor/context/AuthContext';
import { apiUrl } from '@/lib/apiBase';
import { trackGoogleAnalyticsEvent } from '@/shared/utils/googleAnalytics';
import {
  DEFAULT_PLAN_CURRENCY,
  formatPlanMoney,
  getRegionCodesForCountry,
  getVisitorMarketContext,
  normalizePlanCurrency,
  pickRegionalPriceForMarket,
} from '@/shared/utils/currency';
import {
  CheckCircle2,
  Zap,
  ShoppingCart,
  ShieldCheck,
  Rocket,
  Crown,
  Gem,
  Star,
  BarChart3,
  Headphones,
  MapPin,
  BadgeCheck,
  Award,
  Download,
  RefreshCw,
} from 'lucide-react';

// ✅ shadcn dialog (if you have it)
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter as DialogFooterUI,
} from '@/components/ui/dialog';
import { useSubdomain } from '@/contexts/SubdomainContext';

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

const getPlanDisplayPricing = (plan, marketContext) => {
  const features = asObject(plan?.features);
  const pricing = asObject(features?.pricing);
  const regionalPrice = pickRegionalPriceForMarket(
    pricing.regional_prices || pricing.localized_prices || features.regional_prices,
    marketContext
  );
  const nowPrice = Number(regionalPrice?.price ?? plan?.price ?? 0);
  const currency = normalizePlanCurrency(
    regionalPrice?.currency || pricing.currency || features.currency || plan?.currency
  );

  const configuredOriginalPrice = Number(regionalPrice?.original_price ?? pricing.original_price ?? 0);
  const configuredDiscountPercent = Number(regionalPrice?.discount_percent ?? pricing.discount_percent ?? 0);

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

  const discountLabel = String(regionalPrice?.discount_label || pricing.discount_label || '').trim();
  const rawExtraLeadPrice = Number(
    regionalPrice ? regionalPrice.extra_lead_price || 0 : pricing.extra_lead_price || 0
  );
  const extraLeadPrice = Number.isFinite(rawExtraLeadPrice) && rawExtraLeadPrice > 0 ? rawExtraLeadPrice : 0;

  return {
    nowPrice,
    originalPrice,
    discountPercent,
    discountLabel,
    extraLeadPrice,
    currency,
    isRegionalPrice: Boolean(regionalPrice),
  };
};

const MONTHLY_SELF_SERVE_PLAN_NAMES = new Set(['startup', 'certified', 'booster']);

const getDiscountTag = (pricing) => {
  const label = String(pricing?.discountLabel || '').trim();
  if (label) return label;
  const percent = Number(pricing?.discountPercent || 0);
  if (percent > 0) return `${Math.round(percent)}% OFF`;
  return '';
};

const getPlanEntitlements = (plan) => {
  const features = asObject(plan?.features);
  const purchase = asObject(features.purchase);
  const portfolio = asObject(features.portfolio);
  const certificate = asObject(features.certificate);
  const seo = asObject(features.seo);
  const channel = String(purchase.channel || '').trim().toUpperCase();
  const name = String(plan?.name || '').trim().toLowerCase();
  const price = Number(plan?.price || 0);
  const inferredSalesAssisted =
    Object.keys(purchase).length === 0 &&
    (price >= 75000 || ['silver', 'gold', 'diamond', 'dimond', 'platinum'].some((word) => name.includes(word)));
  const salesAssisted =
    channel === 'SALES_ASSISTED' ||
    purchase.sales_assisted === true ||
    purchase.public_purchase_enabled === false ||
    inferredSalesAssisted;
  const inferredTier = ['diamond', 'dimond', 'gold', 'silver', 'platinum', 'certified']
    .find((word) => name.includes(word));
  let certificateTier = String(certificate.tier || inferredTier || '').trim().toUpperCase();
  if (certificateTier === 'DIMOND') certificateTier = 'DIAMOND';

  return {
    purchase: {
      sales_assisted: salesAssisted,
      public_purchase_enabled: !salesAssisted && purchase.public_purchase_enabled !== false,
      cta_label: String(purchase.cta_label || (salesAssisted ? 'Contact sales' : 'Upgrade')).trim(),
    },
    portfolio: {
      premium: String(portfolio.template || '').trim().toUpperCase() === 'PREMIUM',
      customizable: portfolio.customizable === true,
      custom_url: portfolio.custom_url === true,
      sitemap_customization: portfolio.sitemap_customization === true,
    },
    certificate: {
      enabled: certificate.enabled === true || Boolean(salesAssisted && certificateTier),
      tier: certificateTier,
      title: String(certificate.title || '').trim(),
    },
    seo: {
      enabled: seo.enabled === true,
      custom_keywords: seo.custom_keywords === true,
      city_category_pages: Number(seo.city_category_pages || 0),
      url_aliases: Number(seo.url_aliases || 0),
    },
  };
};

const isSalesAssistedPlan = (plan) => getPlanEntitlements(plan).purchase.sales_assisted;
const isVisibleCatalogPlan = (plan) => {
  const name = String(plan?.name || '').trim().toLowerCase();
  if (!name) return false;
  const purchase = asObject(asObject(plan?.features).purchase);
  return Object.keys(purchase).length > 0;
};

const isMonthlyBillingEnabled = (plan) => {
  const name = String(plan?.name || '').trim().toLowerCase();
  if (!MONTHLY_SELF_SERVE_PLAN_NAMES.has(name) || isSalesAssistedPlan(plan)) return false;
  const pricing = asObject(asObject(plan?.features).pricing);
  return pricing.monthly_enabled !== false;
};

const getPlanBillingPricing = (plan, marketContext, billingCycle = 'yearly') => {
  const annual = getPlanDisplayPricing(plan, marketContext);
  if (billingCycle !== 'monthly' || !isMonthlyBillingEnabled(plan)) {
    return {
      ...annual,
      billingCycle: 'yearly',
      interval: 'year',
      durationDays: Math.max(1, Number(plan?.duration_days || 365)),
    };
  }

  const features = asObject(plan?.features);
  const pricing = asObject(features?.pricing);
  const configuredMonthly = Number(pricing.monthly_price || 0);
  const configuredOriginalMonthly = Number(pricing.monthly_original_price ?? pricing.original_monthly_price ?? 0);
  const nowPrice = Number.isFinite(configuredMonthly) && configuredMonthly > 0
    ? configuredMonthly
    : Number((annual.nowPrice / 12).toFixed(2));
  const originalPrice = Number.isFinite(configuredOriginalMonthly) && configuredOriginalMonthly > 0
    ? configuredOriginalMonthly
    : Number((annual.originalPrice / 12).toFixed(2));

  return {
    ...annual,
    nowPrice,
    originalPrice,
    billingCycle: 'monthly',
    interval: 'month',
    durationDays: Math.max(1, Number(pricing.monthly_duration_days || 30)),
  };
};

const getReferralDisplaySummary = (preview, baseAmount = 0, currency = DEFAULT_PLAN_CURRENCY) => {
  const normalizedType = String(preview?.configured_discount_type || '').toUpperCase();
  const type = normalizedType || null;
  const valueRaw = Number(preview?.configured_discount_value || 0);
  const value = Number.isFinite(valueRaw) ? Math.max(0, valueRaw) : 0;
  const capRaw = Number(preview?.configured_discount_cap);
  const cap = Number.isFinite(capRaw) && capRaw > 0 ? capRaw : null;
  const percentRaw = Number(preview?.display_discount_percent ?? preview?.discount_percent ?? 0);
  const percent = Number.isFinite(percentRaw) ? Math.max(0, percentRaw) : 0;
  const amount = Number(baseAmount || 0);
  const expectedPercentDiscount = type === 'PERCENT' && value > 0 && amount > 0
    ? (amount * value) / 100
    : 0;
  const capApplied = Boolean(cap && expectedPercentDiscount > cap + 0.01);
  const capText = capApplied ? ` (max ${formatPlanMoney(cap, currency)})` : '';

  if (type === 'FLAT' && value > 0) {
    const amountLabel = formatPlanMoney(value, currency);
    return {
      type,
      value,
      cap,
      percent,
      capApplied,
      promoText: `Referral ${amountLabel} OFF${capText}`,
      breakdownText: `Referral (${amountLabel} OFF${capText})`,
      includedText: `Referral discount (${amountLabel}) is already included above.`,
    };
  }

  const roundedPercent = Math.round(percent);
  return {
    type,
    value,
    cap,
    percent,
    capApplied,
    promoText: `Referral ${roundedPercent}% OFF${capText}`,
    breakdownText: `Referral (${roundedPercent}% OFF${capText})`,
    includedText: `Referral discount (${roundedPercent}%) is already included above.`,
  };
};

const normalizeCouponCode = (value) =>
  String(value || '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 32);

const normalizeSalesCode = (value) =>
  String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 32);

const extractApiErrorMessage = async (response, fallbackMessage) => {
  const fallback = fallbackMessage || `Request failed (${response?.status || 500})`;
  if (!response) return fallback;

  const contentType = String(response.headers?.get('content-type') || '').toLowerCase();
  if (contentType.includes('application/json')) {
    const payload = await response.json().catch(() => ({}));
    return payload?.error || payload?.message || fallback;
  }

  const text = await response.text().catch(() => '');
  const trimmed = String(text || '').trim();
  if (!trimmed || trimmed.startsWith('<')) return fallback;
  try {
    const parsed = JSON.parse(trimmed);
    return parsed?.error || parsed?.message || fallback;
  } catch {
    return trimmed || fallback;
  }
};

const badgeStyle = (variant) => {
  switch ((variant || '').toLowerCase()) {
    case 'green':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'blue':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'purple':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'gold':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'diamond':
      return 'bg-slate-50 text-slate-800 border-slate-200';
    case 'slate':
      return 'bg-slate-50 text-slate-700 border-slate-200';
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200';
  }
};

const planIcon = (name) => {
  const n = (name || '').toLowerCase();
  if (n.includes('trial')) return <Star className="w-5 h-5" />;
  if (n.includes('starter')) return <Zap className="w-5 h-5" />;
  if (n.includes('verified')) return <ShieldCheck className="w-5 h-5" />;
  if (n.includes('boost')) return <Rocket className="w-5 h-5" />;
  if (n.includes('silver')) return <BadgeCheck className="w-5 h-5" />;
  if (n.includes('gold')) return <Crown className="w-5 h-5" />;
  if (n.includes('dimond') || n.includes('diamond')) return <Gem className="w-5 h-5" />;
  return <Star className="w-5 h-5" />;
};

const Services = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { resolvePath } = useSubdomain();
  const leadsPath = resolvePath('leads', 'vendor');
  const [plans, setPlans] = useState([]);
  const [currentSub, setCurrentSub] = useState(null);
  const [quota, setQuota] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fatalError, setFatalError] = useState(null);
  const [vendorId, setVendorId] = useState(null);
  const [couponCode, setCouponCode] = useState('');
  const [salesCode, setSalesCode] = useState(() => {
    if (typeof window === 'undefined') return '';
    return normalizeSalesCode(window.localStorage?.getItem('itm_sales_code') || '');
  });
  const [referralOffersByPlan, setReferralOffersByPlan] = useState({});
  const [referralOfferSettings, setReferralOfferSettings] = useState({
    is_enabled: false,
    first_paid_plan_only: true,
  });
  const [visitorMarket, setVisitorMarket] = useState(() => getVisitorMarketContext());
  const TRIAL_PLAN_ID = '7fee24d0-de18-44d3-a357-be7b40492a1a'; // Trial plan UUID
  const TRIAL_DURATION_DAYS = 30;

  // ✅ dialog state
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [selectedBillingCycle, setSelectedBillingCycle] = useState('yearly');
  const [linkedPlanHandled, setLinkedPlanHandled] = useState(false);
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [monthlyTrialUsed, setMonthlyTrialUsed] = useState(false);

  useEffect(() => {
    const codeFromUrl = normalizeSalesCode(
      searchParams.get('sales_code') ||
        searchParams.get('sales') ||
        searchParams.get('sc') ||
        ''
    );
    if (!codeFromUrl) return;
    setSalesCode(codeFromUrl);
    try {
      window.localStorage?.setItem('itm_sales_code', codeFromUrl);
    } catch {
      // Storage can be unavailable in private browsing; checkout still carries state.
    }
  }, [searchParams]);

  const mostPopularPlanId = useMemo(() => {
    if (!plans?.length) return null;
    const paid = plans
      .filter((p) => !isSalesAssistedPlan(p) && Number(getPlanDisplayPricing(p, visitorMarket).nowPrice || 0) > 0)
      .sort(
        (a, b) =>
          Number(getPlanDisplayPricing(a, visitorMarket).nowPrice || 0) -
          Number(getPlanDisplayPricing(b, visitorMarket).nowPrice || 0)
      );
    if (paid.length >= 2) return paid[Math.max(0, paid.length - 2)].id;
    if (paid.length === 1) return paid[0].id;
    return plans[0].id;
  }, [plans, visitorMarket]);

  const parsePlanMeta = (plan) => {
    const rawFeatures = plan?.features;

    if (Array.isArray(rawFeatures)) {
      return {
        badge: { label: plan.name, variant: 'neutral' },
        highlights: rawFeatures.map(String),
        visibility: [],
        leads: [],
        support: [],
        analytics: [],
        coverage: [],
      };
    }

    const f = asObject(rawFeatures);
    if (Object.keys(f).length === 0) {
      return {
        badge: { label: plan.name, variant: 'neutral' },
        highlights: [],
        visibility: [],
        leads: [],
        support: [],
        analytics: [],
        coverage: [],
      };
    }

    const badge = f.badge || { label: plan.name, variant: 'neutral' };
    const visibility = [];
    const leads = [];
    const support = [];
    const analytics = [];
    const coverage = [];
    const portfolioMeta = asObject(f.portfolio);
    const certificateMeta = asObject(f.certificate);
    const seoMeta = asObject(f.seo);

    // Coverage
    const coverageMeta = asObject(f.coverage);
    const statesLimit = Number(coverageMeta.states_limit ?? f.states_limit);
    const citiesLimit = Number(coverageMeta.cities_limit ?? f.cities_limit);
    if (Number.isFinite(statesLimit) && statesLimit >= 0) coverage.push(`Up to ${Math.floor(statesLimit)} states`);
    if (Number.isFinite(citiesLimit) && citiesLimit >= 0) coverage.push(`Up to ${Math.floor(citiesLimit)} cities`);

    // Visibility
    if (f.listing?.highlight) visibility.push('Highlighted listing');
    if (f.listing?.featured) visibility.push('Featured listing');
    if (f.listing?.homepage_featured) visibility.push('Homepage featured');
    if (f.listing?.category_top_ranking) visibility.push('Category top ranking');
    if (f.listing?.home_category_boost) visibility.push('Category boost');
    if (typeof f.listing?.top_slots === 'number' && f.listing.top_slots > 0) {
      visibility.push(`${f.listing.top_slots} top slots`);
    }
    if (f.verification?.trust_seal) visibility.push('Trust seal');
    if (f.listing?.profile_verified_tick) visibility.push('Verified tick on profile');
    if (String(portfolioMeta?.template || '').toUpperCase() === 'PREMIUM') visibility.push('Premium portfolio page');
    if (portfolioMeta?.customizable) visibility.push('Customizable portfolio sections');
    if (portfolioMeta?.custom_url) visibility.push('Custom vendor profile URL');
    if (portfolioMeta?.sitemap_customization) visibility.push('Custom sitemap expansion');

    // Leads
    if (f.leads?.priority_leads) leads.push('Priority leads');
    if (f.leads?.exclusive_leads) leads.push('Exclusive leads');
    if (f.leads?.early_access_leads) leads.push('Early access leads');
    if (f.leads?.rfq_access) leads.push('RFQ access');
    if (f.leads?.direct_call_whatsapp) leads.push('Direct call/WhatsApp');

    // Support
    if (f.support?.level) support.push(`${String(f.support.level).toUpperCase()} support`);
    if (f.support?.response_sla_hours) support.push(`SLA ${f.support.response_sla_hours} hrs`);
    if (f.support?.account_manager) support.push('Dedicated account manager');

    // Analytics
    if (f.analytics?.enabled) analytics.push('Analytics dashboard');
    if (f.analytics?.export_csv) analytics.push('Export reports (CSV)');
    if (f.analytics?.campaign_insights) analytics.push('Campaign insights');
    if (f.analytics?.competitor_insights) analytics.push('Competitor insights');
    if (seoMeta?.enabled) analytics.push('SEO-ready profile structure');
    if (seoMeta?.custom_keywords) analytics.push('Custom SEO keywords');
    if (Number(seoMeta?.city_category_pages || 0) > 0) {
      analytics.push(`${Math.floor(Number(seoMeta.city_category_pages))} SEO city/category pages`);
    }

    const highlights = [];
    if (badge?.label) highlights.push(`Badge: ${badge.label}`);
    if (f.verification?.kyc_required) highlights.push('KYC required');
    if (certificateMeta?.enabled) {
      highlights.push(certificateMeta?.title || `${certificateMeta?.tier || 'Certified'} vendor certificate`);
    }

    return { badge, highlights, visibility, leads, support, analytics, coverage };
  };

  useEffect(() => {
    const fetchVendorId = async () => {
      try {
        const {
          data: { user: authUser },
        } = await dbClient.auth.getUser();
        if (!authUser) {
          setLoading(false);
          return;
        }

        const { data: vendor, error } = await dbClient
          .from('vendors')
          .select('id')
          .eq('user_id', authUser.id)
          .maybeSingle();

        if (error) throw error;
        setVendorId(vendor?.id || null);
        if (!vendor?.id) setLoading(false);
      } catch (e) {
        console.error('Error fetching vendor ID:', e);
        setLoading(false);
      }
    };

    if (user && !vendorId) fetchVendorId();
  }, [user, vendorId]);

  useEffect(() => {
    let cancelled = false;

    const loadMarketContext = async () => {
      try {
        const response = await fetchWithCsrf(apiUrl('/api/payment/market-context'));
        const payload = await response.json().catch(() => ({}));
        const countryCode = String(payload?.data?.country_code || '').trim().toUpperCase();
        const source = String(payload?.data?.source || '').trim() || 'fallback';

        if (!response.ok || !payload?.success || !countryCode || source === 'fallback') return;
        if (cancelled) return;

        setVisitorMarket((current) => {
          if (current?.source === 'query' || current?.source === 'stored') return current;
          if (current?.countryCode === countryCode && current?.source === source) return current;
          return {
            countryCode,
            regionCodes: getRegionCodesForCountry(countryCode),
            source,
          };
        });
      } catch (error) {
        console.warn('Market context lookup failed:', error);
      }
    };

    loadMarketContext();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (vendorId) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId]);

  const ensureTrialActive = async () => {
    try {
      const { data: active, error: actErr } = await dbClient
        .from('vendor_plan_subscriptions')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('status', 'ACTIVE')
        .maybeSingle();
      if (!actErr && active) return active;

      // Activate trial automatically
      const start = new Date();
      const end = new Date(start.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);
      const { data: trial, error: trialErr } = await dbClient
        .from('vendor_plan_subscriptions')
        .insert([{
          vendor_id: vendorId,
          plan_id: TRIAL_PLAN_ID,
          start_date: start.toISOString(),
          end_date: end.toISOString(),
          status: 'ACTIVE',
          plan_duration_days: TRIAL_DURATION_DAYS,
          auto_renewal_enabled: false,
          renewal_notification_sent: false
        }])
        .select()
        .single();
      if (trialErr) throw trialErr;
      toast({ title: 'Trial Activated', description: 'Free trial plan started automatically.' });
      return trial;
    } catch (e) {
      console.error('Trial activation failed', e);
      setFatalError(e?.message || 'Trial activation failed');
      return null;
    }
  };

  const loadData = async () => {
    setLoading(true);
    setFatalError(null);
    try {
      // Force fresh data from MySQL (no cache)
      const { data: plansData, error: plansErr } = await dbClient
        .from('vendor_plans')
        .select('*')
        .eq('is_active', true)
        .order('price', { ascending: true });

      if (plansErr) throw plansErr;
      setPlans((plansData || []).filter(isVisibleCatalogPlan));

      try {
        const eligibilityResponse = await fetchWithCsrf(
          apiUrl(`/api/payment/monthly-trial-eligibility/${encodeURIComponent(vendorId)}`)
        );
        const eligibilityPayload = await eligibilityResponse.json().catch(() => ({}));
        if (!eligibilityResponse.ok) {
          throw new Error(eligibilityPayload?.error || 'Monthly trial eligibility lookup failed');
        }
        setMonthlyTrialUsed(Boolean(eligibilityPayload?.data?.monthly_trial_used));
      } catch (eligibilityError) {
        console.warn('Monthly trial eligibility lookup failed:', eligibilityError);
        setMonthlyTrialUsed(false);
      }

      try {
        const referralResponse = await fetchWithCsrf(apiUrl(`/api/payment/referral-offers/${vendorId}`));
        const referralPayload = await referralResponse.json().catch(() => ({}));
        if (referralResponse.ok && referralPayload?.success) {
          const nextSettings = referralPayload?.data?.settings || {};
          const nextOffers =
            referralPayload?.data?.offers && typeof referralPayload.data.offers === 'object'
              ? referralPayload.data.offers
              : {};
          setReferralOfferSettings({
            is_enabled: Boolean(nextSettings?.is_enabled),
            first_paid_plan_only: Boolean(nextSettings?.first_paid_plan_only),
          });
          setReferralOffersByPlan(nextOffers);
        } else {
          setReferralOfferSettings({ is_enabled: false, first_paid_plan_only: true });
          setReferralOffersByPlan({});
        }
      } catch (referralPreviewError) {
        console.warn('Referral offer preview load failed:', referralPreviewError);
        setReferralOfferSettings({ is_enabled: false, first_paid_plan_only: true });
        setReferralOffersByPlan({});
      }

      // Query for ACTIVE subscription - this will get the latest one
      const { data: subs, error: subsErr } = await dbClient
        .from('vendor_plan_subscriptions')
        .select('*, plan:vendor_plans(*)')
        .eq('vendor_id', vendorId)
        .eq('status', 'ACTIVE')
        .order('start_date', { ascending: false })
        .limit(1);

      if (subsErr) throw subsErr;
      const nowIso = new Date().toISOString();
      const activeRows = Array.isArray(subs) ? subs : [];
      // Get the most recent non-expired active subscription
      let currentActive =
        activeRows.find((row) => !row?.end_date || String(row.end_date) > nowIso) || null;
      if (!currentActive) {
        currentActive = await ensureTrialActive();
      }
      setCurrentSub(currentActive);

      const { data: q, error: qErr } = await dbClient
        .from('vendor_lead_quota')
        .select('*')
        .eq('vendor_id', vendorId)
        .maybeSingle();

      if (qErr) throw qErr;
      setQuota(q);
    } catch (e) {
      console.error('Error loading subscription data:', e);
      setFatalError(e?.message || 'Failed to load subscription data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (plan, couponOverride = couponCode, billingCycle = selectedBillingCycle) => {
    if (!vendorId) {
      toast({ title: 'Error', description: 'Vendor ID not found', variant: 'destructive' });
      return;
    }

    if (isSalesAssistedPlan(plan)) {
      const planName = String(plan?.name || 'this plan').trim();
      toast({
        title: 'Sales-assisted plan',
        description: `${planName} will be activated by the sales team after consultation.`,
      });
      setDetailsOpen(false);
      const subject = encodeURIComponent(`Sales-assisted plan request: ${planName}`);
      const body = encodeURIComponent(`Vendor ID: ${vendorId}\nPlan: ${planName}\nSales code: ${salesCode || '-'}\n\nPlease contact me for activation.`);
      window.location.href = `mailto:sales@indiantrademart.com?subject=${subject}&body=${body}`;
      return;
    }

    const pricing = getPlanBillingPricing(plan, visitorMarket, billingCycle);
    if (pricing.billingCycle === 'monthly' && monthlyTrialUsed) {
      toast({
        title: 'Monthly trial already used',
        description:
          'Monthly checkout for Startup, Certified and Booster is available only once. Please choose yearly billing to upgrade or switch plans.',
        variant: 'destructive',
      });
      setSelectedBillingCycle('yearly');
      return;
    }

    // Check if plan is free
    if (!pricing.nowPrice || Number(pricing.nowPrice) === 0) {
      // Free plan - activate directly without payment
      toast({ title: 'Processing...', description: `Subscribing to ${plan.name}` });
      try {
        if (currentSub && currentSub.id) {
          await dbClient
            .from('vendor_plan_subscriptions')
            .update({ status: 'INACTIVE' })
            .eq('id', currentSub.id);
        }

        const durationDays = Math.max(1, Number(pricing.durationDays || plan.duration_days || 365));
        const startDate = new Date();
        const endDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

        await dbClient.from('vendor_plan_subscriptions').insert({
          vendor_id: vendorId,
          plan_id: plan.id,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          status: 'ACTIVE',
          plan_duration_days: durationDays,
          billing_cycle: pricing.billingCycle === 'monthly' ? 'MONTHLY' : 'YEARLY',
          sales_code: salesCode || null,
          auto_renewal_enabled: false,
          renewal_notification_sent: false
        });

        const quotaPayload = {
          vendor_id: vendorId,
          plan_id: plan.id,
          daily_used: 0,
          daily_limit: Math.max(0, Number(plan?.daily_limit || 0)),
          weekly_used: 0,
          weekly_limit: Math.max(0, Number(plan?.weekly_limit || 0)),
          yearly_used: 0,
          yearly_limit: 0,
          last_reset_date: startDate.toISOString(),
          updated_at: startDate.toISOString(),
        };

        const { data: existingQuota } = await dbClient
          .from('vendor_lead_quota')
          .select('id')
          .eq('vendor_id', vendorId)
          .maybeSingle();

        if (existingQuota?.id) {
          await dbClient
            .from('vendor_lead_quota')
            .update(quotaPayload)
            .eq('vendor_id', vendorId);
        } else {
          await dbClient.from('vendor_lead_quota').insert(quotaPayload);
        }

        toast({ title: 'Success!', description: 'Plan activated.' });
        if (pricing.billingCycle === 'monthly') {
          setMonthlyTrialUsed(true);
          setSelectedBillingCycle('yearly');
        }
        setDetailsOpen(false);
        setTimeout(() => {
          loadData();
        }, 500);
      } catch (e) {
        console.error('Subscription error:', e);
        toast({ title: 'Error', description: e.message, variant: 'destructive' });
        setTimeout(() => loadData(), 500);
      }
      return;
    }

    // Paid plan - initiate Razorpay payment
    if (pricing.currency !== 'INR') {
      toast({
        title: 'Manual billing required',
        description: `${plan.name} is priced in ${pricing.currency}. Online checkout is currently available for INR plans only.`,
        variant: 'destructive',
      });
      return;
    }

    initiateRazorpayPayment(plan, couponOverride, pricing.billingCycle);
  };
  const initiateRazorpayPayment = async (plan, couponOverride = couponCode, billingCycle = 'yearly') => {
    try {
      const normalizedBillingCycle = String(billingCycle || 'yearly').toLowerCase();
      if (normalizedBillingCycle === 'monthly' && monthlyTrialUsed) {
        toast({
          title: 'Monthly trial already used',
          description:
            'Monthly checkout can be used once only. Please continue with yearly billing.',
          variant: 'destructive',
        });
        setSelectedBillingCycle('yearly');
        return;
      }

      toast({ title: 'Processing...', description: `Initiating payment for ${plan.name}` });
      setDetailsOpen(false);
      const appliedCoupon = normalizeCouponCode(couponOverride);

      const response = await fetchWithCsrf(apiUrl('/api/payment/initiate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor_id: vendorId,
          plan_id: plan.id,
          billing_cycle: normalizedBillingCycle,
          coupon_code: appliedCoupon || undefined,
          sales_code: salesCode || undefined,
        }),
      });

      if (!response.ok) {
        const message = await extractApiErrorMessage(response, `Payment API error (${response.status})`);
        throw new Error(message);
      }
      const data = await response.json();
      if (data?.activated) {
        toast({
          title: 'Success!',
          description: data?.message || 'Coupon applied and subscription activated.',
        });
        if (normalizedBillingCycle === 'monthly' || String(data?.billing_cycle || '').toLowerCase() === 'monthly') {
          setMonthlyTrialUsed(true);
          setSelectedBillingCycle('yearly');
        }
        setCouponCode('');
        setTimeout(() => {
          loadData();
        }, 500);
        return;
      }

      const orderData = data.order;
      const keyId = data.key_id || import.meta.env.VITE_RAZORPAY_KEY_ID;
      const effectiveOfferCode = normalizeCouponCode(orderData?.coupon_code || appliedCoupon);
      const effectiveSalesCode = normalizeSalesCode(orderData?.sales_code || salesCode);

      if (!keyId) {
        toast({
          title: 'Payment Config Missing',
          description: 'Razorpay Key ID missing. Add VITE_RAZORPAY_KEY_ID in .env.local (frontend) or RAZORPAY_KEY_ID in server .env.',
          variant: 'destructive',
        });
        return;
      }

      // Load Razorpay script dynamically if not loaded
      if (!window.Razorpay) {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        script.onload = () => openRazorpayCheckout(orderData, plan, keyId, effectiveOfferCode, effectiveSalesCode);
        script.onerror = () => {
          toast({ 
            title: 'Warning', 
            description: 'Razorpay script failed to load. Retrying...', 
            variant: 'default' 
          });
          // Retry loading script after 2 seconds
          setTimeout(() => {
            const retryScript = document.createElement('script');
            retryScript.src = 'https://checkout.razorpay.com/v1/checkout.js';
            retryScript.async = true;
            retryScript.onload = () => openRazorpayCheckout(orderData, plan, keyId, effectiveOfferCode, effectiveSalesCode);
            retryScript.onerror = () => {
              toast({ 
                title: 'Error', 
                description: 'Failed to load payment system. Please try again.', 
                variant: 'destructive' 
              });
            };
            document.body.appendChild(retryScript);
          }, 2000);
        };
        document.body.appendChild(script);
      } else {
        openRazorpayCheckout(orderData, plan, keyId, effectiveOfferCode, effectiveSalesCode);
      }
    } catch (err) {
      toast({ title: 'Error', description: err?.message || 'Failed to initiate payment', variant: 'destructive' });
      console.error(err);
    }
  };

  const openRazorpayCheckout = (orderData, plan, keyId, appliedCoupon = couponCode, appliedSalesCode = salesCode) => {
    const options = {
      key: keyId,
      amount: orderData.amount,
      currency: orderData.currency,
      name: 'Indian Trade Mart',
      description: `Subscription: ${plan.name}`,
      order_id: orderData.id,
      prefill: {
        email: orderData.vendor_email,
      },
      handler: async (response) => {
        try {
          const verifyResponse = await fetchWithCsrf(apiUrl('/api/payment/verify'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              order_id: orderData.id,
              payment_id: response.razorpay_payment_id,
              signature: response.razorpay_signature,
              vendor_id: vendorId,
              plan_id: plan.id,
              billing_cycle: orderData?.billing_cycle || selectedBillingCycle,
              coupon_code: appliedCoupon || undefined,
              sales_code: normalizeSalesCode(appliedSalesCode) || undefined,
            }),
          });

          if (!verifyResponse.ok) {
            const message = await extractApiErrorMessage(
              verifyResponse,
              `Payment verification failed (${verifyResponse.status})`
            );
            throw new Error(message);
          }
          await verifyResponse.json();

          trackGoogleAnalyticsEvent('purchase', {
            transaction_id: orderData.id,
            currency: orderData.currency || 'INR',
            value: Number(orderData.amount) > 0 ? Number(orderData.amount) / 100 : undefined,
            itm_user_role: 'vendor',
            itm_vendor_id: vendorId,
            items: [
              {
                item_id: plan.id,
                item_name: plan.name,
                item_category: 'Subscription',
                price: Number(orderData.amount) > 0 ? Number(orderData.amount) / 100 : undefined,
                quantity: 1,
              },
            ],
          });

          toast({ title: 'Success!', description: 'Subscription activated! Invoice sent to your email.' });
          if (String(orderData?.billing_cycle || selectedBillingCycle).toLowerCase() === 'monthly') {
            setMonthlyTrialUsed(true);
            setSelectedBillingCycle('yearly');
          }
          setTimeout(() => {
            loadData();
          }, 500);
        } catch (err) {
          toast({ title: 'Error', description: err?.message || 'Payment verification failed', variant: 'destructive' });
          console.error(err);
        }
      },
      modal: {
        confirm_close: true,
        escape: false,
        backdropclose: false,
        ondismiss: () => {
          toast({ title: 'Payment Cancelled', description: 'Your payment was cancelled.', variant: 'destructive' });
        },
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  };

  // Check if subscription is active and not expired
  const isSubscriptionActive = (sub) => {
    if (!sub) return false;
    if (sub.status !== 'ACTIVE') return false;
    const endDate = new Date(sub.end_date);
    return endDate > new Date();
  };

  // Calculate days remaining
  const getDaysRemaining = (sub) => {
    if (!sub?.end_date) return 0;
    const end = new Date(sub.end_date);
    const now = new Date();
    const daysLeft = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    return Math.max(0, daysLeft);
  };

  const buyLeads = async () => {
    navigate(leadsPath);
  };

  const openPlanDetails = (plan) => {
    setSelectedPlan(plan);
    setSelectedBillingCycle('yearly');
    setCouponCode('');
    setDetailsOpen(true);
  };

  useEffect(() => {
    if (linkedPlanHandled || loading || !plans.length) return;
    const planId = String(searchParams.get('plan') || searchParams.get('plan_id') || '').trim();
    if (!planId) return;

    const linkedPlan = plans.find((plan) => String(plan?.id || '') === planId);
    if (!linkedPlan) return;

    setSelectedPlan(linkedPlan);
    setSelectedBillingCycle('yearly');
    setCouponCode('');
    setDetailsOpen(true);
    setLinkedPlanHandled(true);
  }, [linkedPlanHandled, loading, plans, searchParams]);

  const fetchPaymentHistory = async () => {
    if (!vendorId) return;
    try {
      setLoadingHistory(true);
      const response = await fetchWithCsrf(apiUrl(`/api/payment/history/${vendorId}`));
      if (response.ok) {
        const data = await response.json();
        setPaymentHistory(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching payment history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleOpenPaymentHistory = async () => {
    setShowPaymentHistory(true);
    if (paymentHistory.length === 0) {
      await fetchPaymentHistory();
    }
  };

  const handleDownloadCertificate = () => {
    window.open(apiUrl('/api/vendors/me/certificate.pdf'), '_blank', 'noopener,noreferrer');
  };

  const buildGroups = (plan) => {
    const meta = parsePlanMeta(plan);

    const groups = [
      { title: 'Visibility', icon: <Star className="w-4 h-4" />, items: meta.visibility },
      { title: 'Leads', icon: <Rocket className="w-4 h-4" />, items: meta.leads },
      { title: 'Support', icon: <Headphones className="w-4 h-4" />, items: meta.support },
      { title: 'Analytics', icon: <BarChart3 className="w-4 h-4" />, items: meta.analytics },
      { title: 'Coverage', icon: <MapPin className="w-4 h-4" />, items: meta.coverage },
    ].filter((g) => (g.items || []).length > 0);

    // ✅ small card key points (mix)
    const keyBenefits = groups.flatMap((g) => g.items.map((it) => ({ group: g.title, text: it })));

    return { meta, groups, keyBenefits };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[420px]">
        <div className="text-center">
          <Zap className="w-12 h-12 text-slate-300 mx-auto mb-2 animate-pulse" />
          <p className="text-slate-500">Loading subscription plans...</p>
          {fatalError && <p className="text-red-600 text-sm mt-2">{fatalError}</p>}
        </div>
      </div>
    );
  }

  if (!vendorId) {
    return (
      <div className="flex items-center justify-center min-h-[420px]">
        <div className="text-center text-slate-600">
          <p className="text-lg font-semibold">Vendor profile not found</p>
          <p className="text-sm text-slate-500 mt-1">Please log in as a vendor to view subscriptions.</p>
          {fatalError && <p className="text-red-600 text-sm mt-2">{fatalError}</p>}
        </div>
      </div>
    );
  }

  if (fatalError) {
    return (
      <div className="flex items-center justify-center min-h-[420px]">
        <div className="text-center text-red-600">
          <p className="text-lg font-semibold">Error loading subscriptions</p>
          <p className="text-sm mt-1">{fatalError}</p>
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            disabled={!vendorId}
            onClick={loadData}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const selected = selectedPlan ? buildGroups(selectedPlan) : null;
  const selectedIsCurrent = selectedPlan && currentSub?.plan_id === selectedPlan.id;
  const selectedIsPopular = selectedPlan && selectedPlan.id === mostPopularPlanId;
  const selectedPlanEntitlements = selectedPlan ? getPlanEntitlements(selectedPlan) : null;
  const selectedSalesAssisted = Boolean(selectedPlanEntitlements?.purchase?.sales_assisted);
  const selectedMonthlyConfigured = selectedPlan ? isMonthlyBillingEnabled(selectedPlan) : false;
  const selectedMonthlyAvailable = selectedMonthlyConfigured && !monthlyTrialUsed;
  const selectedEffectiveBillingCycle =
    selectedMonthlyAvailable && selectedBillingCycle === 'monthly' ? 'monthly' : 'yearly';
  const selectedPricing = selectedPlan
    ? getPlanBillingPricing(selectedPlan, visitorMarket, selectedEffectiveBillingCycle)
    : {
        nowPrice: 0,
        originalPrice: 0,
        discountPercent: 0,
        discountLabel: '',
        extraLeadPrice: 0,
        currency: DEFAULT_PLAN_CURRENCY,
        billingCycle: 'yearly',
        interval: 'year',
        durationDays: 365,
      };
  const selectedDiscountTag = getDiscountTag(selectedPricing);
  const selectedReferralPreview =
    selectedPlan && selectedEffectiveBillingCycle === 'yearly' && selectedPricing.currency === DEFAULT_PLAN_CURRENCY
      ? referralOffersByPlan?.[selectedPlan.id] || null
      : null;
  const selectedReferralDiscountRaw = Number(selectedReferralPreview?.discount_amount || 0);
  const selectedReferralDiscountAmount = Number.isFinite(selectedReferralDiscountRaw)
    ? Math.max(0, selectedReferralDiscountRaw)
    : 0;
  const selectedReferralNetRaw = Number(selectedReferralPreview?.net_amount ?? selectedPricing.nowPrice);
  const selectedReferralNetAmount = Number.isFinite(selectedReferralNetRaw)
    ? Math.max(0, selectedReferralNetRaw)
    : selectedPricing.nowPrice;
  const selectedReferralSummary = getReferralDisplaySummary(
    selectedReferralPreview,
    selectedPricing.nowPrice,
    selectedPricing.currency
  );
  const selectedHasReferralPreview =
    selectedReferralDiscountAmount > 0 && selectedReferralNetAmount < selectedPricing.nowPrice;
  const selectedPayableBase = selectedHasReferralPreview
    ? selectedReferralNetAmount
    : selectedPricing.nowPrice;
  const currentPlan = currentSub?.plan || plans.find((plan) => plan?.id === currentSub?.plan_id) || null;
  const currentPlanEntitlements = currentPlan ? getPlanEntitlements(currentPlan) : null;

  if (!plans.length && !loading && !fatalError) {
    return (
      <div className="flex items-center justify-center min-h-[420px]">
        <div className="text-center text-slate-600">
          <p className="text-lg font-semibold">No subscription plans loaded</p>
          <p className="text-sm text-slate-500 mt-1">vendorId: {vendorId || 'N/A'} | currentSub: {currentSub?.plan_id || 'none'}</p>
          <p className="text-xs text-slate-400 mt-2">This is a debug fallback; if you see this, plans fetch returned empty.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full min-w-0 space-y-6">
      {/* Header */}
      <div className="rounded-2xl border bg-white p-6 md:p-8 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Subscription Plans</h1>
            <p className="text-slate-600 mt-1">Choose a plan to get more visibility, more leads, and premium support.</p>
          </div>

          <div className="flex gap-2 items-center flex-col sm:flex-row">
            {/* ✅ Subscription Status */}
            {currentSub && (
              <div className={cx(
                'px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 whitespace-nowrap',
                isSubscriptionActive(currentSub)
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              )}>
                <Crown className="w-4 h-4" />
                {isSubscriptionActive(currentSub) ? (
                  <span>{getDaysRemaining(currentSub)} days left</span>
                ) : (
                  <span>Plan Expired</span>
                )}
              </div>
            )}

            <Button
              variant="outline"
              onClick={buyLeads}
              disabled={!isSubscriptionActive(currentSub)}
              className={cx(
                'bg-white',
                !isSubscriptionActive(currentSub) && 'opacity-50 cursor-not-allowed'
              )}
              title={!isSubscriptionActive(currentSub) ? 'Please subscribe to a plan first' : ''}
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              Buy Leads
            </Button>
            {currentPlanEntitlements?.certificate?.enabled ? (
              <Button
                variant="outline"
                onClick={handleDownloadCertificate}
                className="bg-white"
              >
                <Award className="w-4 h-4 mr-2" />
                Certificate
              </Button>
            ) : null}
            <div className="bg-slate-50 text-slate-700 text-xs border border-dashed rounded-lg px-3 py-2 w-full sm:w-auto text-center sm:text-left">
              Tap a card or <span className="font-semibold">Upgrade</span> to open plan details and apply coupon before payment.
            </div>

            <Button
              variant="outline"
              onClick={handleOpenPaymentHistory}
              className="bg-white"
            >
              <Download className="w-4 h-4 mr-2" />
              Invoice History
            </Button>
          </div>
        </div>

        {/* Quota */}
        {quota && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { label: 'Daily', used: quota.daily_used, limit: quota.daily_limit },
              { label: 'Weekly', used: quota.weekly_used, limit: quota.weekly_limit },
              { label: 'Yearly', used: quota.yearly_used, limit: quota.yearly_limit },
            ].map((x) => (
              <div key={x.label} className="rounded-xl border bg-gradient-to-b from-slate-50 to-white p-4">
                <div className="text-xs text-slate-500 uppercase">{x.label} Usage</div>
                <div className="mt-1 text-xl font-bold text-slate-900">
                  {x.used} <span className="text-slate-400 text-sm">/ {x.limit}</span>
                </div>
                <div className="mt-2 h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-slate-900/80"
                    style={{ width: `${Math.min(100, (Number(x.used || 0) / Math.max(1, Number(x.limit || 0))) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cards (COMPACT) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {plans.map((plan) => {
          const isCurrent = currentSub?.plan_id === plan.id;
          const isPopular = plan.id === mostPopularPlanId;
          const pricing = getPlanDisplayPricing(plan, visitorMarket);
          const monthlyConfigured = isMonthlyBillingEnabled(plan);
          const monthlyAvailable = monthlyConfigured && !monthlyTrialUsed;
          const monthlyPricing = monthlyConfigured
            ? getPlanBillingPricing(plan, visitorMarket, 'monthly')
            : null;
          const discountTag = getDiscountTag(pricing);
          const referralPreview =
            pricing.currency === DEFAULT_PLAN_CURRENCY ? referralOffersByPlan?.[plan.id] || null : null;
          const referralDiscountAmountRaw = Number(referralPreview?.discount_amount || 0);
          const referralDiscountAmount = Number.isFinite(referralDiscountAmountRaw)
            ? Math.max(0, referralDiscountAmountRaw)
            : 0;
          const referralNetAmountRaw = Number(referralPreview?.net_amount ?? pricing.nowPrice);
          const referralNetAmount = Number.isFinite(referralNetAmountRaw)
            ? Math.max(0, referralNetAmountRaw)
            : pricing.nowPrice;
          const referralSummary = getReferralDisplaySummary(referralPreview, pricing.nowPrice, pricing.currency);
          const hasReferralPreview = referralDiscountAmount > 0 && referralNetAmount < pricing.nowPrice;

          const { meta, keyBenefits } = buildGroups(plan);
          const badge = meta.badge || {};
          const badgeLabel = badge.label || plan.name;
          const badgeVariant = badge.variant || 'neutral';
          const planEntitlements = getPlanEntitlements(plan);
          const salesAssisted = planEntitlements.purchase.sales_assisted;

          const compactBenefits = keyBenefits.slice(0, 3);
          const moreCount = Math.max(0, keyBenefits.length - compactBenefits.length);

          return (
            <Card
              key={plan.id}
              role="button"
              tabIndex={0}
              onClick={(e) => {
                // Guard: interactive children (like Upgrade button) must not trigger card handler
                if (e.target?.closest?.('[data-plan-action]')) return;
                openPlanDetails(plan);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') openPlanDetails(plan);
              }}
              className={cx(
                'relative overflow-hidden rounded-2xl transition-all cursor-pointer outline-none',
                'bg-white border shadow-sm hover:shadow-md hover:-translate-y-[1px]',
                isPopular && !isCurrent ? 'border-blue-300 ring-1 ring-blue-100' : '',
                isCurrent ? 'border-emerald-300 ring-2 ring-emerald-200 shadow-md' : ''
              )}
            >
              {/* Top ribbon */}
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200" />
              {isPopular && !isCurrent && !salesAssisted && (
                <div className="absolute top-3 right-3 text-[11px] px-2.5 py-1 rounded-full border bg-blue-50 text-blue-700 border-blue-200 font-semibold">
                  MOST POPULAR
                </div>
              )}
              {salesAssisted && !isCurrent && (
                <div className="absolute top-3 right-3 text-[11px] px-2.5 py-1 rounded-full border bg-slate-900 text-white border-slate-800 font-semibold">
                  SALES ASSISTED
                </div>
              )}
              {isCurrent && (
                <div className="absolute top-3 right-3 text-[11px] px-2.5 py-1 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold">
                  CURRENT PLAN
                </div>
              )}

              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl border bg-slate-50 flex items-center justify-center text-slate-900">
                      {planIcon(plan.name)}
                    </div>
                    <div>
                      <CardTitle className="text-base">{plan.name}</CardTitle>
                      <div
                        className={cx(
                          'mt-1 inline-flex items-center gap-2 text-[11px] px-2 py-1 rounded-full border font-medium',
                          badgeStyle(badgeVariant)
                        )}
                      >
                        {badgeLabel}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-end justify-between">
                  <div>
                    {pricing.originalPrice > pricing.nowPrice ? (
                      <div className="text-xs text-slate-400 line-through">
                        {formatPlanMoney(pricing.originalPrice, pricing.currency)}
                      </div>
                    ) : null}
                    <div className="text-2xl font-extrabold text-slate-900">
                      {formatPlanMoney(pricing.nowPrice, pricing.currency)}
                      <span className="text-xs font-medium text-slate-500">/year</span>
                    </div>
                    {salesAssisted ? (
                      <div className="mt-1 text-[11px] font-semibold text-slate-700">
                        Managed activation by sales team
                      </div>
                    ) : null}
                    {monthlyAvailable && monthlyPricing ? (
                      <div className="mt-1 text-[11px] font-semibold text-blue-700">
                        One-time monthly trial: {formatPlanMoney(monthlyPricing.nowPrice, monthlyPricing.currency)} / month
                      </div>
                    ) : null}
                    {monthlyConfigured && monthlyTrialUsed ? (
                      <div className="mt-1 text-[11px] font-semibold text-slate-600">
                        Monthly trial used. Yearly billing only.
                      </div>
                    ) : null}
                    {hasReferralPreview ? (
                      <div className="mt-1 space-y-0.5">
                        <div className="text-[11px] font-semibold text-emerald-700">
                          {referralSummary.promoText}
                          {referralOfferSettings?.first_paid_plan_only ? ' • first paid purchase' : ''}
                        </div>
                        <div className="text-sm font-bold text-emerald-700">
                          {formatPlanMoney(referralNetAmount, pricing.currency)} / year after referral
                        </div>
                      </div>
                    ) : null}
                    {discountTag ? (
                      <div className="mt-1 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                        {discountTag}
                      </div>
                    ) : null}
                    {pricing.extraLeadPrice > 0 ? (
                      <div className="mt-1 text-[11px] font-medium text-slate-600">
                        Extra lead: {formatPlanMoney(pricing.extraLeadPrice, pricing.currency)} / lead
                      </div>
                    ) : null}
                    <div className="text-[12px] text-slate-500 mt-1">Tap card to view full details</div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {/* Lead Limits compact */}
                <div className="rounded-xl border bg-slate-50 px-3 py-3">
                  <div className="text-[11px] font-semibold text-slate-700 mb-2">Lead Limits</div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-white border px-2 py-2">
                      <div className="text-[10px] text-slate-500">Daily</div>
                      <div className="text-sm font-bold text-slate-900">{plan.daily_limit}</div>
                    </div>
                    <div className="rounded-lg bg-white border px-2 py-2">
                      <div className="text-[10px] text-slate-500">Weekly</div>
                      <div className="text-sm font-bold text-slate-900">{plan.weekly_limit}</div>
                    </div>
                    <div className="rounded-lg bg-white border px-2 py-2">
                      <div className="text-[10px] text-slate-500">Yearly</div>
                      <div className="text-sm font-bold text-slate-900">{plan.yearly_limit}</div>
                    </div>
                  </div>
                </div>

                {/* Highlights compact */}
                <div className="rounded-xl border bg-white p-3">
                  <div className="text-[11px] font-semibold text-slate-700 mb-2">Top Benefits</div>
                  <div className="space-y-1.5">
                    {compactBenefits.map((b, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-[12px] text-slate-700">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-[1px]" />
                        <span>{b.text}</span>
                      </div>
                    ))}
                    {moreCount > 0 && (
                      <div className="text-[12px] text-slate-500 pl-6">
                        +{moreCount} more benefits (tap to view)
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>

              <CardFooter className="pt-1">
                {isCurrent ? (
                  <div
                    className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-center text-sm font-semibold text-emerald-700"
                    role="status"
                  >
                    Current plan
                  </div>
                ) : (
                  <Button
                    data-plan-action="upgrade"
                    className="w-full rounded-xl h-10 font-semibold"
                    onClick={(e) => {
                      // Upgrade opens details modal first so coupon can be applied before checkout.
                      e.preventDefault();
                      e.stopPropagation();
                      openPlanDetails(plan);
                    }}
                  >
                    {salesAssisted ? 'Contact sales' : 'Upgrade'}
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* ✅ Plan Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="mx-auto max-h-[90vh] w-[calc(100vw-1.5rem)] w-[44vw] overflow-y-auto p-0 sm:w-[86vw] md:w-[72vw] md:w-[76vw] lg:w-[66vw]">
          {!selectedPlan ? null : (
            <div className="space-y-3">
              <DialogHeader className="border-b bg-white px-3 pb-3 pt-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl border bg-slate-50 flex items-center justify-center text-slate-900">
                      {planIcon(selectedPlan.name)}
                    </div>
                    <div>
                      <DialogTitle className="text-xl">{selectedPlan.name}</DialogTitle>
                      <DialogDescription className="mt-1">
                        Full plan details • Price & benefits
                      </DialogDescription>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    {selectedIsPopular && !selectedIsCurrent && !selectedSalesAssisted && (
                      <div className="text-[11px] px-2.5 py-1 rounded-full border bg-blue-50 text-blue-700 border-blue-200 font-semibold">
                        MOST POPULAR
                      </div>
                    )}
                    {selectedSalesAssisted && !selectedIsCurrent && (
                      <div className="text-[11px] px-2.5 py-1 rounded-full border bg-slate-900 text-white border-slate-800 font-semibold">
                        SALES ASSISTED
                      </div>
                    )}
                    {selectedIsCurrent && (
                      <div className="text-[11px] px-2.5 py-1 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold">
                        CURRENT PLAN
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-2.5">
                  <div className="rounded-xl border bg-gradient-to-r from-blue-600 via-indigo-600 to-slate-800 text-white px-4 py-2.5 flex items-center justify-between gap-3 shadow-md">
                    <div>
                      <div className="text-xs uppercase tracking-[0.15em] text-white/70 font-semibold">
                        {selectedSalesAssisted
                          ? 'Managed activation'
                          : selectedEffectiveBillingCycle === 'monthly'
                            ? 'Monthly billing'
                            : 'Annual billing'}
                      </div>
                      {selectedPricing.originalPrice > selectedPricing.nowPrice ? (
                        <div className="text-xs text-white/60 line-through">
                          {formatPlanMoney(selectedPricing.originalPrice, selectedPricing.currency)}
                        </div>
                      ) : null}
                      {selectedHasReferralPreview ? (
                        <div className="text-xs text-white/60 line-through">
                          {formatPlanMoney(selectedPricing.nowPrice, selectedPricing.currency)}
                        </div>
                      ) : null}
                      <div className="text-3xl font-extrabold leading-tight">
                        {formatPlanMoney(selectedPayableBase, selectedPricing.currency)}
                        <span className="text-sm font-medium text-white/80"> / {selectedPricing.interval || 'year'}</span>
                      </div>
                      {selectedMonthlyConfigured ? (
                        <div className="mt-3 inline-flex rounded-full border border-white/25 bg-white/10 p-1 shadow-sm">
                          {[
                            ['monthly', 'Monthly'],
                            ['yearly', 'Yearly'],
                          ].map(([value, label]) => (
                            <button
                              key={value}
                              type="button"
                              disabled={value === 'monthly' && monthlyTrialUsed}
                              onClick={() => {
                                if (value === 'monthly' && monthlyTrialUsed) return;
                                setSelectedBillingCycle(value);
                              }}
                              className={cx(
                                'rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
                                selectedEffectiveBillingCycle === value
                                  ? 'bg-white text-blue-700 shadow-sm'
                                  : 'text-white/85 hover:bg-white/10'
                              )}
                            >
                              {value === 'monthly' && monthlyTrialUsed ? 'Monthly used' : label}
                            </button>
                          ))}
                        </div>
                      ) : null}
                      {selectedMonthlyConfigured ? (
                        <div className="mt-1.5 max-w-md text-[11px] font-medium leading-4 text-white/75">
                          {monthlyTrialUsed
                            ? 'Your one-time monthly trial has been used. Every upgrade or plan switch now uses yearly billing.'
                            : 'Monthly billing is a one-time trial shared across Startup, Certified and Booster. After activation, future purchases are yearly only.'}
                        </div>
                      ) : null}
                      {selectedSalesAssisted ? (
                        <div className="mt-1 text-xs font-medium text-white/80">
                          Sales team activates this plan with portfolio, SEO and certificate setup.
                        </div>
                      ) : null}
                      {selectedDiscountTag ? (
                        <div className="mt-1 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                          {selectedDiscountTag}
                        </div>
                      ) : null}
                      {selectedHasReferralPreview ? (
                        <div className="mt-1 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                          {selectedReferralSummary.promoText}
                          {referralOfferSettings?.first_paid_plan_only ? ' • first paid purchase' : ''}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                        <span className="px-3 py-1 rounded-full border border-white/30 bg-white/10 font-semibold text-xs">
                          {selectedPricing.durationDays || selectedPlan.duration_days || 365} days
                        </span>
                      {selectedIsPopular && (
                        <span className="px-3 py-1 rounded-full bg-white text-blue-700 font-semibold shadow-sm">
                          Recommended
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-1.5 px-3">
                {/* lead limits */}
                <div className="rounded-2xl border bg-slate-50 p-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Lead Limits</div>
                    <div className="text-[11px] text-slate-500">
                      Per subscription {selectedEffectiveBillingCycle === 'monthly' ? 'month' : 'year'}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 text-center">
                    {[
                      { label: 'Daily', value: selectedPlan.daily_limit },
                      { label: 'Weekly', value: selectedPlan.weekly_limit },
                      { label: 'Yearly', value: selectedPlan.yearly_limit },
                    ].map((stat) => (
                      <div key={stat.label} className="rounded-lg bg-white border shadow-sm px-2 py-2">
                        <div className="text-[10px] text-slate-500">{stat.label}</div>
                        <div className="text-base font-extrabold text-slate-900">{stat.value}</div>
                      </div>
                    ))}
                  </div>
                  {selectedPricing.extraLeadPrice > 0 ? (
                    <div className="text-[11px] text-slate-600 font-medium text-right">
                      Extra lead price: {formatPlanMoney(selectedPricing.extraLeadPrice, selectedPricing.currency)} / lead
                    </div>
                  ) : null}
                </div>

                {/* highlights full */}
                {selected?.meta?.highlights?.length > 0 && (
                  <div className="rounded-2xl border bg-white p-2 shadow-sm">
                    <div className="text-sm font-semibold text-slate-900 mb-1.5 flex items-center gap-2">
                      <Star className="w-4 h-4 text-amber-500" />
                      Highlights
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selected.meta.highlights.map((t, idx) => (
                        <span key={idx} className="text-[11px] px-2.5 py-1 rounded-full border bg-amber-50 text-amber-800 border-amber-100">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* groups full */}
                <div className="space-y-1.5">
                  {selected?.groups?.map((g) => (
                    <div key={g.title} className="rounded-2xl border bg-white p-2 shadow-sm">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <span className="text-slate-600">{g.icon}</span>
                        {g.title}
                      </div>
                      <div className="mt-3 space-y-2">
                        {g.items.map((line, i) => (
                          <div key={i} className="flex gap-2 text-sm text-slate-700">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-[2px]" />
                            <span>{line}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooterUI className="mt-0 flex flex-col gap-2 border-t bg-white px-3 py-3">
                <div className="w-full rounded-2xl border bg-gradient-to-br from-slate-50 via-white to-slate-50 p-3 space-y-2.5 shadow-sm">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 items-stretch">
                    <div className="rounded-2xl bg-white border px-3.5 py-3 shadow-inner space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-[12px] font-semibold text-slate-800 uppercase tracking-wide">Coupon</div>
                          <div className="text-sm text-slate-500">Optional • Apply before payment</div>
                        </div>
                        {couponCode.trim() && (
                          <button
                            type="button"
                            onClick={() => setCouponCode('')}
                            className="text-[11px] text-slate-500 hover:text-slate-700 underline"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Enter coupon code"
                          value={couponCode}
                          onChange={(e) => setCouponCode(normalizeCouponCode(e.target.value))}
                          className="w-full h-11 text-sm"
                          disableAutoSanitize
                        />
                        <Button
                          variant="secondary"
                          className="h-11 whitespace-nowrap px-3 text-sm font-semibold"
                          onClick={() => {
                            const val = normalizeCouponCode(couponCode);
                            if (!val) {
                              toast({ title: 'Coupon', description: 'Enter a code first' });
                              return;
                            }
                            setCouponCode(val);
                            toast({ title: 'Coupon noted', description: `${val} will be applied before payment.` });
                          }}
                        >
                          Apply
                        </Button>
                      </div>
                      <p className="text-[11px] text-slate-600">
                        If you don&apos;t have a coupon, leave this blank and continue.
                      </p>
                      {selectedHasReferralPreview ? (
                        <p className="text-[11px] font-semibold text-emerald-700">
                          {selectedReferralSummary.includedText}
                        </p>
                      ) : null}
                    </div>

                    <div className="rounded-2xl bg-white border px-3.5 py-3 shadow-[inset_0_1px_10px_rgba(15,23,42,0.05)] space-y-2">
                      {selectedPricing.originalPrice > selectedPricing.nowPrice ? (
                        <div className="flex justify-between text-xs text-slate-400 leading-tight">
                          <span>Old price</span>
                          <span className="line-through">
                            {formatPlanMoney(selectedPricing.originalPrice, selectedPricing.currency)}
                          </span>
                        </div>
                      ) : null}
                      <div className="flex justify-between text-sm text-slate-700 leading-tight">
                        <span>Plan price</span>
                        <span className="font-semibold text-slate-800">
                          {formatPlanMoney(selectedPricing.nowPrice, selectedPricing.currency)}
                        </span>
                      </div>
                      {selectedHasReferralPreview ? (
                        <div className="flex justify-between text-sm text-emerald-700 font-semibold">
                          <span>{selectedReferralSummary.breakdownText}</span>
                          <span>-{formatPlanMoney(selectedReferralDiscountAmount, selectedPricing.currency)}</span>
                        </div>
                      ) : null}
                      {selectedDiscountTag ? (
                        <div className="flex justify-between text-sm text-emerald-700 font-semibold">
                          <span>Offer</span>
                          <span>{selectedDiscountTag}</span>
                        </div>
                      ) : null}
                      {couponCode.trim() ? (
                        <div className="flex justify-between text-sm text-amber-700 font-semibold">
                          <span>Coupon {couponCode.trim().toUpperCase()}</span>
                          <span>- to be applied</span>
                        </div>
                      ) : (
                        <div className="flex justify-between text-sm text-slate-500">
                          <span>Coupon</span>
                          <span>Not applied</span>
                        </div>
                      )}
                      <div className="border-t pt-2.5 flex justify-between text-base font-bold text-slate-900">
                        <span>Payable now</span>
                        <span>{formatPlanMoney(selectedPayableBase, selectedPricing.currency)}</span>
                      </div>
                      {selectedHasReferralPreview && referralOfferSettings?.first_paid_plan_only ? (
                        <div className="text-[11px] text-emerald-700 text-right">
                          Referral benefit is valid only on first paid purchase.
                        </div>
                      ) : null}
                      {couponCode.trim() && (
                        <div className="text-[11px] text-amber-700 text-right">Final amount updates after validation</div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full">
                  <Button
                    variant="outline"
                    className="w-full h-12"
                    onClick={() => setDetailsOpen(false)}
                  >
                    Close
                  </Button>
                  {selectedIsCurrent ? (
                    <div
                      className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm font-semibold text-emerald-700"
                      role="status"
                    >
                      This is your current active plan.
                    </div>
                  ) : (
                    <>
                      <Button
                        className="w-full rounded-xl h-12 font-semibold text-base"
                        onClick={() => handleSubscribe(selectedPlan, couponCode, selectedEffectiveBillingCycle)}
                      >
                        {selectedSalesAssisted ? 'Contact sales' : couponCode.trim() ? 'Apply & Proceed' : 'Proceed to Pay'}
                      </Button>
                      {!selectedSalesAssisted && couponCode.trim() && (
                        <Button
                          variant="ghost"
                          className="w-full h-12 border border-dashed border-slate-200"
                          onClick={() => handleSubscribe(selectedPlan, '', selectedEffectiveBillingCycle)}
                        >
                          Proceed without coupon
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </DialogFooterUI>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment History Dialog */}
      <Dialog open={showPaymentHistory} onOpenChange={setShowPaymentHistory}>
        <DialogContent className="w-[44vw]">
          <DialogHeader>
            <DialogTitle>Payment & Invoice History</DialogTitle>
            <DialogDescription>View your past payments and download invoices</DialogDescription>
          </DialogHeader>

          <div className="mt-4 max-h-[60vh] overflow-y-auto space-y-3">
            {loadingHistory ? (
              <div className="flex items-center justify-center py-8">
                <Zap className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            ) : paymentHistory.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <p>No payment history found</p>
              </div>
            ) : (
              paymentHistory.map((payment) => {
                const discountValue = Number(payment.discount_amount || 0);
                const netAmount = Number(payment.net_amount ?? payment.amount ?? 0);
                const baseAmount = Number(payment.amount ?? 0);

                return (
                  <div
                    key={payment.id}
                    onClick={() => setSelectedPayment(selectedPayment?.id === payment.id ? null : payment)}
                    className="rounded-xl border p-4 cursor-pointer hover:bg-slate-50 transition"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-semibold text-slate-900">{payment.description}</div>
                        <div className="text-sm text-slate-500 mt-1">
                          {new Date(payment.payment_date).toLocaleDateString('en-IN')}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-slate-900">₹{baseAmount.toFixed(2)}</div>
                        <div
                          className={cx(
                            'text-[11px] font-semibold mt-1 px-2 py-1 rounded-full',
                            payment.status === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-yellow-50 text-yellow-700'
                          )}
                        >
                          {payment.status}
                        </div>
                      </div>
                    </div>

                    {selectedPayment?.id === payment.id && (
                      <div className="mt-4 pt-4 border-t space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                            <span className="text-slate-600">Plan price</span>
                            <span className="font-semibold text-slate-900">₹{baseAmount.toFixed(2)}</span>
                          </div>
                          {(discountValue > 0 || payment.coupon_code) && (
                            <div className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-amber-800 font-semibold">
                              <span>Coupon {payment.coupon_code || ''}</span>
                              <span>-₹{discountValue.toFixed(2)}</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 sm:col-span-2">
                            <span className="text-emerald-800 font-semibold">Paid (net)</span>
                            <span className="font-bold text-emerald-900">₹{netAmount.toFixed(2)}</span>
                          </div>
                        </div>

                        {payment.transaction_id && (
                          <div className="text-sm">
                            <span className="text-slate-600">Transaction ID: </span>
                            <span className="font-mono text-slate-900">{payment.transaction_id}</span>
                          </div>
                        )}
                        {payment.invoice_url && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              const link = document.createElement('a');
                              link.href = payment.invoice_url;
                              link.download = `invoice-${payment.transaction_id}.pdf`;
                              link.click();
                            }}
                            className="w-full"
                          >
                            📄 Download Invoice
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Services;
