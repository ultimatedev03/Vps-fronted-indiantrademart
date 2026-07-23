import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Copy,
  Gift,
  Info,
  Megaphone,
  Sparkles,
  TicketPercent,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { vendorCampaignApi } from '@/modules/vendor/services/vendorCampaignApi';
import { setGlobalModalOpen, suppressQuotePopup } from '@/shared/utils/popupCoordinator';

const STYLE_MAP = {
  INFO: {
    Icon: Info,
    eyebrow: 'Marketplace update',
    panel: 'border-sky-200 bg-sky-50',
    icon: 'bg-sky-100 text-sky-700',
    accent: 'text-sky-700',
  },
  SUCCESS: {
    Icon: CheckCircle2,
    eyebrow: 'Special benefit',
    panel: 'border-emerald-200 bg-emerald-50',
    icon: 'bg-emerald-100 text-emerald-700',
    accent: 'text-emerald-700',
  },
  WARNING: {
    Icon: AlertTriangle,
    eyebrow: 'Limited-time update',
    panel: 'border-amber-200 bg-amber-50',
    icon: 'bg-amber-100 text-amber-700',
    accent: 'text-amber-700',
  },
  PREMIUM: {
    Icon: Sparkles,
    eyebrow: 'Exclusive vendor offer',
    panel: 'border-orange-200 bg-orange-50',
    icon: 'bg-orange-100 text-orange-700',
    accent: 'text-orange-700',
  },
};

const createBrowserId = () => (
  typeof window.crypto?.randomUUID === 'function'
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
);

const getSessionKey = (surface) => {
  if (typeof window === 'undefined') return 'server-session';
  const storageKey = `itm-${surface}-campaign-session`;
  const existing = window.sessionStorage.getItem(storageKey);
  if (existing) return existing;

  const generated = createBrowserId();
  window.sessionStorage.setItem(storageKey, generated);
  return generated;
};

const getHomepageVisitorId = () => {
  if (typeof window === 'undefined') return 'server-homepage-visitor';
  const storageKey = 'itm-homepage-campaign-visitor';
  const existing = window.localStorage.getItem(storageKey);
  if (existing) return existing;

  const generated = createBrowserId();
  window.localStorage.setItem(storageKey, generated);
  return generated;
};

const formatRemaining = (endsAt, nowMs) => {
  const remainingMs = new Date(endsAt).getTime() - nowMs;
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return 'Offer ended';

  const totalSeconds = Math.floor(remainingMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m ${seconds}s remaining`;
};

const formatDiscount = (campaign) => {
  const value = Number(campaign?.discount_value || 0);
  if (!value) return '';
  if (String(campaign?.discount_type || '').toUpperCase() === 'PERCENT') {
    return `${value}% off`;
  }
  return `INR ${value.toLocaleString('en-IN')} off`;
};

const copyText = async (value) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const input = document.createElement('textarea');
  input.value = value;
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  document.execCommand('copy');
  input.remove();
};

const VendorCampaignPopup = ({
  enabled = true,
  previewMode = false,
  audienceKey = '',
  surface = 'vendor',
}) => {
  const navigate = useNavigate();
  const isHomepage = surface === 'homepage';
  const [campaigns, setCampaigns] = useState([]);
  const [campaignIndex, setCampaignIndex] = useState(0);
  const [nowMs, setNowMs] = useState(Date.now());
  const trackedImpressions = useRef(new Set());
  const sessionKey = useMemo(() => getSessionKey(surface), [surface]);
  const visitorId = useMemo(() => (isHomepage ? getHomepageVisitorId() : ''), [isHomepage]);
  const campaign = campaigns[campaignIndex] || null;

  const track = useCallback((item, eventType, metadata = {}) => {
    if (!item?.id || previewMode) return;
    const payload = {
      event_type: eventType,
      session_key: sessionKey,
      metadata: {
        path: window.location.pathname,
        ...metadata,
      },
    };
    const request = isHomepage
      ? vendorCampaignApi.homepageTrack(item.id, { ...payload, visitor_id: visitorId })
      : vendorCampaignApi.track(item.id, payload);
    request.catch(() => undefined);
  }, [isHomepage, previewMode, sessionKey, visitorId]);

  useEffect(() => {
    if (!enabled) {
      setCampaigns([]);
      setCampaignIndex(0);
      return undefined;
    }

    let cancelled = false;
    let retryTimer = null;
    trackedImpressions.current.clear();

    const loadCampaigns = async (attempt = 0) => {
      try {
        const payload = isHomepage
          ? await vendorCampaignApi.homepageActive({ visitorId })
          : await vendorCampaignApi.active({ preview: previewMode });
        if (!cancelled) {
          setCampaigns(Array.isArray(payload?.campaigns) ? payload.campaigns : []);
          setCampaignIndex(0);
        }
      } catch {
        if (cancelled) return;
        if (attempt < 2) {
          retryTimer = window.setTimeout(() => loadCampaigns(attempt + 1), 1200 * (attempt + 1));
          return;
        }
        setCampaigns([]);
      }
    };

    const timer = window.setTimeout(() => loadCampaigns(), 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, [audienceKey, enabled, isHomepage, previewMode, visitorId]);

  useEffect(() => {
    if (!campaign?.id || trackedImpressions.current.has(campaign.id)) return;
    trackedImpressions.current.add(campaign.id);
    track(campaign, 'IMPRESSION');
  }, [campaign, track]);

  useEffect(() => {
    if (!isHomepage || !campaign?.id) return undefined;
    setGlobalModalOpen(true);
    suppressQuotePopup(120_000);
    return () => setGlobalModalOpen(false);
  }, [campaign?.id, isHomepage]);

  useEffect(() => {
    if (!campaign?.ends_at) return undefined;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [campaign?.ends_at]);

  useEffect(() => {
    if (!campaign?.ends_at) return;
    if (new Date(campaign.ends_at).getTime() > nowMs) return;
    setCampaignIndex((current) => current + 1);
  }, [campaign?.ends_at, nowMs]);

  const dismiss = useCallback(() => {
    if (!campaign?.dismissible) return;
    track(campaign, 'DISMISS');
    setCampaignIndex((current) => current + 1);
  }, [campaign, track]);

  const handleCopyCode = async () => {
    if (!campaign?.coupon_code) return;
    try {
      await copyText(campaign.coupon_code);
      track(campaign, 'COPY_CODE');
      toast({
        title: 'Coupon copied',
        description: isHomepage
          ? `${campaign.coupon_code} is ready. Sign in as a vendor to use it at checkout.`
          : `${campaign.coupon_code} is ready to use at checkout.`,
      });
    } catch {
      toast({ title: 'Could not copy coupon', variant: 'destructive' });
    }
  };

  const handleCta = () => {
    if (!campaign?.cta_url) return;
    track(campaign, 'CLICK', { destination: campaign.cta_url });
    if (campaign.cta_url.startsWith('/')) {
      navigate(campaign.cta_url);
      setCampaignIndex((current) => current + 1);
      return;
    }
    window.location.assign(campaign.cta_url);
  };

  if (!campaign) return null;

  const baseStyle = STYLE_MAP[campaign.style_variant] || STYLE_MAP.INFO;
  const style = campaign.style_variant === 'PREMIUM' && isHomepage
    ? { ...baseStyle, eyebrow: 'Marketplace exclusive' }
    : baseStyle;
  const CampaignIcon = campaign.campaign_type === 'ANNOUNCEMENT'
    ? Megaphone
    : campaign.campaign_type === 'COUPON'
      ? Gift
      : TicketPercent;
  const discountLabel = formatDiscount(campaign);
  const remainingLabel = formatRemaining(campaign.ends_at, nowMs);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) dismiss(); }}>
      <DialogContent
        aria-describedby="vendor-campaign-description"
        className={`w-[calc(100vw-2rem)] max-w-lg gap-0 overflow-hidden border-0 p-0 shadow-2xl sm:!w-full sm:!max-w-lg ${campaign.dismissible ? '' : '[&>button.absolute]:hidden'}`}
        onEscapeKeyDown={(event) => { if (!campaign.dismissible) event.preventDefault(); }}
        onPointerDownOutside={(event) => { if (!campaign.dismissible) event.preventDefault(); }}
      >
        <div className="border-b border-slate-200 bg-slate-950 px-6 py-5 text-white">
          <div className="flex items-start gap-4 pr-7">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-orange-500 text-slate-950">
              <CampaignIcon className="h-5 w-5" aria-hidden="true" />
            </span>
            <DialogHeader className="space-y-2 text-left">
              <p className="text-xs font-semibold uppercase text-orange-300">
                {previewMode ? 'Superadmin preview' : style.eyebrow}
              </p>
              <DialogTitle className="text-xl font-semibold leading-tight text-white sm:text-2xl">
                {campaign.title}
              </DialogTitle>
              <DialogDescription id="vendor-campaign-description" className="text-sm leading-6 text-slate-300">
                {campaign.message}
              </DialogDescription>
            </DialogHeader>
          </div>
        </div>

        <div className="space-y-5 bg-white px-6 py-5">
          <div className={`flex items-center justify-between gap-3 rounded-md border px-4 py-3 ${style.panel}`}>
            <div className="flex min-w-0 items-center gap-3">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${style.icon}`}>
                <style.Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500">Valid until</p>
                <p className={`truncate text-sm font-semibold ${style.accent}`}>{remainingLabel}</p>
              </div>
            </div>
            {discountLabel ? (
              <span className="shrink-0 text-sm font-bold text-slate-950">{discountLabel}</span>
            ) : null}
          </div>

          {campaign.coupon_code ? (
            <div className="flex items-center gap-3 border-y border-dashed border-slate-300 py-4">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase text-slate-500">Your coupon code</p>
                <p className="mt-1 truncate font-mono text-lg font-bold text-slate-950">{campaign.coupon_code}</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handleCopyCode}>
                <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
                Copy
              </Button>
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Clock3 className="h-4 w-4" aria-hidden="true" />
              <span>{campaign.dismissible ? 'You can review this later.' : 'Action is required to continue.'}</span>
            </div>
            {campaign.cta_url && campaign.cta_label ? (
              <Button type="button" onClick={handleCta} className="bg-[#003D82] hover:bg-[#002f64]">
                {campaign.cta_label}
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Button>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VendorCampaignPopup;
