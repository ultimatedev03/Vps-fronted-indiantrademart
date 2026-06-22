import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  BadgeCheck,
  CheckCircle2,
  Crown,
  Download,
  Globe2,
  LayoutTemplate,
  SearchCheck,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiUrl } from '@/lib/apiBase';
import {
  buildVendorPlanBenefitChips,
  getVendorCertificate,
  getVendorPlanBadgeLabel,
  getVendorPlanEntitlements,
} from '@/shared/utils/vendorPlanEntitlements';

const cn = (...classes) => classes.filter(Boolean).join(' ');

const getTierStyles = (label = '') => {
  const token = String(label || '').toLowerCase();
  if (token.includes('diamond') || token.includes('dimond')) {
    return {
      accent: 'text-cyan-700',
      border: 'border-cyan-200',
      soft: 'bg-cyan-50',
      solid: 'bg-cyan-700',
      ring: 'ring-cyan-100',
      label: 'Diamond trust asset',
    };
  }
  if (token.includes('gold')) {
    return {
      accent: 'text-amber-700',
      border: 'border-amber-200',
      soft: 'bg-amber-50',
      solid: 'bg-amber-600',
      ring: 'ring-amber-100',
      label: 'Gold trust asset',
    };
  }
  if (token.includes('silver')) {
    return {
      accent: 'text-slate-700',
      border: 'border-slate-300',
      soft: 'bg-slate-100',
      solid: 'bg-slate-700',
      ring: 'ring-slate-100',
      label: 'Silver trust asset',
    };
  }
  return {
    accent: 'text-blue-700',
    border: 'border-blue-200',
    soft: 'bg-blue-50',
    solid: 'bg-[#003D82]',
    ring: 'ring-blue-100',
    label: 'Verified trust asset',
  };
};

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const buildDisplayProfile = (vendor = {}, subscription = null) => ({
  ...vendor,
  active_plan: vendor?.active_plan || subscription?.plan || null,
  plan_entitlements:
    vendor?.plan_entitlements ||
    vendor?.active_plan?.entitlements ||
    subscription?.plan?.entitlements ||
    null,
  certificate: vendor?.certificate || null,
});

const MetricTile = ({ icon: Icon, label, value }) => (
  <div className="rounded-lg border border-slate-200 bg-white/80 p-3 shadow-sm">
    <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-md bg-slate-50 text-[#003D82]">
      <Icon className="h-4 w-4" />
    </div>
    <p className="text-[11px] font-semibold uppercase text-slate-500">{label}</p>
    <p className="mt-0.5 text-sm font-bold text-slate-950">{value}</p>
  </div>
);

const CertificatePreview = ({ companyName, certificate, planBadgeLabel, styles, compact = false }) => (
  <div
    className={cn(
      'relative overflow-hidden rounded-xl border bg-white shadow-sm',
      styles.border,
      compact ? 'p-4' : 'p-5'
    )}
  >
    <div className={cn('absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-70', styles.soft)} />
    <div className="relative">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            IndianTradeMart Certificate
          </p>
          <h3 className={cn('mt-1 font-bold leading-tight text-slate-950', compact ? 'text-base' : 'text-xl')}>
            {certificate?.title || planBadgeLabel || 'Verified Vendor'}
          </h3>
        </div>
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg text-white shadow-sm', styles.solid)}>
          <Award className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-5 border-y border-slate-100 py-4">
        <p className="text-[11px] font-semibold uppercase text-slate-500">Issued to</p>
        <p className="mt-1 text-lg font-extrabold leading-tight text-slate-950">{companyName}</p>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold uppercase text-slate-500">Certificate No.</p>
          <p className="mt-1 break-all text-xs font-semibold text-slate-700">
            {certificate?.certificate_number || 'Generated after activation'}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase text-slate-500">Status</p>
          <p className={cn('mt-1 inline-flex items-center gap-1 text-xs font-bold', styles.accent)}>
            <CheckCircle2 className="h-3.5 w-3.5" />
            Active
          </p>
        </div>
      </div>
    </div>
  </div>
);

const VendorPlanTrustPanel = ({
  vendor = {},
  subscription = null,
  loading = false,
  variant = 'dashboard',
  editProfilePath = '',
  managePlanPath = '',
  className = '',
}) => {
  const displayProfile = useMemo(() => buildDisplayProfile(vendor, subscription), [vendor, subscription]);
  const entitlements = getVendorPlanEntitlements(displayProfile);
  const planBadgeLabel = getVendorPlanBadgeLabel(displayProfile);
  const certificate = getVendorCertificate(displayProfile);
  const benefitChips = buildVendorPlanBenefitChips(displayProfile);
  const companyName =
    displayProfile.companyName ||
    displayProfile.company_name ||
    displayProfile.business_name ||
    displayProfile.name ||
    'Your business';
  const planName =
    displayProfile.active_plan?.name ||
    subscription?.plan?.name ||
    planBadgeLabel ||
    'Active plan';
  const hasTrustAsset = Boolean(planBadgeLabel || certificate?.title || benefitChips.length);
  const styles = getTierStyles(certificate?.title || planBadgeLabel || planName);
  const endDate = subscription?.end_date ? formatDate(subscription.end_date) : '';

  if (loading) {
    return (
      <div className={cn('rounded-xl border border-slate-200 bg-white p-5 shadow-sm', className)}>
        <div className="h-4 w-40 animate-pulse rounded bg-slate-100" />
        <div className="mt-4 h-20 animate-pulse rounded-lg bg-slate-100" />
      </div>
    );
  }

  if (!hasTrustAsset) return null;

  const downloadCertificate = () => {
    window.open(apiUrl('/api/vendors/me/certificate.pdf'), '_blank', 'noopener,noreferrer');
  };

  const primaryCta = certificate?.title ? (
    <Button
      type="button"
      className="h-10 gap-2 bg-[#003D82] px-4 text-sm font-semibold hover:bg-[#003D82]/90"
      onClick={downloadCertificate}
    >
      <Download className="h-4 w-4" />
      Download certificate
    </Button>
  ) : null;

  if (variant === 'compact') {
    return (
      <div className={cn('rounded-xl border border-slate-200 bg-white p-4 shadow-sm', className)}>
        <div className="flex items-start gap-3">
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-4', styles.soft, styles.accent, styles.ring)}>
            <Award className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Plan certificate</p>
            <p className="mt-1 text-sm font-bold leading-snug text-slate-950">
              {certificate?.title || planBadgeLabel || planName}
            </p>
            {certificate?.certificate_number ? (
              <p className="mt-1 break-all text-[11px] font-medium text-slate-500">#{certificate.certificate_number}</p>
            ) : null}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {benefitChips.slice(0, 3).map((chip) => (
            <span key={chip} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
              {chip}
            </span>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2">
          {certificate?.title ? (
            <Button
              type="button"
              variant="outline"
              className="h-9 w-full gap-2 border-slate-300 text-xs font-semibold text-slate-800 hover:bg-slate-50"
              onClick={downloadCertificate}
            >
              <Download className="h-3.5 w-3.5" />
              Download certificate
            </Button>
          ) : null}
          {editProfilePath ? (
            <Button asChild variant="ghost" className="h-9 w-full justify-between text-xs font-semibold text-[#003D82]">
              <Link to={editProfilePath}>
                Open certificate details
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  if (variant === 'profile') {
    return (
      <div className={cn('space-y-5', className)}>
        <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                <ShieldCheck className="h-3.5 w-3.5 text-[#003D82]" />
                {styles.label}
              </div>
              <h2 className="mt-3 text-2xl font-extrabold leading-tight text-slate-950">Plan certificate and portfolio benefits</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                These assets are active on your public profile and can be used for buyer trust, SEO visibility and offline shop display.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {primaryCta}
              {managePlanPath ? (
                <Button asChild variant="outline" className="h-10 gap-2 border-slate-300 text-sm font-semibold">
                  <Link to={managePlanPath}>
                    Manage plan
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <CertificatePreview companyName={companyName} certificate={certificate} planBadgeLabel={planBadgeLabel} styles={styles} />

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Included with {planName}</p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <MetricTile icon={BadgeCheck} label="Vendor badge" value={planBadgeLabel || planName} />
              <MetricTile icon={LayoutTemplate} label="Portfolio" value={entitlements.portfolio.premium ? 'Premium profile' : 'Business profile'} />
              <MetricTile icon={SearchCheck} label="SEO" value={entitlements.seo.enabled ? 'SEO-ready' : 'Standard'} />
              <MetricTile icon={Globe2} label="Sitemap reach" value={`${entitlements.sitemap.seo_pages || entitlements.sitemap.url_boost || 0}+ pages`} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {benefitChips.map((chip) => (
                <span key={chip} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  {chip}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm', className)}>
      <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative border-b border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100 p-5 lg:border-b-0 lg:border-r">
          <div className={cn('absolute left-0 top-0 h-full w-1.5', styles.solid)} />
          <div className="pl-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold', styles.soft, styles.border, styles.accent)}>
                <Crown className="h-3.5 w-3.5" />
                {planBadgeLabel || planName}
              </span>
              {certificate?.title ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  Certificate active
                </span>
              ) : null}
            </div>

            <h3 className="mt-4 text-xl font-extrabold leading-tight text-slate-950">
              {certificate?.title ? 'Your vendor certificate is live' : 'Your plan benefits are active'}
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              {companyName} is currently using {planName}. Keep this certificate visible on proposals, buyer conversations and your shop counter.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {benefitChips.slice(0, 5).map((chip) => (
                <span key={chip} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                  {chip}
                </span>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              {primaryCta}
              {editProfilePath ? (
                <Button asChild variant="outline" className="h-10 gap-2 border-slate-300 text-sm font-semibold">
                  <Link to={editProfilePath}>
                    View details
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 bg-slate-50 p-5">
          <MetricTile icon={Award} label="Certificate" value={certificate?.title ? 'Active' : 'Not included'} />
          <MetricTile icon={LayoutTemplate} label="Portfolio" value={entitlements.portfolio.premium ? 'Premium' : 'Standard'} />
          <MetricTile icon={SearchCheck} label="SEO profile" value={entitlements.seo.enabled ? 'Enabled' : 'Standard'} />
          <MetricTile icon={Sparkles} label="Valid till" value={endDate || 'Active'} />
        </div>
      </div>
    </div>
  );
};

export default VendorPlanTrustPanel;
