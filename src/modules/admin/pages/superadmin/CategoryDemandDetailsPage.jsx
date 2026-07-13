import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { superAdminServerApi } from '@/modules/admin/services/superAdminServerApi';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Database,
  Mail,
  MapPin,
  PackageSearch,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRoundSearch,
} from 'lucide-react';

const STATUS_META = {
  NO_SUPPLY: {
    label: 'No supplier coverage',
    className: 'border-red-800 bg-red-950 text-red-300',
  },
  HIGH_DEMAND: {
    label: 'High buyer demand',
    className: 'border-amber-800 bg-amber-950 text-amber-300',
  },
  BALANCED: {
    label: 'Demand covered',
    className: 'border-emerald-800 bg-emerald-950 text-emerald-300',
  },
  SUPPLY_HEAVY: {
    label: 'Supply heavy',
    className: 'border-blue-900 bg-blue-950 text-blue-300',
  },
  SUPPLY_ONLY: {
    label: 'No recent demand',
    className: 'border-neutral-700 bg-neutral-800 text-neutral-300',
  },
};

const LEVEL_LABELS = {
  head: 'Main category',
  sub: 'Sub category',
  micro: 'Micro category',
};

const formatNumber = (value) => Number(value || 0).toLocaleString('en-IN');

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatBudget = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return value || '-';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(numeric);
};

const deriveStatus = (vendors, requirements) => {
  const supply = Number(vendors || 0);
  const demand = Number(requirements || 0);
  if (demand > 0 && supply === 0) return 'NO_SUPPLY';
  if (supply > 0 && demand / supply >= 2) return 'HIGH_DEMAND';
  if (supply > 0 && demand / supply >= 0.5) return 'BALANCED';
  if (demand > 0) return 'SUPPLY_HEAVY';
  return 'SUPPLY_ONLY';
};

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.SUPPLY_ONLY;
  return (
    <span className={`inline-flex whitespace-nowrap rounded border px-2.5 py-1 text-xs font-medium ${meta.className}`}>
      {meta.label}
    </span>
  );
}

function SourceBadge({ source }) {
  const normalized = String(source || '').toUpperCase();
  const label = {
    LISTING: 'Active listing',
    PREFERENCE: 'Saved preference',
    LISTING_AND_PREFERENCE: 'Listing + preference',
    PROPOSAL: 'Buyer proposal',
    LEAD: 'Standalone lead',
  }[normalized] || normalized.replaceAll('_', ' ').toLowerCase();

  return (
    <Badge variant="outline" className="border-neutral-700 bg-neutral-950 text-[10px] text-neutral-300">
      {label || 'Unknown source'}
    </Badge>
  );
}

function ContactItem({ icon: Icon, value, href }) {
  if (!value) return null;
  const content = (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-neutral-400">
      <Icon className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
      <span className="truncate">{value}</span>
    </span>
  );

  return href ? (
    <a href={href} className="min-w-0 hover:text-cyan-300" title={value}>{content}</a>
  ) : content;
}

function StatTile({ label, value, expected, valueClassName, borderClassName = '' }) {
  return (
    <div className={`min-w-0 px-4 py-4 ${borderClassName}`}>
      <p className="text-[11px] font-medium uppercase text-neutral-500">{label}</p>
      <p className={`mt-1.5 text-2xl font-semibold ${valueClassName}`}>{formatNumber(value)}</p>
      {expected != null ? (
        <p className="mt-1 text-[11px] text-neutral-600">Aggregate: {formatNumber(expected)}</p>
      ) : null}
    </div>
  );
}

function EmptyState({ children }) {
  return <div className="px-5 py-14 text-center text-sm text-neutral-600">{children}</div>;
}

export default function CategoryDemandDetailsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { level: routeLevel, categoryId: routeCategoryId } = useParams();
  const [searchParams] = useSearchParams();
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const level = ['head', 'sub', 'micro'].includes(routeLevel) ? routeLevel : 'head';
  const categoryId = routeCategoryId || '';
  const requestedDays = Number(searchParams.get('days'));
  const days = Number.isFinite(requestedDays) && requestedDays >= 0 ? requestedDays : 90;
  const aggregate = location.state?.category || null;
  const hasExpectedVendors = aggregate?.vendor_count != null || searchParams.has('vendors');
  const hasExpectedRequirements = aggregate?.requirement_count != null || searchParams.has('requirements');
  const expectedVendors = hasExpectedVendors
    ? Number(aggregate?.vendor_count ?? searchParams.get('vendors') ?? 0)
    : null;
  const expectedRequirements = hasExpectedRequirements
    ? Number(aggregate?.requirement_count ?? searchParams.get('requirements') ?? 0)
    : null;

  const dashboardPath = location.pathname.startsWith('/admin/')
    ? '/admin/superadmin/dashboard?tab=category-demand'
    : '/superadmin/dashboard?tab=category-demand';

  const fetchDetails = useCallback(async () => {
    if (!categoryId) return;
    setLoading(true);
    setError('');
    try {
      const response = await superAdminServerApi.intelligence.categoryDemandDetails({
        categoryId,
        level,
        days,
        vendorLimit: 100,
        demandLimit: 100,
      });
      setDetails(response?.data || null);
    } catch (requestError) {
      setError(requestError?.message || 'Failed to load category verification records');
    } finally {
      setLoading(false);
    }
  }, [categoryId, days, level]);

  useEffect(() => {
    void fetchDetails();
  }, [fetchDetails]);

  const actualVendors = Number(details?.totals?.vendors || 0);
  const actualRequirements = Number(details?.totals?.requirements || 0);
  const vendorCountMatches = hasExpectedVendors ? actualVendors === expectedVendors : null;
  const requirementCountMatches = hasExpectedRequirements ? actualRequirements === expectedRequirements : null;
  const recordsReconciled = vendorCountMatches == null || requirementCountMatches == null
    ? null
    : vendorCountMatches && requirementCountMatches;
  const status = aggregate?.match_status
    || searchParams.get('status')
    || deriveStatus(actualVendors, actualRequirements);
  const categoryPath = details?.category?.category_path
    || details?.category?.category_name
    || aggregate?.category_path
    || searchParams.get('path')
    || 'Category match review';
  const periodLabel = days === 0 ? 'All-time records' : `Last ${days} days`;

  const reconciliationCopy = useMemo(() => {
    if (recordsReconciled === true) {
      return {
        title: 'Aggregate and detailed records reconcile',
        description: 'Vendor and buyer requirement totals match the category analytics snapshot.',
        className: 'border-emerald-900 bg-emerald-950/30',
        titleClassName: 'text-emerald-200',
        icon: ShieldCheck,
        iconClassName: 'text-emerald-400',
      };
    }
    if (recordsReconciled === false) {
      return {
        title: 'Count mismatch needs review',
        description: `Vendor count ${vendorCountMatches ? 'matches' : 'differs'}; buyer requirement count ${requirementCountMatches ? 'matches' : 'differs'}.`,
        className: 'border-red-900 bg-red-950/30',
        titleClassName: 'text-red-200',
        icon: AlertTriangle,
        iconClassName: 'text-red-400',
      };
    }
    return {
      title: 'Detailed records loaded',
      description: 'Open this review from Category Demand & Supply to compare against its aggregate snapshot.',
      className: 'border-cyan-900 bg-cyan-950/20',
      titleClassName: 'text-cyan-200',
      icon: CheckCircle2,
      iconClassName: 'text-cyan-400',
    };
  }, [recordsReconciled, requirementCountMatches, vendorCountMatches]);

  const ReconciliationIcon = reconciliationCopy.icon;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200">
      <header className="sticky top-0 z-20 border-b border-neutral-800 bg-neutral-950/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0 border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800 hover:text-white"
              onClick={() => navigate(dashboardPath)}
              title="Back to category analytics"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-cyan-400" />
                <h1 className="text-lg font-semibold text-white">Category Match Review</h1>
                <span className="rounded border border-neutral-800 bg-neutral-900 px-2 py-0.5 text-[10px] font-medium uppercase text-neutral-500">
                  {LEVEL_LABELS[level]}
                </span>
              </div>
              <p className="mt-1 truncate text-sm text-neutral-400" title={categoryPath}>{categoryPath}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pl-12 lg:pl-0">
            <span className="inline-flex items-center gap-1.5 text-xs text-neutral-500">
              <CalendarDays className="h-3.5 w-3.5" />
              {periodLabel}
            </span>
            {!loading && details ? <StatusBadge status={status} /> : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800 hover:text-white"
              onClick={fetchDetails}
              disabled={loading}
            >
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Recheck
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1800px] px-4 py-5 sm:px-6 lg:py-6">
        {loading ? (
          <div className="flex min-h-[60vh] items-center justify-center gap-3 text-sm text-neutral-400">
            <RefreshCw className="h-5 w-5 animate-spin text-cyan-400" />
            Reconciling vendor, buyer and customer-interest records...
          </div>
        ) : error ? (
          <div className="flex min-h-[55vh] flex-col items-center justify-center gap-4 rounded-md border border-red-900 bg-red-950/20 px-6 text-center">
            <AlertTriangle className="h-8 w-8 text-red-400" />
            <div>
              <h2 className="font-semibold text-red-200">Category review could not be loaded</h2>
              <p className="mt-1 text-sm text-red-300/80">{error}</p>
            </div>
            <Button type="button" variant="outline" className="border-red-800 text-red-200 hover:bg-red-950" onClick={fetchDetails}>
              Retry verification
            </Button>
          </div>
        ) : details ? (
          <div className="space-y-5">
            <section className={`flex flex-col gap-4 rounded-md border px-4 py-4 sm:flex-row sm:items-center sm:justify-between ${reconciliationCopy.className}`}>
              <div className="flex items-start gap-3">
                <ReconciliationIcon className={`mt-0.5 h-5 w-5 shrink-0 ${reconciliationCopy.iconClassName}`} />
                <div>
                  <h2 className={`text-sm font-semibold ${reconciliationCopy.titleClassName}`}>{reconciliationCopy.title}</h2>
                  <p className="mt-1 text-xs leading-5 text-neutral-400">{reconciliationCopy.description}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-[11px] text-neutral-500">
                <Database className="h-3.5 w-3.5" />
                Generated {formatDateTime(details.generated_at)}
              </div>
            </section>

            <section className="grid overflow-hidden rounded-md border border-neutral-800 bg-neutral-900 sm:grid-cols-2 xl:grid-cols-5">
              <StatTile label="Matching vendors" value={actualVendors} expected={expectedVendors} valueClassName="text-blue-300" />
              <StatTile label="Buyer requirements" value={actualRequirements} expected={expectedRequirements} valueClassName="text-violet-300" borderClassName="border-t border-neutral-800 sm:border-l sm:border-t-0" />
              <StatTile label="Category searches" value={details.activity?.searches} valueClassName="text-cyan-300" borderClassName="border-t border-neutral-800 xl:border-l xl:border-t-0" />
              <StatTile label="Interested visitors" value={details.activity?.unique_visitors} valueClassName="text-emerald-300" borderClassName="border-t border-neutral-800 sm:border-l xl:border-t-0" />
              <StatTile label="Mirrored rows removed" value={details.reconciliation?.mirrored_leads_excluded} valueClassName="text-amber-300" borderClassName="border-t border-neutral-800 xl:border-l xl:border-t-0" />
            </section>

            <section className="rounded-md border border-neutral-800 bg-neutral-900/60">
              <div className="flex flex-col gap-2 border-b border-neutral-800 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Search className="h-4 w-4 text-cyan-400" />
                    Customer interest signals
                  </h2>
                  <p className="mt-1 text-xs text-neutral-500">Public search and browsing activity associated with this category.</p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs text-neutral-500">
                  <Activity className="h-3.5 w-3.5" />
                  Latest {formatDateTime(details.activity?.latest_activity_at)}
                </span>
              </div>
              <div className="grid gap-5 p-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(360px,1.2fr)]">
                <div className="grid grid-cols-2 overflow-hidden rounded border border-neutral-800 bg-neutral-950 sm:grid-cols-4 lg:grid-cols-2">
                  {[
                    ['All actions', details.activity?.total_events],
                    ['Category views', details.activity?.category_views],
                    ['Product views', details.activity?.product_views],
                    ['Vendor views', details.activity?.vendor_views],
                  ].map(([label, value], index) => (
                    <div key={label} className={`px-3 py-3 ${index ? 'border-l border-neutral-800 lg:border-l-0' : ''} ${index >= 2 ? 'lg:border-t' : ''} ${index % 2 ? 'lg:border-l' : ''}`}>
                      <p className="text-[11px] text-neutral-500">{label}</p>
                      <p className="mt-1 text-lg font-semibold text-neutral-200">{formatNumber(value)}</p>
                    </div>
                  ))}
                </div>
                <div className="min-w-0">
                  <p className="mb-2 text-xs font-medium text-neutral-400">Top related searches</p>
                  {(details.activity?.top_searches || []).length ? (
                    <div className="flex flex-wrap gap-2">
                      {details.activity.top_searches.map((item) => (
                        <span key={item.search_query} className="inline-flex min-w-0 items-center gap-2 rounded border border-neutral-700 bg-neutral-950 px-2.5 py-1.5 text-xs text-neutral-300">
                          <span className="max-w-64 truncate">{item.search_query}</span>
                          <span className="font-semibold text-cyan-300">{formatNumber(item.event_count)}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-neutral-600">No related search signals in this period.</p>
                  )}
                </div>
              </div>
            </section>

            <div className="grid items-start gap-5 xl:grid-cols-2">
              <section className="min-w-0 overflow-hidden rounded-md border border-neutral-800 bg-neutral-900/60">
                <div className="flex items-start justify-between gap-3 border-b border-neutral-800 px-4 py-4">
                  <div>
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                      <UserRoundSearch className="h-4 w-4 text-violet-400" />
                      Buyer requirements
                    </h2>
                    <p className="mt-1 text-xs text-neutral-500">Canonical proposals and standalone leads only.</p>
                  </div>
                  <Badge variant="outline" className="border-violet-900 bg-violet-950 text-violet-300">{formatNumber(actualRequirements)}</Badge>
                </div>
                <div className="divide-y divide-neutral-800">
                  {(details.requirements || []).length ? details.requirements.map((requirement) => (
                    <article key={requirement.demand_id} className="px-4 py-4 hover:bg-neutral-900">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-semibold text-white" title={requirement.product_name || requirement.title}>
                            {requirement.product_name || requirement.title || 'Untitled requirement'}
                          </h3>
                          <p className="mt-1 truncate text-xs text-neutral-500">
                            {requirement.buyer_name || requirement.company_name || requirement.buyer_email || requirement.buyer_key || 'Anonymous buyer'}
                          </p>
                        </div>
                        <SourceBadge source={requirement.source_type} />
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
                        <div><dt className="text-neutral-600">Quantity</dt><dd className="mt-0.5 text-neutral-300">{requirement.quantity || '-'}</dd></div>
                        <div><dt className="text-neutral-600">Budget</dt><dd className="mt-0.5 text-neutral-300">{formatBudget(requirement.budget)}</dd></div>
                        <div><dt className="text-neutral-600">Status</dt><dd className="mt-0.5 text-neutral-300">{requirement.status || '-'}</dd></div>
                        <div><dt className="text-neutral-600">Created</dt><dd className="mt-0.5 text-neutral-300">{formatDateTime(requirement.created_at)}</dd></div>
                      </dl>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t border-neutral-800 pt-3">
                        <ContactItem icon={Mail} value={requirement.buyer_email} href={requirement.buyer_email ? `mailto:${requirement.buyer_email}` : ''} />
                        <ContactItem icon={Phone} value={requirement.buyer_phone} href={requirement.buyer_phone ? `tel:${requirement.buyer_phone}` : ''} />
                        <ContactItem icon={MapPin} value={[requirement.location, requirement.city, requirement.state].filter(Boolean).join(', ')} />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-neutral-600">
                        <span>ID: {requirement.source_id}</span>
                        <span>Mapping: {String(requirement.category_mapping_source || '').replaceAll('_', ' ')}</span>
                        {!requirement.has_buyer_contact ? <span className="text-amber-400">Contact missing</span> : null}
                      </div>
                    </article>
                  )) : <EmptyState>No buyer requirement found in this period.</EmptyState>}
                </div>
              </section>

              <section className="min-w-0 overflow-hidden rounded-md border border-neutral-800 bg-neutral-900/60">
                <div className="flex items-start justify-between gap-3 border-b border-neutral-800 px-4 py-4">
                  <div>
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                      <Building2 className="h-4 w-4 text-blue-400" />
                      Matching vendors
                    </h2>
                    <p className="mt-1 text-xs text-neutral-500">Active vendors matched through listings or saved preferences.</p>
                  </div>
                  <Badge variant="outline" className="border-blue-900 bg-blue-950 text-blue-300">{formatNumber(actualVendors)}</Badge>
                </div>
                <div className="divide-y divide-neutral-800">
                  {(details.vendors || []).length ? details.vendors.map((vendor) => (
                    <article key={vendor.id} className="px-4 py-4 hover:bg-neutral-900">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="truncate text-sm font-semibold text-white" title={vendor.company_name}>{vendor.company_name || 'Unnamed vendor'}</h3>
                            {vendor.is_verified ? <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" /> : null}
                          </div>
                          <p className="mt-1 truncate text-xs text-neutral-500">
                            {[vendor.owner_name, vendor.primary_business_type].filter(Boolean).join(' | ') || vendor.display_vendor_id || vendor.id}
                          </p>
                        </div>
                        <SourceBadge source={vendor.membership_source} />
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
                        <div><dt className="text-neutral-600">Active products</dt><dd className="mt-0.5 font-semibold text-blue-300">{formatNumber(vendor.active_product_count)}</dd></div>
                        <div><dt className="text-neutral-600">KYC / account</dt><dd className="mt-0.5 text-neutral-300">{vendor.kyc_status || vendor.account_status || vendor.status || '-'}</dd></div>
                        <div><dt className="text-neutral-600">Profile completion</dt><dd className="mt-0.5 text-neutral-300">{formatNumber(vendor.profile_completion)}%</dd></div>
                        <div><dt className="text-neutral-600">Latest listing</dt><dd className="mt-0.5 text-neutral-300">{formatDate(vendor.latest_product_at)}</dd></div>
                      </dl>
                      {(vendor.product_samples || []).length ? (
                        <div className="mt-3 border-t border-neutral-800 pt-3">
                          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] text-neutral-500"><PackageSearch className="h-3.5 w-3.5" /> Product samples</p>
                          <p className="line-clamp-2 text-xs leading-5 text-neutral-400">{vendor.product_samples.join(' | ')}</p>
                        </div>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t border-neutral-800 pt-3">
                        <ContactItem icon={Mail} value={vendor.email} href={vendor.email ? `mailto:${vendor.email}` : ''} />
                        <ContactItem icon={Phone} value={vendor.phone} href={vendor.phone ? `tel:${vendor.phone}` : ''} />
                        <ContactItem icon={MapPin} value={[vendor.city, vendor.state, vendor.pincode].filter(Boolean).join(', ')} />
                        {vendor.slug ? (
                          <a href={`/directory/vendor/${vendor.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300">
                            Public profile <ArrowUpRight className="h-3.5 w-3.5" />
                          </a>
                        ) : null}
                      </div>
                      <p className="mt-2 truncate text-[10px] text-neutral-600" title={vendor.id}>Vendor ID: {vendor.display_vendor_id || vendor.id}</p>
                    </article>
                  )) : <EmptyState>No matching active vendor found.</EmptyState>}
                </div>
              </section>
            </div>

            <section className="rounded-md border border-neutral-800 bg-neutral-900/60">
              <div className="grid divide-y divide-neutral-800 text-xs text-neutral-400 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-5">
                {[
                  ['Preference only', details.reconciliation?.preference_only_vendors, 'text-neutral-200'],
                  ['Listing only', details.reconciliation?.listing_only_vendors, 'text-neutral-200'],
                  ['Both sources', details.reconciliation?.listing_and_preference_vendors, 'text-neutral-200'],
                  ['Missing contact', details.reconciliation?.requirements_without_contact, 'text-amber-300'],
                  ['Anonymous demand', details.reconciliation?.anonymous_requirements, 'text-amber-300'],
                ].map(([label, value, valueClass]) => (
                  <div key={label} className="flex items-center justify-between gap-3 px-4 py-3 sm:block">
                    <span>{label}</span>
                    <strong className={`sm:mt-1 sm:block ${valueClass}`}>{formatNumber(value)}</strong>
                  </div>
                ))}
              </div>
              <div className="grid gap-2 border-t border-neutral-800 px-4 py-3 text-[11px] leading-5 text-neutral-600 lg:grid-cols-3">
                <p>{details.methodology?.supply}</p>
                <p>{details.methodology?.demand}</p>
                <p>{details.methodology?.activity}</p>
              </div>
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}
