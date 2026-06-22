import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  CheckCircle2,
  Crown,
  ExternalLink,
  Globe2,
  LayoutTemplate,
  Link2,
  Loader2,
  Lock,
  Plus,
  Save,
  SearchCheck,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Card from '@/shared/components/Card';
import { toast } from '@/components/ui/use-toast';
import { vendorApi } from '@/modules/vendor/services/vendorApi';
import VendorPlanTrustPanel from '@/modules/vendor/components/VendorPlanTrustPanel';
import { asPlanObject, getVendorCertificate, getVendorPlanBadgeLabel, getVendorPlanEntitlements } from '@/shared/utils/vendorPlanEntitlements';
import { useSubdomain } from '@/contexts/SubdomainContext';

const emptySection = () => ({ title: '', body: '' });

const normalizeSlug = (value = '') =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

const normalizeListText = (value = '') =>
  Array.isArray(value) ? value.join(', ') : String(value || '');

const normalizeSettings = (settings = {}, vendor = {}) => {
  const safe = asPlanObject(settings);
  const seo = asPlanObject(safe.seo);
  const sitemap = asPlanObject(safe.sitemap);

  return {
    profile_slug: normalizeSlug(safe.profile_slug || vendor?.slug || vendor?.vendor_id || ''),
    profile_template: safe.profile_template || vendor?.profile_template_override || 'AUTO',
    tagline: String(safe.tagline || vendor?.tagline || '').slice(0, 140),
    intro: String(safe.intro || vendor?.business_description || vendor?.description || '').slice(0, 900),
    featured_highlights: normalizeListText(safe.featured_highlights || []),
    custom_sections: Array.isArray(safe.custom_sections) && safe.custom_sections.length
      ? safe.custom_sections.map((section) => ({
          title: String(section?.title || ''),
          body: String(section?.body || ''),
        }))
      : [emptySection()],
    seo: {
      title: String(seo.title || '').slice(0, 90),
      description: String(seo.description || '').slice(0, 220),
      keywords: normalizeListText(seo.keywords || []),
    },
    sitemap: {
      enabled: sitemap.enabled !== false,
      priority_keywords: normalizeListText(sitemap.priority_keywords || []),
    },
  };
};

const toList = (value = '') =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const ToolCard = ({ icon: Icon, title, enabled, detail }) => (
  <div className={`rounded-xl border p-4 ${enabled ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200 bg-slate-50'}`}>
    <div className="flex items-start gap-3">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${enabled ? 'bg-white text-emerald-700' : 'bg-white text-slate-400'} shadow-sm`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-slate-950">{title}</p>
          {enabled ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Lock className="h-4 w-4 text-slate-400" />}
        </div>
        <p className="mt-1 text-xs leading-5 text-slate-500">{enabled ? 'Active on current plan' : 'Locked on current plan'}</p>
        {detail ? <p className="mt-2 text-xs font-semibold text-slate-700">{detail}</p> : null}
      </div>
    </div>
  </div>
);

const FieldShell = ({ locked, children }) => (
  <div className={locked ? 'pointer-events-none select-none opacity-50' : ''}>{children}</div>
);

const PortfolioStudio = () => {
  const { resolvePath } = useSubdomain();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [vendor, setVendor] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [publicProfilePath, setPublicProfilePath] = useState('');
  const [form, setForm] = useState(() => normalizeSettings());

  const loadSettings = async () => {
    setLoading(true);
    try {
      const [payload, sub] = await Promise.all([
        vendorApi.portfolio.getSettings(),
        vendorApi.subscriptions.getCurrent().catch(() => null),
      ]);
      const nextVendor = payload?.vendor || null;
      setVendor(nextVendor);
      setSubscription(sub || null);
      setPublicProfilePath(payload?.public_profile_path || '');
      setForm(normalizeSettings(payload?.settings || {}, nextVendor || {}));
    } catch (error) {
      toast({
        title: 'Portfolio settings failed',
        description: error?.message || 'Unable to load portfolio tools.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const enrichedVendor = useMemo(() => ({
    ...(vendor || {}),
    active_plan: vendor?.active_plan || subscription?.plan || null,
    plan_entitlements: vendor?.plan_entitlements || vendor?.active_plan?.entitlements || subscription?.plan?.entitlements || null,
    certificate: vendor?.certificate || null,
  }), [vendor, subscription]);

  const entitlements = getVendorPlanEntitlements(enrichedVendor);
  const badgeLabel = getVendorPlanBadgeLabel(enrichedVendor);
  const certificate = getVendorCertificate(enrichedVendor);
  const canPremium = entitlements.portfolio.premium;
  const canUrl = entitlements.portfolio.custom_url;
  const canCustomize = entitlements.portfolio.customizable || entitlements.portfolio.custom_sections;
  const canSections = entitlements.portfolio.custom_sections;
  const canSeo = entitlements.seo.enabled;
  const canSitemap = entitlements.sitemap.customizable;
  const subscriptionsPath = resolvePath('subscriptions', 'vendor');
  const liveUrl = publicProfilePath
    ? `${window.location.origin}${publicProfilePath}`
    : `${window.location.origin}/directory/vendor/${encodeURIComponent(form.profile_slug || '')}`;

  const updateSection = (index, patch) => {
    setForm((prev) => ({
      ...prev,
      custom_sections: prev.custom_sections.map((section, itemIndex) =>
        itemIndex === index ? { ...section, ...patch } : section
      ),
    }));
  };

  const addSection = () => {
    setForm((prev) => ({
      ...prev,
      custom_sections: [...prev.custom_sections, emptySection()].slice(0, 6),
    }));
  };

  const removeSection = (index) => {
    setForm((prev) => {
      const next = prev.custom_sections.filter((_, itemIndex) => itemIndex !== index);
      return { ...prev, custom_sections: next.length ? next : [emptySection()] };
    });
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const payload = {
        profile_template: form.profile_template,
        ...(canUrl ? { profile_slug: normalizeSlug(form.profile_slug) } : {}),
        ...(canCustomize
          ? {
              tagline: form.tagline,
              intro: form.intro,
              featured_highlights: toList(form.featured_highlights),
            }
          : {}),
        ...(canSections
          ? {
              custom_sections: form.custom_sections
                .map((section) => ({ title: section.title, body: section.body }))
                .filter((section) => section.title.trim() || section.body.trim()),
            }
          : {}),
        ...(canSeo
          ? {
              seo: {
                title: form.seo.title,
                description: form.seo.description,
                keywords: toList(form.seo.keywords),
              },
            }
          : {}),
        ...(canSitemap
          ? {
              sitemap: {
                enabled: form.sitemap.enabled,
                priority_keywords: toList(form.sitemap.priority_keywords),
              },
            }
          : {}),
      };

      const response = await vendorApi.portfolio.updateSettings(payload);
      const nextVendor = response?.vendor || vendor;
      setVendor(nextVendor);
      setPublicProfilePath(response?.public_profile_path || publicProfilePath);
      setForm(normalizeSettings(response?.settings || form, nextVendor || {}));
      window.dispatchEvent(new Event('vendor_profile_updated'));
      toast({ title: 'Portfolio settings saved' });
    } catch (error) {
      toast({
        title: 'Save failed',
        description: error?.message || 'Unable to save portfolio settings.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#003D82]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-[#003D82]" />
            Portfolio tools
          </div>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight text-slate-950">Portfolio Studio</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            {badgeLabel || 'Active plan'} controls for public profile, custom URL, SEO and certificate visibility.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline" className="gap-2 border-slate-300 bg-white">
            <a href={liveUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" />
              Open live profile
            </a>
          </Button>
          <Button className="gap-2 bg-[#003D82] hover:bg-[#002f66]" disabled={saving} onClick={saveSettings}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save changes
          </Button>
        </div>
      </div>

      <VendorPlanTrustPanel
        vendor={enrichedVendor}
        subscription={subscription}
        loading={false}
        variant="dashboard"
        editProfilePath={resolvePath('profile', 'vendor') + '?tab=certificate'}
        managePlanPath={subscriptionsPath}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card className="border-slate-200 bg-white shadow-sm">
            <Card.Header className="pb-3">
              <Card.Title className="text-base">Plan options</Card.Title>
            </Card.Header>
            <Card.Content className="space-y-3">
              <ToolCard icon={Crown} title="Premium portfolio" enabled={canPremium} detail={entitlements.portfolio.showcase_label || ''} />
              <ToolCard icon={Link2} title="Custom profile URL" enabled={canUrl} detail={canUrl ? form.profile_slug : ''} />
              <ToolCard icon={LayoutTemplate} title="Custom sections" enabled={canSections} detail={`${form.custom_sections.length} section slots`} />
              <ToolCard icon={SearchCheck} title="SEO-ready profile" enabled={canSeo} detail={canSeo ? `${entitlements.seo.city_category_pages || 0}+ SEO pages` : ''} />
              <ToolCard icon={Globe2} title="Sitemap customization" enabled={canSitemap} detail={canSitemap ? `${entitlements.sitemap.seo_pages || entitlements.sitemap.url_boost || 0}+ sitemap reach` : ''} />
              <ToolCard icon={Award} title="Certificate" enabled={Boolean(certificate?.title)} detail={certificate?.title || ''} />
            </Card.Content>
          </Card>

          {!canUrl || !canCustomize || !canSeo ? (
            <Card className="border-slate-200 bg-slate-950 text-white shadow-sm">
              <Card.Content className="p-5">
                <p className="text-sm font-bold">Need more portfolio controls?</p>
                <p className="mt-2 text-xs leading-5 text-slate-300">
                  Silver, Gold and Diamond plans unlock premium URL, custom sections, SEO fields and certificate tools.
                </p>
                <Button asChild className="mt-4 w-full bg-white text-slate-950 hover:bg-slate-100">
                  <Link to={subscriptionsPath}>View plans</Link>
                </Button>
              </Card.Content>
            </Card>
          ) : null}
        </div>

        <div className="space-y-5">
          <Card className="border-slate-200 bg-white shadow-sm">
            <Card.Header>
              <Card.Title className="flex items-center gap-2 text-lg">
                <Link2 className="h-5 w-5 text-[#003D82]" />
                Custom profile URL
              </Card.Title>
            </Card.Header>
            <Card.Content className="space-y-4">
              <FieldShell locked={!canUrl}>
                <div className="grid gap-2">
                  <Label>Profile slug</Label>
                  <div className="flex flex-col gap-2 md:flex-row">
                    <div className="flex min-w-0 flex-1 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
                      indiantrademart.com/directory/vendor/
                    </div>
                    <Input
                      value={form.profile_slug}
                      onChange={(event) => setForm((prev) => ({ ...prev, profile_slug: normalizeSlug(event.target.value) }))}
                      className="md:w-[280px]"
                    />
                  </div>
                </div>
              </FieldShell>
            </Card.Content>
          </Card>

          <Card className="border-slate-200 bg-white shadow-sm">
            <Card.Header>
              <Card.Title className="flex items-center gap-2 text-lg">
                <LayoutTemplate className="h-5 w-5 text-[#003D82]" />
                Portfolio content
              </Card.Title>
            </Card.Header>
            <Card.Content className="space-y-4">
              <FieldShell locked={!canCustomize}>
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label>Portfolio headline</Label>
                    <Input
                      value={form.tagline}
                      maxLength={140}
                      onChange={(event) => setForm((prev) => ({ ...prev, tagline: event.target.value }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Portfolio intro</Label>
                    <Textarea
                      rows={5}
                      value={form.intro}
                      maxLength={900}
                      onChange={(event) => setForm((prev) => ({ ...prev, intro: event.target.value }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Highlight chips</Label>
                    <Input
                      value={form.featured_highlights}
                      onChange={(event) => setForm((prev) => ({ ...prev, featured_highlights: event.target.value }))}
                      placeholder="ISO work, Fast delivery, Pan India supply"
                    />
                  </div>
                </div>
              </FieldShell>
            </Card.Content>
          </Card>

          <Card className="border-slate-200 bg-white shadow-sm">
            <Card.Header>
              <div className="flex items-center justify-between gap-3">
                <Card.Title className="flex items-center gap-2 text-lg">
                  <Sparkles className="h-5 w-5 text-[#003D82]" />
                  Custom sections
                </Card.Title>
                <Button type="button" variant="outline" size="sm" className="gap-2" disabled={!canSections || form.custom_sections.length >= 6} onClick={addSection}>
                  <Plus className="h-4 w-4" />
                  Add section
                </Button>
              </div>
            </Card.Header>
            <Card.Content className="space-y-4">
              <FieldShell locked={!canSections}>
                {form.custom_sections.map((section, index) => (
                  <div key={index} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-sm font-bold text-slate-800">Section {index + 1}</p>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => removeSection(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid gap-3">
                      <Input
                        value={section.title}
                        maxLength={90}
                        onChange={(event) => updateSection(index, { title: event.target.value })}
                        placeholder="Why choose us"
                      />
                      <Textarea
                        rows={4}
                        value={section.body}
                        maxLength={700}
                        onChange={(event) => updateSection(index, { body: event.target.value })}
                        placeholder="Add portfolio details"
                      />
                    </div>
                  </div>
                ))}
              </FieldShell>
            </Card.Content>
          </Card>

          <Card className="border-slate-200 bg-white shadow-sm">
            <Card.Header>
              <Card.Title className="flex items-center gap-2 text-lg">
                <SearchCheck className="h-5 w-5 text-[#003D82]" />
                SEO and sitemap
              </Card.Title>
            </Card.Header>
            <Card.Content className="space-y-5">
              <FieldShell locked={!canSeo}>
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label>SEO title</Label>
                    <Input
                      value={form.seo.title}
                      maxLength={90}
                      onChange={(event) => setForm((prev) => ({ ...prev, seo: { ...prev.seo, title: event.target.value } }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>SEO description</Label>
                    <Textarea
                      rows={3}
                      value={form.seo.description}
                      maxLength={220}
                      onChange={(event) => setForm((prev) => ({ ...prev, seo: { ...prev.seo, description: event.target.value } }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>SEO keywords</Label>
                    <Input
                      value={form.seo.keywords}
                      onChange={(event) => setForm((prev) => ({ ...prev, seo: { ...prev.seo, keywords: event.target.value } }))}
                      placeholder="keyword one, keyword two"
                    />
                  </div>
                </div>
              </FieldShell>

              <FieldShell locked={!canSitemap}>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={form.sitemap.enabled}
                      onChange={(event) => setForm((prev) => ({ ...prev, sitemap: { ...prev.sitemap, enabled: event.target.checked } }))}
                      className="mt-1 h-4 w-4 rounded border-slate-300"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900">Include custom portfolio signals in sitemap</p>
                      <p className="mt-1 text-xs text-slate-500">{entitlements.sitemap.seo_pages || entitlements.sitemap.url_boost || 0}+ page reach on current plan</p>
                    </div>
                  </label>
                  <div className="mt-4 grid gap-2">
                    <Label>Priority sitemap keywords</Label>
                    <Input
                      value={form.sitemap.priority_keywords}
                      onChange={(event) => setForm((prev) => ({ ...prev, sitemap: { ...prev.sitemap, priority_keywords: event.target.value } }))}
                    />
                  </div>
                </div>
              </FieldShell>
            </Card.Content>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PortfolioStudio;
