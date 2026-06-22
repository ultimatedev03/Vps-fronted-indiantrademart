import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  BadgeCheck,
  CheckCircle2,
  Crown,
  Download,
  ExternalLink,
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
      certificate: 'border-cyan-200 bg-[linear-gradient(135deg,#f7feff_0%,#ffffff_48%,#fff8ed_100%)]',
      ribbon: 'border-cyan-200 bg-cyan-50 text-cyan-800',
      seal: 'bg-[linear-gradient(135deg,#04788f_0%,#0ea5a8_48%,#c18a35_100%)]',
      foil: 'text-amber-700',
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
      certificate: 'border-amber-200 bg-[linear-gradient(135deg,#fffdf4_0%,#ffffff_48%,#fff4d6_100%)]',
      ribbon: 'border-amber-200 bg-amber-50 text-amber-800',
      seal: 'bg-[linear-gradient(135deg,#a16207_0%,#d97706_48%,#f7c76a_100%)]',
      foil: 'text-amber-700',
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
      certificate: 'border-slate-300 bg-[linear-gradient(135deg,#f8fafc_0%,#ffffff_52%,#eef2f7_100%)]',
      ribbon: 'border-slate-300 bg-slate-100 text-slate-800',
      seal: 'bg-[linear-gradient(135deg,#475569_0%,#94a3b8_52%,#cbd5e1_100%)]',
      foil: 'text-slate-700',
      label: 'Silver trust asset',
    };
  }
  return {
    accent: 'text-blue-700',
    border: 'border-blue-200',
    soft: 'bg-blue-50',
    solid: 'bg-[#003D82]',
    ring: 'ring-blue-100',
    certificate: 'border-blue-200 bg-[linear-gradient(135deg,#f8fbff_0%,#ffffff_52%,#edfdfa_100%)]',
    ribbon: 'border-blue-200 bg-blue-50 text-blue-800',
    seal: 'bg-[linear-gradient(135deg,#003D82_0%,#0f766e_52%,#b7791f_100%)]',
    foil: 'text-amber-700',
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

const formatDisplayDate = (value) => {
  if (!value) return '';
  const formatted = formatDate(value);
  return formatted || String(value || '').trim();
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

const CertificatePreview = ({
  companyName,
  certificate,
  planBadgeLabel,
  planName,
  subscription,
  styles,
}) => {
  const certificateTitle = certificate?.title || planBadgeLabel || 'Verified Vendor';
  const issuedOn = formatDisplayDate(certificate?.issued_on || subscription?.start_date);
  const validUntil = formatDisplayDate(certificate?.valid_until || subscription?.end_date) || 'Active plan';
  const certificateNumber = certificate?.certificate_number || 'Generated after activation';

  return (
    <div
      className={cn(
        'relative min-h-[420px] overflow-hidden rounded-lg border p-4 shadow-[0_24px_60px_rgba(15,23,42,0.12)] sm:p-5',
        'h-auto xl:h-[clamp(430px,56vh,520px)]',
        styles.certificate
      )}
    >
      <div className="absolute inset-x-6 top-5 h-px bg-gradient-to-r from-transparent via-amber-500/70 to-transparent" />
      <div className="absolute inset-x-6 bottom-5 h-px bg-gradient-to-r from-transparent via-amber-500/70 to-transparent" />
      <div className="absolute inset-y-6 left-5 w-px bg-gradient-to-b from-transparent via-cyan-600/55 to-transparent" />
      <div className="absolute inset-y-6 right-5 w-px bg-gradient-to-b from-transparent via-cyan-600/55 to-transparent" />

      <img
        src="/itm-mark.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 object-contain opacity-[0.055] sm:h-80 sm:w-80"
      />
      <p className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none text-center text-4xl font-black uppercase tracking-[0.18em] text-cyan-900/5 sm:text-5xl">
        IndianTradeMart
      </p>

      <div className="relative flex h-full min-h-[390px] flex-col rounded-md border border-white/70 bg-white/45 px-4 py-4 sm:px-7 sm:py-5">
        <div className="flex items-start justify-between gap-4">
          <img
            src="/itm-logo.png"
            alt="IndianTradeMart"
            className="h-12 w-auto max-w-[170px] object-contain sm:h-14"
            loading="eager"
          />
          <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold shadow-sm', styles.ribbon)}>
            <ShieldCheck className="h-3.5 w-3.5" />
            Verified
          </span>
        </div>

        <div className="mx-auto mt-3 max-w-3xl text-center">
          <p className={cn('text-[11px] font-bold uppercase tracking-[0.24em]', styles.foil)}>
            Official Vendor Certificate
          </p>
          <h3 className="mt-3 text-balance text-2xl font-black uppercase leading-tight text-slate-950 sm:text-3xl">
            {certificateTitle}
          </h3>
          <p className="mt-4 text-sm font-medium text-slate-600">Proudly presented to</p>
          <h2 className="mx-auto mt-2 max-w-3xl break-words text-3xl font-black leading-tight text-cyan-800 sm:text-4xl">
            {companyName}
          </h2>
          <div className="mx-auto mt-4 h-0.5 w-36 rounded-full bg-gradient-to-r from-cyan-500 via-amber-500 to-cyan-500" />
          <p className="mx-auto mt-4 max-w-2xl text-sm font-medium leading-6 text-slate-700">
            Recognized for an active {planName} membership and verified business presence on IndianTradeMart.
          </p>
        </div>

        <div className="mt-auto grid gap-2 rounded-md border border-slate-200/80 bg-white/80 p-3 shadow-sm sm:grid-cols-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Certificate No.</p>
            <p className="mt-1 break-all text-xs font-black text-slate-900">{certificateNumber}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Issued On</p>
            <p className="mt-1 text-xs font-black text-slate-900">{issuedOn || '-'}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Valid Until</p>
            <p className="mt-1 text-xs font-black text-slate-900">{validUntil}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Status</p>
            <p className={cn('mt-1 inline-flex items-center gap-1 text-xs font-black', styles.accent)}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              Active
            </p>
          </div>
        </div>

        <div className="mt-3 flex items-end justify-between gap-4">
          <div>
            <div className="h-px w-40 bg-slate-800" />
            <p className="mt-2 text-xs font-bold text-slate-700">Authorized by IndianTradeMart</p>
          </div>
          <div className={cn('flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-white shadow-lg ring-4 ring-white', styles.seal)}>
            <Award className="h-8 w-8" />
          </div>
        </div>
      </div>
    </div>
  );
};

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
  const vendorSlug = displayProfile.slug || displayProfile.profile_slug || displayProfile.vendor_slug;
  const publicProfilePath = displayProfile.profile_url || (vendorSlug ? `/directory/vendor/${vendorSlug}` : '');

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
      className="h-10 gap-2 bg-[#003D82] px-4 text-sm font-semibold shadow-sm hover:bg-[#003D82]/90"
      onClick={downloadCertificate}
    >
      <Download className="h-4 w-4" />
      Download display PDF
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
      <div className={cn('grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]', className)}>
        <CertificatePreview
          companyName={companyName}
          certificate={certificate}
          planBadgeLabel={planBadgeLabel}
          planName={planName}
          subscription={subscription}
          styles={styles}
        />

        <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="rounded-lg border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-cyan-50 p-4">
            <div className="flex items-start gap-3">
              <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white shadow-sm', styles.seal)}>
                <Crown className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{styles.label}</p>
                <h2 className="mt-1 text-lg font-black leading-tight text-slate-950">
                  Certificate ready for display
                </h2>
                <p className="mt-2 text-sm leading-5 text-slate-600">
                  {companyName} is recognized as {certificate?.title || planBadgeLabel || planName}.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <MetricTile icon={BadgeCheck} label="Badge" value={planBadgeLabel || planName} />
            <MetricTile icon={SearchCheck} label="SEO" value={entitlements.seo.enabled ? 'SEO-ready' : 'Standard'} />
            <MetricTile icon={LayoutTemplate} label="Portfolio" value={entitlements.portfolio.premium ? 'Premium' : 'Business'} />
            <MetricTile icon={Sparkles} label="Valid till" value={endDate || 'Active'} />
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Trust assets</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {benefitChips.slice(0, 6).map((chip) => (
                <span key={chip} className="inline-flex items-center gap-1 rounded-full border border-white bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  {chip}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-auto grid gap-2">
            {primaryCta}
            {publicProfilePath ? (
              <Button asChild variant="outline" className="h-10 justify-between border-slate-300 text-sm font-semibold">
                {String(publicProfilePath).startsWith('http') ? (
                  <a href={publicProfilePath} target="_blank" rel="noreferrer">
                    View public profile
                    <ExternalLink className="h-4 w-4" />
                  </a>
                ) : (
                  <Link to={publicProfilePath}>
                    View public profile
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </Button>
            ) : null}
            {managePlanPath ? (
              <Button asChild variant="ghost" className="h-10 justify-between text-sm font-semibold text-[#003D82]">
                <Link to={managePlanPath}>
                  Manage plan
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : null}
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
