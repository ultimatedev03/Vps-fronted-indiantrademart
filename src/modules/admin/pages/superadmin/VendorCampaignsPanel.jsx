import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Eye,
  Globe2,
  Megaphone,
  MousePointerClick,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
  TicketPercent,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { superAdminServerApi } from '@/modules/admin/services/superAdminServerApi';
import { toast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

const CAMPAIGN_TYPES = [
  { value: 'ANNOUNCEMENT', label: 'Announcement', icon: Megaphone },
  { value: 'DISCOUNT', label: 'Discount', icon: TicketPercent },
  { value: 'COUPON', label: 'Coupon', icon: TicketPercent },
];

const PLACEMENT_OPTIONS = [
  {
    value: 'VENDOR_PORTAL',
    label: 'Vendor portal',
    description: 'Show after an authenticated vendor enters the portal.',
    icon: Building2,
  },
  {
    value: 'HOMEPAGE',
    label: 'Homepage',
    description: 'Show to public visitors on the main marketplace homepage.',
    icon: Globe2,
  },
];

const STYLE_OPTIONS = [
  { value: 'INFO', label: 'Information' },
  { value: 'SUCCESS', label: 'Success' },
  { value: 'WARNING', label: 'Urgent' },
  { value: 'PREMIUM', label: 'Premium' },
];

const STATUS_STYLES = {
  ACTIVE: 'border-emerald-700 bg-emerald-950 text-emerald-300',
  SCHEDULED: 'border-cyan-700 bg-cyan-950 text-cyan-300',
  PAUSED: 'border-neutral-700 bg-neutral-800 text-neutral-300',
  EXPIRED: 'border-amber-800 bg-amber-950 text-amber-300',
};

const PREVIEW_STYLES = {
  INFO: 'border-cyan-700 bg-cyan-950/60',
  SUCCESS: 'border-emerald-700 bg-emerald-950/60',
  WARNING: 'border-amber-700 bg-amber-950/60',
  PREMIUM: 'border-orange-600 bg-neutral-900',
};

const pad = (value) => String(value).padStart(2, '0');

const toLocalInput = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const addDuration = (base, amount, unit = 'hours') => {
  const date = base ? new Date(base) : new Date();
  if (unit === 'days') date.setDate(date.getDate() + amount);
  else date.setHours(date.getHours() + amount);
  return date;
};

const initialForm = () => {
  const start = new Date();
  start.setSeconds(0, 0);
  return {
    name: '',
    campaign_type: 'ANNOUNCEMENT',
    placement: 'VENDOR_PORTAL',
    title: '',
    message: '',
    style_variant: 'INFO',
    cta_label: 'View details',
    cta_url: '/vendor/dashboard',
    target_type: 'ALL',
    target_vendor_ids: [],
    starts_at: toLocalInput(start),
    ends_at: toLocalInput(addDuration(start, 24)),
    is_active: true,
    priority: 50,
    dismissible: true,
    max_impressions_per_vendor: 1,
    coupon_code: '',
    discount_type: 'PERCENT',
    discount_value: 10,
    plan_id: 'ALL',
    max_uses: 0,
  };
};

const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
};

const campaignToForm = (campaign) => ({
  ...initialForm(),
  ...campaign,
  target_vendor_ids: Array.isArray(campaign.target_vendor_ids) ? campaign.target_vendor_ids : [],
  starts_at: toLocalInput(campaign.starts_at),
  ends_at: toLocalInput(campaign.ends_at),
  plan_id: campaign.plan_id || 'ALL',
  discount_value: campaign.discount_value ?? 10,
  max_uses: campaign.max_uses ?? 0,
});

const remainingLabel = (endsAt) => {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return 'Expired';
  const hours = Math.ceil(ms / 3_600_000);
  if (hours <= 48) return `${hours} hours remaining`;
  return `${Math.ceil(hours / 24)} days remaining`;
};

const FieldError = ({ message }) => (
  message ? <p className="text-xs font-medium text-red-400">{message}</p> : null
);

const validateCampaignForm = (form) => {
  const errors = {};
  const title = String(form.title || '').trim();
  const message = String(form.message || '').trim();
  const ctaLabel = String(form.cta_label || '').trim();
  const ctaUrl = String(form.cta_url || '').trim();
  const startsAt = new Date(form.starts_at);
  const endsAt = new Date(form.ends_at);

  if (!title) errors.title = 'Enter the popup title.';
  if (!message) errors.message = 'Enter the campaign message.';
  if (Boolean(ctaLabel) !== Boolean(ctaUrl)) {
    errors.cta_label = 'CTA label and destination must be provided together.';
    errors.cta_url = 'CTA label and destination must be provided together.';
  }
  if (ctaUrl && !(/^\/(?!\/)/.test(ctaUrl) || /^https:\/\//i.test(ctaUrl))) {
    errors.cta_url = 'Use an internal path such as /pricing or a valid HTTPS URL.';
  }
  if (!form.dismissible && !ctaUrl) {
    errors.cta_url = 'A non-dismissible popup must include an action button.';
  }
  if (
    form.placement === 'VENDOR_PORTAL' &&
    form.target_type === 'SELECTED' &&
    !form.target_vendor_ids.length
  ) {
    errors.target_vendor_ids = 'Select at least one vendor.';
  }
  if (Number.isNaN(startsAt.getTime())) errors.starts_at = 'Choose a valid start date and time.';
  if (Number.isNaN(endsAt.getTime())) errors.ends_at = 'Choose a valid end date and time.';
  if (!errors.starts_at && !errors.ends_at && endsAt <= startsAt) {
    errors.ends_at = 'End time must be later than start time.';
  }
  if (!errors.ends_at && endsAt.getTime() <= Date.now()) {
    errors.ends_at = 'End time must be in the future.';
  }
  if (!errors.starts_at && !errors.ends_at && endsAt.getTime() - startsAt.getTime() > 400 * 24 * 60 * 60 * 1000) {
    errors.ends_at = 'Campaign duration cannot exceed 400 days.';
  }

  if (form.campaign_type !== 'ANNOUNCEMENT') {
    const couponCode = String(form.coupon_code || '').trim();
    const discountValue = Number(form.discount_value);
    if (!/^[A-Z0-9_-]{3,40}$/.test(couponCode)) {
      errors.coupon_code = 'Use 3-40 uppercase letters, numbers, hyphens, or underscores.';
    }
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      errors.discount_value = 'Discount must be greater than zero.';
    } else if (form.discount_type === 'PERCENT' && discountValue > 100) {
      errors.discount_value = 'Percentage discount cannot exceed 100%.';
    }
  }

  return errors;
};

export default function VendorCampaignsPanel({ plans = [] }) {
  const [campaigns, setCampaigns] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [vendorQuery, setVendorQuery] = useState('');
  const [vendorOptions, setVendorOptions] = useState([]);
  const [vendorsLoading, setVendorsLoading] = useState(false);
  const [selectedVendorNames, setSelectedVendorNames] = useState({});
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const formRef = useRef(null);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const data = await superAdminServerApi.campaigns.list();
      setCampaigns(data.campaigns || []);
      setSummary(data.summary || {});
    } catch (error) {
      toast({ title: 'Campaigns could not be loaded', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  useEffect(() => {
    if (
      !dialogOpen ||
      form.placement !== 'VENDOR_PORTAL' ||
      form.target_type !== 'SELECTED'
    ) return undefined;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setVendorsLoading(true);
      try {
        const data = await superAdminServerApi.campaigns.targets({ query: vendorQuery, limit: 50 });
        if (!cancelled) setVendorOptions(data.vendors || []);
      } catch (error) {
        if (!cancelled) {
          toast({ title: 'Vendor search failed', description: error.message, variant: 'destructive' });
        }
      } finally {
        if (!cancelled) setVendorsLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [dialogOpen, form.placement, form.target_type, vendorQuery]);

  const metrics = useMemo(() => [
    { label: 'Active', value: summary.active || 0, icon: CheckCircle2, color: 'text-emerald-400' },
    { label: 'Scheduled', value: summary.scheduled || 0, icon: CalendarClock, color: 'text-cyan-400' },
    { label: 'People reached', value: summary.total_reach || 0, icon: Eye, color: 'text-violet-400' },
    { label: 'CTA clicks', value: summary.total_clicks || 0, icon: MousePointerClick, color: 'text-orange-400' },
  ], [summary]);

  const openCreate = () => {
    setEditingId(null);
    setForm(initialForm());
    setSelectedVendorNames({});
    setVendorQuery('');
    setFormError('');
    setFieldErrors({});
    setDialogOpen(true);
  };

  const openEdit = (campaign) => {
    setEditingId(campaign.id);
    setForm(campaignToForm(campaign));
    setSelectedVendorNames(
      Object.fromEntries(
        (campaign.target_vendor_ids || []).map((id, index) => [
          id,
          campaign.target_vendor_names?.[index] || id,
        ])
      )
    );
    setVendorQuery('');
    setFormError('');
    setFieldErrors({});
    setDialogOpen(true);
  };

  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFormError('');
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const selectPlacement = (placement) => {
    setForm((current) => {
      const homepage = placement === 'HOMEPAGE';
      const announcement = current.campaign_type === 'ANNOUNCEMENT';
      return {
        ...current,
        placement,
        target_type: 'ALL',
        target_vendor_ids: [],
        cta_label: announcement
          ? (homepage ? 'Explore marketplace' : 'View details')
          : 'View plans',
        cta_url: announcement
          ? (homepage ? '/directory' : '/vendor/dashboard')
          : (homepage ? '/pricing' : '/vendor/subscriptions'),
      };
    });
    setSelectedVendorNames({});
    setVendorQuery('');
    setFieldErrors((current) => {
      if (!current.target_vendor_ids) return current;
      const next = { ...current };
      delete next.target_vendor_ids;
      return next;
    });
    setFormError('');
  };

  const applyDuration = (amount, unit = 'hours') => {
    const start = form.starts_at ? new Date(form.starts_at) : new Date();
    updateForm('ends_at', toLocalInput(addDuration(start, amount, unit)));
  };

  const toggleVendor = (vendor) => {
    const id = String(vendor.id);
    setForm((current) => {
      const selected = current.target_vendor_ids.includes(id);
      return {
        ...current,
        target_vendor_ids: selected
          ? current.target_vendor_ids.filter((item) => item !== id)
          : [...current.target_vendor_ids, id],
      };
    });
    setSelectedVendorNames((current) => {
      const next = { ...current };
      if (form.target_vendor_ids.includes(id)) delete next[id];
      else next[id] = vendor.company_name || vendor.owner_name || vendor.email || id;
      return next;
    });
  };

  const removeVendor = (id) => {
    updateForm('target_vendor_ids', form.target_vendor_ids.filter((item) => item !== id));
    setSelectedVendorNames((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  };

  const submitCampaign = async (event) => {
    event.preventDefault();
    const errors = validateCampaignForm(form);
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      setFormError('Please fix the highlighted campaign settings before launching.');
      const firstField = Object.keys(errors)[0];
      window.requestAnimationFrame(() => {
        const input = formRef.current?.querySelector(`[name="${firstField}"]`);
        input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        input?.focus?.();
      });
      return;
    }

    setFormError('');
    setFieldErrors({});
    setSaving(true);
    try {
      const payload = {
        ...form,
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: new Date(form.ends_at).toISOString(),
        target_vendor_ids:
          form.placement === 'VENDOR_PORTAL' && form.target_type === 'SELECTED'
            ? form.target_vendor_ids
            : [],
        plan_id: form.plan_id === 'ALL' ? null : form.plan_id,
      };
      if (editingId) await superAdminServerApi.campaigns.update(editingId, payload);
      else await superAdminServerApi.campaigns.create(payload);
      toast({ title: editingId ? 'Campaign updated' : 'Campaign launched' });
      setDialogOpen(false);
      await fetchCampaigns();
    } catch (error) {
      setFormError(error.message || 'Campaign could not be saved.');
      toast({ title: 'Campaign was not saved', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const setCampaignStatus = async (campaign) => {
    const activate = campaign.effective_status === 'PAUSED';
    setBusyId(campaign.id);
    try {
      await superAdminServerApi.campaigns.setStatus(campaign.id, activate);
      toast({ title: activate ? 'Campaign activated' : 'Campaign paused' });
      await fetchCampaigns();
    } catch (error) {
      toast({ title: 'Status was not changed', description: error.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const deleteCampaign = async (campaign) => {
    if (!window.confirm(`Delete "${campaign.name}"? Its linked coupon will be disabled.`)) return;
    setBusyId(campaign.id);
    try {
      await superAdminServerApi.campaigns.delete(campaign.id);
      toast({ title: 'Campaign deleted' });
      await fetchCampaigns();
    } catch (error) {
      toast({ title: 'Campaign was not deleted', description: error.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const isPromotion = form.campaign_type !== 'ANNOUNCEMENT';
  const isHomepage = form.placement === 'HOMEPAGE';

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 border-b border-neutral-800 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-orange-400">
            <Megaphone className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wide">Marketplace engagement</span>
          </div>
          <h2 className="text-2xl font-semibold text-white">Campaigns and announcements</h2>
          <p className="mt-1 max-w-2xl text-sm text-neutral-400">
            Deliver scheduled notices and offers on the public homepage or inside the vendor portal.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchCampaigns} disabled={loading} className="border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="ml-2">Refresh</span>
          </Button>
          <Button onClick={openCreate} className="bg-orange-600 text-white hover:bg-orange-500">
            <Plus className="mr-2 h-4 w-4" /> Create campaign
          </Button>
        </div>
      </section>

      <section className="grid overflow-hidden rounded-md border border-neutral-800 bg-neutral-950 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.label} className="flex items-center gap-3 border-b border-neutral-800 p-4 last:border-b-0 sm:border-r xl:border-b-0">
              <Icon className={`h-5 w-5 ${metric.color}`} />
              <div>
                <p className="text-2xl font-semibold text-white">{Number(metric.value).toLocaleString('en-IN')}</p>
                <p className="text-xs text-neutral-500">{metric.label}</p>
              </div>
            </div>
          );
        })}
      </section>

      <section className="overflow-x-auto rounded-md border border-neutral-800 bg-neutral-950">
        <div className="grid grid-cols-[minmax(260px,1.6fr)_minmax(150px,.7fr)_minmax(170px,.8fr)_minmax(130px,.6fr)_150px] gap-4 border-b border-neutral-800 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          <span>Campaign</span><span>Placement / audience</span><span>Schedule</span><span>Results</span><span className="text-right">Actions</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-14 text-sm text-neutral-400">
            <RefreshCw className="h-4 w-4 animate-spin" /> Loading campaigns
          </div>
        ) : campaigns.length === 0 ? (
          <div className="py-14 text-center">
            <Megaphone className="mx-auto h-8 w-8 text-neutral-700" />
            <p className="mt-3 text-sm font-medium text-neutral-300">No campaigns yet</p>
            <p className="mt-1 text-xs text-neutral-500">Create a targeted announcement or offer to begin.</p>
          </div>
        ) : campaigns.map((campaign) => (
          <div key={campaign.id} className="grid grid-cols-[minmax(260px,1.6fr)_minmax(150px,.7fr)_minmax(170px,.8fr)_minmax(130px,.6fr)_150px] gap-4 border-b border-neutral-800 px-4 py-4 last:border-b-0">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-semibold text-white">{campaign.name}</p>
                <Badge variant="outline" className={STATUS_STYLES[campaign.effective_status] || STATUS_STYLES.PAUSED}>
                  {campaign.effective_status}
                </Badge>
                <Badge variant="outline" className="border-neutral-700 bg-neutral-900 text-neutral-300">
                  {campaign.placement === 'HOMEPAGE' ? 'Homepage' : 'Vendor portal'}
                </Badge>
              </div>
              <p className="mt-1 line-clamp-1 text-xs text-neutral-400">{campaign.title}</p>
              {campaign.coupon_code ? (
                <p className="mt-2 font-mono text-xs text-orange-400">
                  {campaign.coupon_code} | {campaign.discount_type === 'PERCENT' ? `${campaign.discount_value}%` : `INR ${campaign.discount_value}`}
                </p>
              ) : null}
            </div>
            <div className="text-xs text-neutral-300">
              {campaign.placement === 'HOMEPAGE' ? (
                <div className="flex items-center gap-2">
                  <Globe2 className="h-4 w-4 text-neutral-500" />
                  All homepage visitors
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2"><Users className="h-4 w-4 text-neutral-500" />{campaign.target_type === 'ALL' ? 'All vendors' : `${campaign.target_vendor_ids.length} selected`}</div>
                  {campaign.target_type === 'SELECTED' ? <p className="mt-2 line-clamp-2 text-neutral-500">{campaign.target_vendor_names?.slice(0, 3).join(', ')}</p> : null}
                </>
              )}
            </div>
            <div className="text-xs text-neutral-400">
              <p>{formatDate(campaign.starts_at)}</p>
              <p className="mt-1 text-neutral-600">to {formatDate(campaign.ends_at)}</p>
            </div>
            <div className="text-xs text-neutral-400">
              <p><span className="font-semibold text-white">{campaign.unique_vendors_reached}</span> reached</p>
              <p className="mt-1"><span className="font-semibold text-white">{campaign.clicks}</span> clicks</p>
              {campaign.coupon_id ? <p className="mt-1 text-emerald-400">{campaign.coupon_used_count || 0} redeemed</p> : null}
            </div>
            <div className="flex justify-end gap-1">
              <Button size="icon" variant="ghost" title="Edit campaign" onClick={() => openEdit(campaign)} className="text-neutral-400 hover:bg-neutral-800 hover:text-white"><Pencil className="h-4 w-4" /></Button>
              {!['EXPIRED', 'SCHEDULED'].includes(campaign.effective_status) ? (
                <Button size="icon" variant="ghost" title={campaign.effective_status === 'PAUSED' ? 'Activate' : 'Pause'} disabled={busyId === campaign.id} onClick={() => setCampaignStatus(campaign)} className="text-neutral-400 hover:bg-neutral-800 hover:text-white">
                  {campaign.effective_status === 'PAUSED' ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                </Button>
              ) : null}
              <Button size="icon" variant="ghost" title="Delete campaign" disabled={busyId === campaign.id} onClick={() => deleteCampaign(campaign)} className="text-red-500 hover:bg-red-950 hover:text-red-300"><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
      </section>

      <Dialog open={dialogOpen} onOpenChange={(open) => !saving && setDialogOpen(open)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto border-neutral-800 bg-neutral-950 text-neutral-100 sm:!w-[94vw] sm:!max-w-6xl">
          <DialogHeader>
            <DialogTitle className="text-white">{editingId ? 'Edit campaign' : 'Create campaign'}</DialogTitle>
            <DialogDescription className="text-neutral-400">Choose where the campaign appears, then configure delivery, popup behavior, and an optional checkout discount.</DialogDescription>
          </DialogHeader>

          <form ref={formRef} noValidate onSubmit={submitCampaign} className="grid gap-7 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,.75fr)]">
            <div className="space-y-7">
              {formError ? (
                <div role="alert" className="flex items-start gap-3 rounded-md border border-red-800 bg-red-950/70 px-4 py-3 text-sm text-red-200">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                  <div>
                    <p className="font-semibold">Campaign is not ready</p>
                    <p className="mt-1 text-xs leading-5 text-red-300">{formError}</p>
                  </div>
                </div>
              ) : null}
              <section className="space-y-4 border-t border-neutral-800 pt-5">
                <div>
                  <h3 className="text-sm font-semibold text-white">Placement</h3>
                  <p className="mt-1 text-xs text-neutral-500">Choose the experience where this popup should run.</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {PLACEMENT_OPTIONS.map(({ value, label, description, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => selectPlacement(value)}
                      className={`flex min-h-20 items-start gap-3 rounded-md border p-3 text-left transition ${
                        form.placement === value
                          ? 'border-cyan-600 bg-cyan-950 text-cyan-200'
                          : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-700'
                      }`}
                    >
                      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
                      <span>
                        <span className="block text-sm font-semibold">{label}</span>
                        <span className="mt-1 block text-xs leading-5 text-neutral-500">{description}</span>
                      </span>
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {CAMPAIGN_TYPES.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setForm((current) => ({
                        ...current,
                        campaign_type: value,
                        cta_label: value === 'ANNOUNCEMENT'
                          ? (current.placement === 'HOMEPAGE' ? 'Explore marketplace' : 'View details')
                          : 'View plans',
                        cta_url: value === 'ANNOUNCEMENT'
                          ? (current.placement === 'HOMEPAGE' ? '/directory' : '/vendor/dashboard')
                          : (current.placement === 'HOMEPAGE' ? '/pricing' : '/vendor/subscriptions'),
                      }))}
                      className={`flex h-11 items-center justify-center gap-2 rounded-md border text-sm font-medium transition ${form.campaign_type === value ? 'border-orange-500 bg-orange-950 text-orange-300' : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-700'}`}
                    >
                      <Icon className="h-4 w-4" /> {label}
                    </button>
                  ))}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2"><Label>Internal campaign name</Label><Input value={form.name} onChange={(e) => updateForm('name', e.target.value)} placeholder="July renewal offer" className="border-neutral-700 bg-neutral-900" /></div>
                  <div className="space-y-2"><Label>Visual style</Label><Select value={form.style_variant} onValueChange={(value) => updateForm('style_variant', value)}><SelectTrigger className="border-neutral-700 bg-neutral-900"><SelectValue /></SelectTrigger><SelectContent>{STYLE_OPTIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
                </div>
                <div className="space-y-2"><Label htmlFor="campaign-title">Popup title <span className="text-red-400">*</span></Label><Input id="campaign-title" name="title" aria-invalid={Boolean(fieldErrors.title)} maxLength={191} value={form.title} onChange={(e) => updateForm('title', e.target.value)} placeholder="Upgrade today and save 20%" className="border-neutral-700 bg-neutral-900 aria-[invalid=true]:border-red-600" /><FieldError message={fieldErrors.title} /></div>
                <div className="space-y-2"><Label htmlFor="campaign-message">Message <span className="text-red-400">*</span></Label><Textarea id="campaign-message" name="message" aria-invalid={Boolean(fieldErrors.message)} maxLength={4000} rows={4} value={form.message} onChange={(e) => updateForm('message', e.target.value)} placeholder="Explain the benefit, validity, and next step clearly." className="border-neutral-700 bg-neutral-900 aria-[invalid=true]:border-red-600" /><FieldError message={fieldErrors.message} /></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2"><Label htmlFor="campaign-cta-label">CTA label</Label><Input id="campaign-cta-label" name="cta_label" aria-invalid={Boolean(fieldErrors.cta_label)} value={form.cta_label} onChange={(e) => updateForm('cta_label', e.target.value)} placeholder="View plans" className="border-neutral-700 bg-neutral-900 aria-[invalid=true]:border-red-600" /><FieldError message={fieldErrors.cta_label} /></div>
                  <div className="space-y-2"><Label htmlFor="campaign-cta-url">CTA destination</Label><Input id="campaign-cta-url" name="cta_url" aria-invalid={Boolean(fieldErrors.cta_url)} value={form.cta_url} onChange={(e) => updateForm('cta_url', e.target.value)} placeholder="/vendor/subscriptions" className="border-neutral-700 bg-neutral-900 aria-[invalid=true]:border-red-600" /><FieldError message={fieldErrors.cta_url} /></div>
                </div>
              </section>

              <section className="space-y-4 border-t border-neutral-800 pt-5">
                <div>
                  <h3 className="text-sm font-semibold text-white">Audience</h3>
                  <p className="mt-1 text-xs text-neutral-500">
                    {isHomepage
                      ? 'Every eligible public visitor to the homepage can receive this campaign.'
                      : 'Only authenticated vendor accounts in this audience can receive or redeem the offer.'}
                  </p>
                </div>
                {isHomepage ? (
                  <div className="flex items-center gap-3 rounded-md border border-cyan-900 bg-cyan-950/50 px-4 py-3">
                    <Globe2 className="h-5 w-5 shrink-0 text-cyan-400" />
                    <div>
                      <p className="text-sm font-medium text-cyan-200">All homepage visitors</p>
                      <p className="mt-1 text-xs text-neutral-500">Frequency is controlled per anonymous browser visitor.</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {[['ALL', 'All vendors'], ['SELECTED', 'Selected vendors']].map(([value, label]) => <button key={value} type="button" onClick={() => updateForm('target_type', value)} className={`h-10 rounded-md border text-sm ${form.target_type === value ? 'border-cyan-600 bg-cyan-950 text-cyan-300' : 'border-neutral-800 bg-neutral-900 text-neutral-400'}`}>{label}</button>)}
                  </div>
                )}
                {!isHomepage && form.target_type === 'SELECTED' ? (
                  <div className="space-y-3">
                    <input name="target_vendor_ids" value={form.target_vendor_ids.join(',')} readOnly className="sr-only" tabIndex={-1} />
                    <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-neutral-500" /><Input value={vendorQuery} onChange={(e) => setVendorQuery(e.target.value)} placeholder="Search company, owner, email, or phone" className="border-neutral-700 bg-neutral-900 pl-9" /></div>
                    <FieldError message={fieldErrors.target_vendor_ids} />
                    {form.target_vendor_ids.length ? <div className="flex flex-wrap gap-2">{form.target_vendor_ids.map((id) => <span key={id} className="flex items-center gap-1 rounded-md border border-cyan-900 bg-cyan-950 px-2 py-1 text-xs text-cyan-200">{selectedVendorNames[id] || id}<button type="button" onClick={() => removeVendor(id)} title="Remove vendor"><X className="h-3 w-3" /></button></span>)}</div> : null}
                    <div className="max-h-48 overflow-y-auto rounded-md border border-neutral-800 bg-neutral-900">
                      {vendorsLoading ? <p className="p-4 text-center text-xs text-neutral-500">Searching vendors...</p> : vendorOptions.map((vendor) => {
                        const selected = form.target_vendor_ids.includes(String(vendor.id));
                        return <button key={vendor.id} type="button" onClick={() => toggleVendor(vendor)} className={`flex w-full items-center justify-between border-b border-neutral-800 px-3 py-2 text-left last:border-b-0 ${selected ? 'bg-cyan-950/70' : 'hover:bg-neutral-800'}`}><span><span className="block text-sm text-neutral-200">{vendor.company_name || vendor.owner_name || 'Vendor'}</span><span className="block text-xs text-neutral-500">{vendor.email || vendor.phone || vendor.id}</span></span>{selected ? <CheckCircle2 className="h-4 w-4 text-cyan-400" /> : null}</button>;
                      })}
                    </div>
                  </div>
                ) : null}
              </section>

              <section className="space-y-4 border-t border-neutral-800 pt-5">
                <div><h3 className="text-sm font-semibold text-white">Schedule</h3><p className="mt-1 text-xs text-neutral-500">Times are entered in your current browser timezone.</p></div>
                <div className="flex flex-wrap gap-2">{[[24, 'hours', '24 hours'], [7, 'days', '7 days'], [30, 'days', '30 days'], [365, 'days', '1 year']].map(([amount, unit, label]) => <Button key={label} type="button" size="sm" variant="outline" onClick={() => applyDuration(amount, unit)} className="border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800">{label}</Button>)}</div>
                <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="campaign-start">Starts <span className="text-red-400">*</span></Label><Input id="campaign-start" name="starts_at" aria-invalid={Boolean(fieldErrors.starts_at)} type="datetime-local" value={form.starts_at} onChange={(e) => updateForm('starts_at', e.target.value)} className="border-neutral-700 bg-neutral-900 [color-scheme:dark] aria-[invalid=true]:border-red-600" /><FieldError message={fieldErrors.starts_at} /></div><div className="space-y-2"><Label htmlFor="campaign-end">Ends <span className="text-red-400">*</span></Label><Input id="campaign-end" name="ends_at" aria-invalid={Boolean(fieldErrors.ends_at)} type="datetime-local" value={form.ends_at} onChange={(e) => updateForm('ends_at', e.target.value)} className="border-neutral-700 bg-neutral-900 [color-scheme:dark] aria-[invalid=true]:border-red-600" /><FieldError message={fieldErrors.ends_at} /></div></div>
              </section>

              {isPromotion ? (
                <section className="space-y-4 border-t border-neutral-800 pt-5">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Checkout discount</h3>
                    <p className="mt-1 text-xs text-neutral-500">
                      {isHomepage
                        ? 'The code is shown publicly; signed-in vendor checkout still validates plan, validity, and usage limits.'
                        : 'This creates an approved coupon and limits redemption to the selected audience.'}
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="campaign-coupon">Coupon code <span className="text-red-400">*</span></Label><Input id="campaign-coupon" name="coupon_code" aria-invalid={Boolean(fieldErrors.coupon_code)} value={form.coupon_code} onChange={(e) => updateForm('coupon_code', e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))} placeholder="GROW20" className="border-neutral-700 bg-neutral-900 font-mono aria-[invalid=true]:border-red-600" /><FieldError message={fieldErrors.coupon_code} /></div><div className="space-y-2"><Label>Applicable plan</Label><Select value={form.plan_id || 'ALL'} onValueChange={(value) => updateForm('plan_id', value)}><SelectTrigger className="border-neutral-700 bg-neutral-900"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">All plans</SelectItem>{plans.map((plan) => <SelectItem key={plan.id} value={String(plan.id)}>{plan.name}</SelectItem>)}</SelectContent></Select></div></div>
                  <div className="grid gap-4 sm:grid-cols-3"><div className="space-y-2"><Label>Discount type</Label><Select value={form.discount_type} onValueChange={(value) => updateForm('discount_type', value)}><SelectTrigger className="border-neutral-700 bg-neutral-900"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PERCENT">Percentage</SelectItem><SelectItem value="FLAT">Flat INR</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label htmlFor="campaign-discount">Discount value <span className="text-red-400">*</span></Label><Input id="campaign-discount" name="discount_value" aria-invalid={Boolean(fieldErrors.discount_value)} type="number" min="1" max={form.discount_type === 'PERCENT' ? 100 : undefined} value={form.discount_value} onChange={(e) => updateForm('discount_value', e.target.value)} className="border-neutral-700 bg-neutral-900 aria-[invalid=true]:border-red-600" /><FieldError message={fieldErrors.discount_value} /></div><div className="space-y-2"><Label>Maximum uses</Label><Input type="number" min="0" value={form.max_uses} onChange={(e) => updateForm('max_uses', e.target.value)} className="border-neutral-700 bg-neutral-900" /><p className="text-[11px] text-neutral-600">0 means unlimited within validity.</p></div></div>
                </section>
              ) : null}

              <section className="grid gap-4 border-t border-neutral-800 pt-5 sm:grid-cols-3">
                <div className="space-y-2"><Label>Priority</Label><Input type="number" min="0" max="1000" value={form.priority} onChange={(e) => updateForm('priority', e.target.value)} className="border-neutral-700 bg-neutral-900" /></div>
                <div className="space-y-2"><Label>{isHomepage ? 'Impressions per visitor' : 'Impressions per vendor'}</Label><Select value={String(form.max_impressions_per_vendor)} onValueChange={(value) => updateForm('max_impressions_per_vendor', Number(value))}><SelectTrigger className="border-neutral-700 bg-neutral-900"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">Once</SelectItem><SelectItem value="3">Up to 3 times</SelectItem><SelectItem value="5">Up to 5 times</SelectItem><SelectItem value="0">Unlimited</SelectItem></SelectContent></Select></div>
                <div className="flex items-center justify-between rounded-md border border-neutral-800 bg-neutral-900 px-3"><div><Label>Dismissible</Label><p className="text-[11px] text-neutral-600">Allow {isHomepage ? 'visitor' : 'vendor'} to close</p></div><Switch checked={form.dismissible} onCheckedChange={(value) => updateForm('dismissible', value)} /></div>
              </section>
            </div>

            <aside className="lg:sticky lg:top-0 lg:self-start">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">{isHomepage ? 'Homepage preview' : 'Vendor preview'}</p>
              <div className={`overflow-hidden rounded-md border ${PREVIEW_STYLES[form.style_variant] || PREVIEW_STYLES.INFO}`}>
                <div className="border-b border-white/10 px-5 py-4">
                  <div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold uppercase tracking-wide text-orange-300">{form.campaign_type}</span>{form.dismissible ? <X className="h-4 w-4 text-neutral-500" /> : null}</div>
                  <h3 className="mt-4 text-xl font-semibold text-white">{form.title || 'Campaign title preview'}</h3>
                  <p className="mt-2 text-sm leading-6 text-neutral-300">{form.message || 'The campaign message will appear here.'}</p>
                </div>
                {isPromotion ? <div className="mx-5 mt-5 rounded-md border border-dashed border-orange-500 bg-black/30 p-4"><p className="text-[11px] uppercase tracking-wide text-neutral-500">Coupon code</p><p className="mt-1 font-mono text-xl font-semibold text-orange-300">{form.coupon_code || 'GROW20'}</p><p className="mt-1 text-xs text-neutral-400">{form.discount_type === 'PERCENT' ? `${form.discount_value || 0}% off` : `INR ${form.discount_value || 0} off`}</p></div> : null}
                <div className="space-y-3 p-5"><div className="flex items-center gap-2 text-xs text-neutral-400"><Clock3 className="h-4 w-4" />{remainingLabel(form.ends_at)}</div>{form.cta_label ? <Button type="button" className="w-full bg-orange-600 text-white hover:bg-orange-500">{form.cta_label}</Button> : null}</div>
              </div>
              <div className="mt-4 rounded-md border border-neutral-800 bg-neutral-900 p-4 text-xs leading-5 text-neutral-500">
                Placement: <span className="text-neutral-300">{isHomepage ? 'Public homepage' : 'Vendor portal'}</span><br />
                Audience: <span className="text-neutral-300">{isHomepage ? 'All homepage visitors' : form.target_type === 'ALL' ? 'All vendors' : `${form.target_vendor_ids.length} selected vendors`}</span><br />
                Delivery: <span className="text-neutral-300">{form.max_impressions_per_vendor === 0 ? 'Unlimited' : `${form.max_impressions_per_vendor} impression(s) per ${isHomepage ? 'visitor' : 'vendor'}`}</span>
              </div>
              <div className="sticky bottom-0 z-10 mt-5 flex gap-2 border-t border-neutral-800 bg-neutral-950 py-4 lg:static lg:border-0 lg:py-0"><Button type="button" variant="outline" disabled={saving} onClick={() => setDialogOpen(false)} className="flex-1 border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800">Cancel</Button><Button type="submit" disabled={saving} className="flex-1 bg-orange-600 text-white hover:bg-orange-500">{saving ? 'Saving...' : editingId ? 'Save changes' : 'Launch campaign'}</Button></div>
            </aside>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
