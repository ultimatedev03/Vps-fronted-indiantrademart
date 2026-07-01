import React, { useEffect, useMemo, useState } from 'react';
import { useSuperAdmin } from '@/modules/admin/context/SuperAdminContext';
import { superAdminServerApi } from '@/modules/admin/services/superAdminServerApi';
import { toast } from '@/components/ui/use-toast';
import { filterRecordsBySearch } from '@/modules/admin/lib/search';
import WebsiteVisitorActivityCard from '@/shared/components/WebsiteVisitorActivityCard';
import Search360Workspace from '@/shared/components/Search360Workspace';
import {
  DEFAULT_PLAN_CURRENCY,
  PLAN_MARKET_REGION_OPTIONS,
  PLAN_CURRENCY_OPTIONS,
  formatPlanMoney,
  getPlanCurrencyMeta,
  normalizeRegionalPrices,
  normalizePlanCurrency,
  splitPlanMarketCodes,
} from '@/shared/utils/currency';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ShieldAlert,
  LogOut,
  RefreshCw,
  Save,
  Trash2,
  KeyRound,
  Plus,
  Wrench,
  Users,
  Building2,
  IndianRupee,
  History,
  Settings,
  Package,
  BarChart3,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Download,
  Search,
  ExternalLink,
  Info,
  Pencil,
} from 'lucide-react';

// SUPERADMIN (ITM Owner) can only create ADMIN employees.
// ADMIN creates HR/FINANCE. HR creates SALES/SUPPORT/DATA_ENTRY/MANAGER/VP.
const EMPLOYEE_ROLES = ['ADMIN'];
const NOTICE_VARIANTS = ['info', 'warning', 'critical'];
const PLAN_BADGE_VARIANTS = ['neutral', 'green', 'blue', 'purple', 'silver', 'gold', 'diamond', 'slate'];
const VENDOR_FETCH_BATCH_SIZE = 500;
const PLAN_LIMIT_GUIDE = [
  {
    title: 'Daily leads',
    body: 'How many marketplace leads a vendor can unlock each day from the included quota.',
  },
  {
    title: 'Weekly leads',
    body: 'Maximum included lead unlocks allowed in one week. Keep this greater than or equal to daily.',
  },
  {
    title: 'States',
    body: 'How many states the vendor can target from Plan Business Preferences.',
  },
  {
    title: 'Cities',
    body: 'How many selected cities across those states can show the vendor products in search.',
  },
];
const VENDOR_FILTERS = [
  { value: 'all', label: 'All vendors' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'active', label: 'Active' },
];

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
};

const money = (value) => {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('en-IN');
};

const toNonNegativeNumber = (value, fallback = 0) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
};

const exportPaymentsCsv = (payments) => {
  const escape = (v) => {
    const s = String(v ?? '').replace(/"/g, '""');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
  };
  const headers = ['Vendor', 'Email', 'Plan', 'Gross (INR)', 'Net (INR)', 'Coupon', 'Date', 'Transaction ID'];
  const rows = payments.map((p) => [
    escape(p.vendor?.company_name || p.vendor_id || ''),
    escape(p.vendor?.email || ''),
    escape(p.plan?.name || p.plan_id || ''),
    escape(p.amount ?? 0),
    escape(p.net_amount ?? p.amount ?? 0),
    escape(p.coupon_code || ''),
    escape(p.payment_date ? new Date(p.payment_date).toLocaleString() : ''),
    escape(p.transaction_id || ''),
  ]);
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `payments_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const clampDiscountPercent = (value) => {
  const n = toNonNegativeNumber(value, 0);
  return Math.max(0, Math.min(100, n));
};

const computeDiscountedPrice = (originalPrice, discountPercent) => {
  const original = toNonNegativeNumber(originalPrice, 0);
  const percent = clampDiscountPercent(discountPercent);
  if (percent >= 100) return 0;
  return Number(((original * (100 - percent)) / 100).toFixed(2));
};

const showBlankForZero = (value) => {
  if (value === '' || value === null || value === undefined) return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return n === 0 ? '' : value;
};

const makeRegionalPriceDraft = (overrides = {}) => ({
  currency: normalizePlanCurrency(overrides.currency || 'USD'),
  market_codes: String(overrides.market_codes || '').trim(),
  price: Number(overrides.price || 0),
  original_price: Number(overrides.original_price || 0),
  discount_percent: Number(overrides.discount_percent || 0),
  discount_label: String(overrides.discount_label || ''),
  extra_lead_price: Number(overrides.extra_lead_price || 0),
});

const defaultMarketCodesForCurrency = (currency) => {
  const meta = getPlanCurrencyMeta(currency);
  return [...(meta.countryCodes || []), ...(meta.regionCodes || [])].join(', ');
};

const regionalPricesToDrafts = (value) =>
  normalizeRegionalPrices(value).map((row) =>
    makeRegionalPriceDraft({
      ...row,
      market_codes: [...(row.country_codes || []), ...(row.region_codes || [])].join(', '),
    })
  );

const regionalPriceDraftsToPayload = (rows = []) =>
  (rows || [])
    .map((row) => {
      const { countryCodes, regionCodes } = splitPlanMarketCodes(row?.market_codes);
      return {
        currency: normalizePlanCurrency(row?.currency),
        country_codes: countryCodes,
        region_codes: regionCodes,
        price: toNonNegativeNumber(row?.price, 0),
        original_price: toNonNegativeNumber(row?.original_price, 0),
        discount_percent: clampDiscountPercent(row?.discount_percent),
        discount_label: String(row?.discount_label || '').trim(),
        extra_lead_price: toNonNegativeNumber(row?.extra_lead_price, 0),
      };
    })
    .filter((row) => row.currency !== DEFAULT_PLAN_CURRENCY && row.price > 0);

const normalizeRole = (value) => String(value || '').trim().toUpperCase();

const roleToDepartment = (role) => {
  switch (normalizeRole(role)) {
    case 'ADMIN':
      return 'Administration';
    case 'HR':
      return 'Human Resources';
    case 'FINANCE':
      return 'Finance';
    case 'SUPPORT':
      return 'Support';
    case 'SALES':
      return 'Sales';
    case 'DATA_ENTRY':
    case 'DATAENTRY':
      return 'Operations';
    default:
      return '';
  }
};

const getDepartmentLabel = (emp) =>
  emp?.department ||
  emp?.dept ||
  roleToDepartment(emp?.role) ||
  '—';

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

const getPlanPricingMeta = (plan) => {
  const features = asObject(plan?.features);
  const pricing = asObject(features?.pricing);
  const discountPercent = Number(pricing.discount_percent || 0);
  const currentPrice = Number(plan?.price || 0);
  const configuredOriginal = Number(pricing.original_price || 0);
  const configuredExtraLeadPrice = Number(pricing.extra_lead_price || 0);
  const currency = DEFAULT_PLAN_CURRENCY;

  let originalPrice = configuredOriginal;
  if ((!Number.isFinite(originalPrice) || originalPrice <= 0) && discountPercent > 0 && discountPercent < 100) {
    originalPrice = Number(((currentPrice * 100) / (100 - discountPercent)).toFixed(2));
  }
  if (!Number.isFinite(originalPrice) || originalPrice <= currentPrice) originalPrice = 0;

  return {
    original_price: originalPrice,
    discount_percent: Number.isFinite(discountPercent) ? Math.max(0, Math.min(100, discountPercent)) : 0,
    discount_label: String(pricing.discount_label || '').trim(),
    currency,
    regional_prices: regionalPricesToDrafts(pricing.regional_prices || pricing.localized_prices || features.regional_prices),
    extra_lead_price:
      Number.isFinite(configuredExtraLeadPrice) && configuredExtraLeadPrice >= 0
        ? configuredExtraLeadPrice
        : 0,
    badge_label: String(asObject(features?.badge)?.label || '').trim(),
    badge_variant: String(asObject(features?.badge)?.variant || 'neutral').trim() || 'neutral',
  };
};

const getPlanCoverageMeta = (plan) => {
  const features = asObject(plan?.features);
  const coverage = asObject(features?.coverage);
  const rawStates = coverage.states_limit ?? features.states_limit;
  const rawCities = coverage.cities_limit ?? features.cities_limit;

  const states = Number(rawStates);
  const cities = Number(rawCities);

  return {
    states_limit: Number.isFinite(states) && states >= 0 ? Math.floor(states) : 0,
    cities_limit: Number.isFinite(cities) && cities >= 0 ? Math.floor(cities) : 0,
  };
};

const featureBool = (value, fallback = false) => {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  const token = String(value ?? '').trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'on'].includes(token)) return true;
  if (['false', '0', 'no', 'n', 'off'].includes(token)) return false;
  return fallback;
};

const getVendorCreatedDate = (vendor) => {
  const date = new Date(vendor?.created_at || vendor?.createdAt || vendor?.created || '');
  return Number.isNaN(date.getTime()) ? null : date;
};

const getLocalDayStart = (date = new Date()) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const getRollingWeekStart = (date = new Date()) => {
  const start = getLocalDayStart(date);
  start.setDate(start.getDate() - 6);
  return start;
};

const getMonthStart = (date = new Date()) => new Date(date.getFullYear(), date.getMonth(), 1);

const vendorCreatedSince = (vendor, since) => {
  const created = getVendorCreatedDate(vendor);
  return Boolean(created && created >= since);
};

const isVendorActive = (vendor) => {
  const status = String(vendor?.status || vendor?.account_status || '').trim().toUpperCase();
  if (['INACTIVE', 'SUSPENDED', 'DELETED', 'DISABLED'].includes(status)) return false;
  return featureBool(vendor?.is_active, true);
};

const normalizeSystemConfig = (config = {}, fallback = {}) => ({
  ...fallback,
  ...config,
  maintenance_mode: featureBool(config?.maintenance_mode, false),
  maintenance_message: config?.maintenance_message || '',
  public_notice_enabled: featureBool(config?.public_notice_enabled, false),
  public_notice_message: config?.public_notice_message || '',
  public_notice_variant: config?.public_notice_variant || fallback?.public_notice_variant || 'info',
});

const normalizePageControl = (page = {}) => ({
  ...page,
  is_blanked: featureBool(page?.is_blanked, false),
  error_message: page?.error_message || '',
});

const normalizePurchaseChannel = (value, salesAssisted = false) => {
  const token = String(value || '').trim().toUpperCase().replace(/[^A-Z_]/g, '_');
  if (['SALES', 'SALES_ASSISTED', 'ASSISTED', 'MANUAL'].includes(token) || salesAssisted) {
    return 'SALES_ASSISTED';
  }
  return 'DIRECT';
};

const getPlanBenefitMeta = (plan) => {
  const features = asObject(plan?.features);
  const purchase = asObject(features.purchase);
  const listing = asObject(features.listing);
  const verification = asObject(features.verification);
  const leads = asObject(features.leads);
  const support = asObject(features.support);
  const analytics = asObject(features.analytics);
  const portfolio = asObject(features.portfolio);
  const certificate = asObject(features.certificate);
  const seo = asObject(features.seo);
  const salesAssisted = featureBool(purchase.sales_assisted, false);
  const purchaseChannel = normalizePurchaseChannel(purchase.channel, salesAssisted);

  return {
    purchase_channel: purchaseChannel,
    public_purchase_enabled:
      purchaseChannel === 'SALES_ASSISTED' ? false : featureBool(purchase.public_purchase_enabled, true),
    sales_cta_label: String(purchase.cta_label || (purchaseChannel === 'SALES_ASSISTED' ? 'Talk to sales' : 'Buy online')).trim(),
    listing_ranking_label: String(listing.ranking_label || '').trim(),
    listing_top_slots: Number(listing.top_slots || 0),
    listing_highlight: featureBool(listing.highlight, false),
    listing_featured: featureBool(listing.featured, false),
    listing_category_top_ranking: featureBool(listing.category_top_ranking, false),
    listing_verified_tick: featureBool(listing.profile_verified_tick, false),
    listing_trust_seal: featureBool(verification.trust_seal, featureBool(listing.trust_seal, false)),
    leads_priority: featureBool(leads.priority_leads, false),
    leads_early_access: featureBool(leads.early_access_leads, false),
    leads_rfq_access: featureBool(leads.rfq_access, true),
    leads_direct_call_whatsapp: featureBool(leads.direct_call_whatsapp, false),
    support_level: String(support.level || 'standard').trim().toLowerCase(),
    support_sla_hours: Number(support.response_sla_hours || 0),
    analytics_enabled: featureBool(analytics.enabled, false),
    analytics_export_csv: featureBool(analytics.export_csv, false),
    portfolio_template: String(portfolio.template || 'STANDARD').trim().toUpperCase() === 'PREMIUM' ? 'PREMIUM' : 'STANDARD',
    portfolio_customizable: featureBool(portfolio.customizable, false),
    custom_url_enabled: featureBool(portfolio.custom_url, false),
    portfolio_custom_sections: featureBool(portfolio.custom_sections, false),
    sitemap_customization: featureBool(portfolio.sitemap_customization, false),
    sitemap_url_boost: Number(portfolio.sitemap_url_boost || 0),
    certificate_enabled: featureBool(certificate.enabled, false),
    certificate_tier: String(certificate.tier || '').trim().toUpperCase(),
    certificate_title: String(certificate.title || '').trim(),
    certificate_label: String(certificate.label || '').trim(),
    seo_enabled: featureBool(seo.enabled, false),
    seo_url_aliases: Number(seo.url_aliases || 0),
    seo_city_category_pages: Number(seo.city_category_pages || 0),
  };
};

const planToDraft = (plan) => {
  const pricing = getPlanPricingMeta(plan);
  const coverage = getPlanCoverageMeta(plan);
  const benefits = getPlanBenefitMeta(plan);
  return {
    name: String(plan?.name || ''),
    description: String(plan?.description || ''),
    price: Number(plan?.price || 0),
    daily_limit: Number(plan?.daily_limit || 0),
    weekly_limit: Number(plan?.weekly_limit || 0),
    yearly_limit: Number(plan?.yearly_limit || 0),
    duration_days: Number(plan?.duration_days || 365),
    is_active: featureBool(plan?.is_active, true),
    original_price: Number(pricing.original_price || 0),
    discount_percent: Number(pricing.discount_percent || 0),
    discount_label: pricing.discount_label,
    currency: pricing.currency,
    regional_prices: pricing.regional_prices,
    extra_lead_price: Number(pricing.extra_lead_price || 0),
    badge_label: pricing.badge_label,
    badge_variant: pricing.badge_variant,
    states_limit: Number(coverage.states_limit || 0),
    cities_limit: Number(coverage.cities_limit || 0),
    ...benefits,
  };
};

const SuperAdminBuyerAccessPanel = ({ title = 'Buyer Dashboard Access' }) => {
  const [query, setQuery] = useState('');
  const [buyers, setBuyers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState('');

  const loadBuyers = async (nextQuery = query) => {
    setLoading(true);
    try {
      const data = await superAdminServerApi.impersonation.targets({
        target_type: 'BUYER',
        query: nextQuery,
        limit: 20,
      });
      setBuyers(data?.targets || []);
    } catch (error) {
      toast({
        title: 'Buyer search failed',
        description: error?.message || 'Could not load buyers for assisted access.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBuyers('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openBuyerDashboard = async (buyer) => {
    if (!buyer?.id || busyId) return;
    const tab = typeof window !== 'undefined' ? window.open('about:blank', '_blank') : null;
    setBusyId(buyer.id);
    try {
      const data = await superAdminServerApi.impersonation.start({
        target_type: 'BUYER',
        target_id: buyer.id,
      });
      const next = data?.next || '/buyer/dashboard';
      if (tab) {
        tab.location.href = next;
      } else if (typeof window !== 'undefined') {
        window.location.href = next;
      }
      toast({
        title: 'Buyer dashboard opened',
        description: `Assisted access started for ${buyer.name || buyer.email || 'buyer'}.`,
      });
    } catch (error) {
      if (tab) tab.close();
      toast({
        title: 'Could not open buyer dashboard',
        description: error?.message || 'Assisted access failed.',
        variant: 'destructive',
      });
    } finally {
      setBusyId('');
    }
  };

  return (
    <Card className="bg-neutral-900 border-neutral-800">
      <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <CardTitle className="text-white flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-300" />
            {title}
          </CardTitle>
          <CardDescription className="text-neutral-400">
            Search buyers and open their dashboard with audited Super Admin assisted access.
          </CardDescription>
        </div>
        <Button
          variant="outline"
          className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
          onClick={() => loadBuyers(query)}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') loadBuyers(query);
              }}
              className="bg-neutral-950 border-neutral-800 pl-9 text-white placeholder:text-neutral-500"
              placeholder="Search buyer name, company, email, phone, city, state..."
            />
          </div>
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => loadBuyers(query)} disabled={loading}>
            <Search className="h-4 w-4 mr-2" />
            Search
          </Button>
        </div>

        <div className="overflow-hidden rounded-lg border border-neutral-800">
          <Table>
            <TableHeader>
              <TableRow className="border-neutral-800">
                <TableHead className="text-neutral-400">Buyer</TableHead>
                <TableHead className="text-neutral-400">Contact</TableHead>
                <TableHead className="text-neutral-400">Region</TableHead>
                <TableHead className="text-neutral-400">Status</TableHead>
                <TableHead className="text-neutral-400">Updated</TableHead>
                <TableHead className="text-right text-neutral-400">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow className="border-neutral-800">
                  <TableCell colSpan={6} className="py-8 text-center text-neutral-400">
                    Loading buyers...
                  </TableCell>
                </TableRow>
              ) : buyers.length ? (
                buyers.map((buyer) => (
                  <TableRow key={buyer.id} className="border-neutral-800">
                    <TableCell>
                      <div className="text-white font-medium">{buyer.name || 'Unnamed buyer'}</div>
                      <div className="text-xs text-neutral-500">{buyer.company_name || buyer.id}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-neutral-200">{buyer.email || '-'}</div>
                      <div className="text-xs text-neutral-500">{buyer.phone || '-'}</div>
                    </TableCell>
                    <TableCell className="text-neutral-300">
                      {[buyer.city, buyer.state].filter(Boolean).join(', ') || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge className={buyer.is_active ? 'bg-emerald-950 text-emerald-200' : 'bg-amber-950 text-amber-200'}>
                        {buyer.status_label || (buyer.is_active ? 'ACTIVE' : 'INACTIVE')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-neutral-400">
                      {formatDateTime(buyer.updated_at || buyer.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        className="bg-emerald-700 hover:bg-emerald-600"
                        disabled={busyId === buyer.id}
                        onClick={() => openBuyerDashboard(buyer)}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        {busyId === buyer.id ? 'Opening...' : 'Open Buyer Dashboard'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow className="border-neutral-800">
                  <TableCell colSpan={6} className="py-8 text-center text-neutral-400">
                    No buyers found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default function SuperAdminDashboard() {
  const { superAdmin, logout, changePassword, isGodMode, isSuperAdmin } = useSuperAdmin();

  // GOD MODE superadmins management state
  const [superadminsList, setSuperadminsList] = useState([]);
  const [superadminsLoading, setSuperadminsLoading] = useState(false);
  const [superadminForm, setSuperadminForm] = useState({ email: '', password: '', full_name: '' });
  const [superadminSaving, setSuperadminSaving] = useState(false);
  const [superadminModalOpen, setSuperadminModalOpen] = useState(false);

  // System + pages
  const [systemConfig, setSystemConfig] = useState({
    maintenance_mode: false,
    maintenance_message: '',
    public_notice_enabled: false,
    public_notice_message: '',
    public_notice_variant: 'info',
  });
  const [systemLoading, setSystemLoading] = useState(false);
  const [systemSaving, setSystemSaving] = useState(false);

  const [pages, setPages] = useState([]);
  const [pagesLoading, setPagesLoading] = useState(false);
  const [pageBusyId, setPageBusyId] = useState(null);
  const [newPage, setNewPage] = useState({ page_name: '', page_route: '', error_message: '' });
  const [newPageSaving, setNewPageSaving] = useState(false);

  // Employees
  const [employees, setEmployees] = useState([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [employeeSaving, setEmployeeSaving] = useState(false);
  const [employeeDeletingId, setEmployeeDeletingId] = useState(null);
  const [availableStates, setAvailableStates] = useState([]);
  const [employeeForm, setEmployeeForm] = useState({
    full_name: '',
    email: '',
    password: '',
    phone: '',
    role: 'ADMIN',
    department: 'Administration',
    status: 'ACTIVE',
    state_scope_ids: [],
  });

  // Vendors
  const [vendors, setVendors] = useState([]);
  const [vendorsLoading, setVendorsLoading] = useState(false);
  const [vendorSearch, setVendorSearch] = useState('');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [vendorDeletingId, setVendorDeletingId] = useState(null);

  // Plans
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [planSavingId, setPlanSavingId] = useState(null);
  const [planDeletingId, setPlanDeletingId] = useState(null);
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [planEditorOpen, setPlanEditorOpen] = useState(false);
  const [planSearch, setPlanSearch] = useState('');
  const [planDrafts, setPlanDrafts] = useState({});
  const [planCreateOpen, setPlanCreateOpen] = useState(false);
  const [planCreating, setPlanCreating] = useState(false);
  const [savingAllPlans, setSavingAllPlans] = useState(false);
  const [planSelectionMode, setPlanSelectionMode] = useState(false);
  const [selectedPlanIds, setSelectedPlanIds] = useState([]);
  const [deletingSelectedPlans, setDeletingSelectedPlans] = useState(false);
  const [newPlanForm, setNewPlanForm] = useState({
    name: '',
    description: '',
    price: 0,
    daily_limit: 0,
    weekly_limit: 0,
    yearly_limit: 0,
    duration_days: 365,
    is_active: true,
    original_price: 0,
    discount_percent: 0,
    discount_label: '',
    currency: DEFAULT_PLAN_CURRENCY,
    regional_prices: [],
    extra_lead_price: 0,
    badge_label: '',
    badge_variant: 'neutral',
    states_limit: 0,
    cities_limit: 0,
    purchase_channel: 'DIRECT',
    public_purchase_enabled: true,
    sales_cta_label: 'Buy online',
    listing_ranking_label: '',
    listing_top_slots: 0,
    listing_highlight: false,
    listing_featured: false,
    listing_category_top_ranking: false,
    listing_verified_tick: false,
    listing_trust_seal: false,
    leads_priority: false,
    leads_early_access: false,
    leads_rfq_access: true,
    leads_direct_call_whatsapp: false,
    support_level: 'standard',
    support_sla_hours: 0,
    analytics_enabled: false,
    analytics_export_csv: false,
    portfolio_template: 'STANDARD',
    portfolio_customizable: false,
    custom_url_enabled: false,
    portfolio_custom_sections: false,
    sitemap_customization: false,
    sitemap_url_boost: 0,
    certificate_enabled: false,
    certificate_tier: '',
    certificate_title: '',
    certificate_label: '',
    seo_enabled: false,
    seo_url_aliases: 0,
    seo_city_category_pages: 0,
  });

  // Finance
  const [financeSummary, setFinanceSummary] = useState({ totalGross: 0, totalNet: 0, last30: 0 });
  const [financePayments, setFinancePayments] = useState([]);
  const [financeLoading, setFinanceLoading] = useState(false);

  // Audit
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditFilters, setAuditFilters] = useState({
    hoursBack: 168,
    limit: 300,
    actor_type: 'ALL',
    action_contains: '',
  });

  // Monitoring
  const [monitoringOverview, setMonitoringOverview] = useState(null);
  const [monitoringActivity, setMonitoringActivity] = useState(null);
  const [monitoringRevenue, setMonitoringRevenue] = useState([]);
  const [monitoringLoading, setMonitoringLoading] = useState(false);
  const [visitorActivity, setVisitorActivity] = useState({ stats: {}, events: [] });
  const [visitorActivityLoading, setVisitorActivityLoading] = useState(false);
  const [monitoringActivityDays, setMonitoringActivityDays] = useState(7);
  const [behavioralIntel, setBehavioralIntel] = useState(null);
  const [behavioralIntelLoading, setBehavioralIntelLoading] = useState(false);
  const [behavioralIntelDays, setBehavioralIntelDays] = useState(30);
  const [statesScopeModalOpen, setStatesScopeModalOpen] = useState(false);
  const [statesScopeTarget, setStatesScopeTarget] = useState(null);
  const [statesScopeSelection, setStatesScopeSelection] = useState([]);
  const [statesScopeSaving, setStatesScopeSaving] = useState(false);

  // Settings
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('system');

  const handleError = (error, fallback) => {
    toast({
      title: 'Error',
      description: error?.message || fallback || 'Something went wrong',
      variant: 'destructive',
    });
  };

  const stateById = useMemo(
    () => new Map((availableStates || []).map((state) => [String(state.id), state])),
    [availableStates]
  );

  const statesByRegion = useMemo(() => {
    const grouped = new Map();

    (availableStates || []).forEach((state) => {
      const regionKey = state.region_name || 'Unassigned';
      if (!grouped.has(regionKey)) grouped.set(regionKey, []);
      grouped.get(regionKey).push(state);
    });

    return Array.from(grouped.entries())
      .map(([region, states]) => ({
        region,
        states: [...states].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
      }))
      .sort((a, b) => a.region.localeCompare(b.region));
  }, [availableStates]);

  const describeSelectedStates = (ids = []) => {
    const names = [...new Set((ids || []).map((id) => stateById.get(String(id))?.name).filter(Boolean))];
    return names.length ? names.join(', ') : 'All India access';
  };

  const toggleStateSelection = (currentIds, stateId) => {
    const nextId = String(stateId);
    const normalized = (currentIds || []).map((id) => String(id));
    return normalized.includes(nextId)
      ? normalized.filter((id) => id !== nextId)
      : [...normalized, nextId];
  };

  const renderStateScopeSelector = ({
    selectedIds = [],
    onChange,
    helperText = 'Leave blank for All India access.',
  }) => {
    const normalizedIds = [...new Set((selectedIds || []).map((id) => String(id)))];

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-neutral-500 text-xs">{helperText}</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-neutral-400 hover:text-white hover:bg-neutral-800"
            onClick={() => onChange([])}
            disabled={!normalizedIds.length}
          >
            Clear selection
          </Button>
        </div>
        <div className="max-h-72 overflow-y-auto rounded-lg border border-neutral-800 bg-neutral-950/40 p-3 space-y-3">
          {!statesByRegion.length ? (
            <div className="text-neutral-500 text-sm">No states available from DB.</div>
          ) : (
            statesByRegion.map(({ region, states }) => (
              <div key={region} className="space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                  {region}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {states.map((state) => {
                    const checked = normalizedIds.includes(String(state.id));
                    return (
                      <label
                        key={state.id}
                        className={`flex items-center gap-3 rounded-md border px-3 py-2 cursor-pointer transition-colors ${
                          checked
                            ? 'border-blue-600/70 bg-blue-950/30 text-white'
                            : 'border-neutral-800 bg-neutral-900/70 text-neutral-300 hover:border-neutral-700'
                        }`}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(nextChecked) => {
                            const nextIds = nextChecked === true
                              ? toggleStateSelection(normalizedIds.filter((id) => id !== String(state.id)), state.id)
                              : normalizedIds.filter((id) => id !== String(state.id));
                            onChange(nextIds);
                          }}
                          className="border-neutral-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                        />
                        <span className="text-sm">{state.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
        <p className="text-neutral-500 text-xs">
          Selected: <span className="text-neutral-300">{describeSelectedStates(normalizedIds)}</span>
        </p>
      </div>
    );
  };

  const fetchStates = async () => {
    try {
      const response = await superAdminServerApi.states.list();
      setAvailableStates(Array.isArray(response?.states) ? response.states : []);
    } catch (error) {
      handleError(error, 'Failed to load states');
    }
  };

  const fetchSystemConfig = async () => {
    setSystemLoading(true);
    try {
      const { config } = await superAdminServerApi.system.getConfig();
      if (config) {
        setSystemConfig((prev) => normalizeSystemConfig(config, prev));
      }
    } catch (error) {
      handleError(error, 'Failed to load system config');
    } finally {
      setSystemLoading(false);
    }
  };

  const fetchPages = async () => {
    setPagesLoading(true);
    try {
      const { pages: pageList } = await superAdminServerApi.pages.list();
      setPages((pageList || []).map(normalizePageControl));
    } catch (error) {
      handleError(error, 'Failed to load page controls');
    } finally {
      setPagesLoading(false);
    }
  };

  const fetchEmployees = async () => {
    setEmployeesLoading(true);
    try {
      const { employees: list } = await superAdminServerApi.employees.list();
      setEmployees(list || []);
    } catch (error) {
      handleError(error, 'Failed to load employees');
    } finally {
      setEmployeesLoading(false);
    }
  };

  const fetchVendors = async () => {
    setVendorsLoading(true);
    try {
      const allVendors = [];
      let offset = 0;
      let expectedTotal = null;

      while (true) {
        const response = await superAdminServerApi.vendors.list({
          limit: VENDOR_FETCH_BATCH_SIZE,
          offset,
        });
        const batch = Array.isArray(response?.vendors) ? response.vendors : [];
        if (expectedTotal == null && Number.isFinite(Number(response?.total))) {
          expectedTotal = Number(response.total);
        }

        allVendors.push(...batch);

        if (batch.length < VENDOR_FETCH_BATCH_SIZE) break;
        if (expectedTotal != null && allVendors.length >= expectedTotal) break;

        offset += VENDOR_FETCH_BATCH_SIZE;
      }

      const uniqueVendors = Array.from(
        new Map(allVendors.map((vendor) => [vendor?.id || `${vendor?.vendor_id || ''}-${vendor?.email || ''}`, vendor])).values()
      );
      setVendors(uniqueVendors);
    } catch (error) {
      handleError(error, 'Failed to load vendors');
    } finally {
      setVendorsLoading(false);
    }
  };

  const fetchPlans = async () => {
    setPlansLoading(true);
    try {
      const { plans: list } = await superAdminServerApi.plans.list({
        include_inactive: false,
        limit: 500,
      });
      const next = list || [];
      setPlans(next);
      setPlanDrafts(
        next.reduce((acc, plan) => {
          if (plan?.id) acc[plan.id] = planToDraft(plan);
          return acc;
        }, {})
      );
      setSelectedPlanIds((prev) =>
        (prev || []).filter((id) => next.some((plan) => plan?.id === id))
      );
    } catch (error) {
      handleError(error, 'Failed to load subscription plans');
    } finally {
      setPlansLoading(false);
    }
  };

  const fetchFinance = async () => {
    setFinanceLoading(true);
    try {
      const [{ data: summary }, { data: payments }] = await Promise.all([
        superAdminServerApi.finance.summary(),
        superAdminServerApi.finance.payments({ limit: 400 }),
      ]);
      setFinanceSummary(summary || { totalGross: 0, totalNet: 0, last30: 0 });
      setFinancePayments(payments || []);
    } catch (error) {
      handleError(error, 'Failed to load finance data');
    } finally {
      setFinanceLoading(false);
    }
  };

  const fetchAuditLogs = async (overrides = {}) => {
    setAuditLoading(true);
    try {
      const merged = { ...auditFilters, ...overrides };
      const params = {
        hoursBack: merged.hoursBack,
        limit: merged.limit,
        action_contains: merged.action_contains || undefined,
        actor_type: merged.actor_type === 'ALL' ? undefined : merged.actor_type,
      };
      const { logs } = await superAdminServerApi.audit.list(params);
      setAuditLogs(logs || []);
    } catch (error) {
      handleError(error, 'Failed to load audit logs');
    } finally {
      setAuditLoading(false);
    }
  };

  const fetchSuperadmins = async () => {
    if (!isGodMode) return;
    setSuperadminsLoading(true);
    try {
      const data = await superAdminServerApi.godmode.listSuperadmins();
      setSuperadminsList(data?.superadmins || []);
    } catch (err) {
      toast({ title: 'Error', description: err?.message || 'Failed to load superadmins', variant: 'destructive' });
    } finally {
      setSuperadminsLoading(false);
    }
  };

  const openSuperadminModal = () => {
    if (!isGodMode) return;
    setSuperadminForm({ email: '', password: '', full_name: '' });
    setSuperadminModalOpen(true);
  };

  const fetchMonitoring = async (days = monitoringActivityDays) => {
    setMonitoringLoading(true);
    setVisitorActivityLoading(true);
    try {
      const [overviewRes, activityRes, revenueRes, visitorRes] = await Promise.all([
        superAdminServerApi.monitoring.overview(),
        superAdminServerApi.monitoring.adminActivity(days),
        superAdminServerApi.monitoring.revenueByState(),
        superAdminServerApi.monitoring.visitorActivity({ days, limit: isGodMode ? 50 : 30 }),
      ]);
      setMonitoringOverview(overviewRes?.data || null);
      setMonitoringActivity(activityRes?.data || null);
      setMonitoringRevenue(revenueRes?.data || []);
      setVisitorActivity({
        stats: visitorRes?.stats || {},
        events: visitorRes?.events || [],
      });
    } catch (err) {
      handleError(err, 'Failed to load monitoring data');
    } finally {
      setMonitoringLoading(false);
      setVisitorActivityLoading(false);
    }
  };

  const fetchVisitorActivity = async (days = monitoringActivityDays) => {
    setVisitorActivityLoading(true);
    try {
      const visitorRes = await superAdminServerApi.monitoring.visitorActivity({ days, limit: isGodMode ? 50 : 30 });
      setVisitorActivity({
        stats: visitorRes?.stats || {},
        events: visitorRes?.events || [],
      });
    } catch (err) {
      handleError(err, 'Failed to load visitor activity');
    } finally {
      setVisitorActivityLoading(false);
    }
  };

  const fetchBehavioralIntel = async ({ days = behavioralIntelDays, refresh = false } = {}) => {
    setBehavioralIntelLoading(true);
    try {
      const response = await superAdminServerApi.intelligence.behavioral({
        days,
        limit: 60,
        refresh,
      });
      setBehavioralIntel(response?.data || null);
      setBehavioralIntelDays(days);
    } catch (err) {
      handleError(err, 'Failed to load behavioral commerce intelligence');
    } finally {
      setBehavioralIntelLoading(false);
    }
  };

  const saveStatesScope = async () => {
    if (!statesScopeTarget) return;
    setStatesScopeSaving(true);
    try {
      await superAdminServerApi.monitoring.updateStatesScope(statesScopeTarget.id, statesScopeSelection);
      toast({ title: 'Saved', description: `States scope updated for ${statesScopeTarget.full_name}` });
      setStatesScopeModalOpen(false);
      setStatesScopeTarget(null);
      setStatesScopeSelection([]);
      await fetchMonitoring();
      await fetchEmployees();
    } catch (err) {
      handleError(err, 'Failed to update states scope');
    } finally {
      setStatesScopeSaving(false);
    }
  };

  useEffect(() => {
    void Promise.all([
      fetchStates(),
      fetchSystemConfig(),
      fetchPages(),
      fetchEmployees(),
      fetchVendors(),
      fetchPlans(),
      fetchFinance(),
      fetchAuditLogs(),
      fetchSuperadmins(),
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredEmployees = useMemo(() => {
    if (!employeeSearch.trim()) return employees;
    return filterRecordsBySearch(employees, employeeSearch, {
      exactIdKeys: ['id', 'user_id'],
      exactEmailKeys: ['email'],
      broadKeys: ['id', 'user_id', 'full_name', 'email', 'role', 'department'],
    });
  }, [employees, employeeSearch]);

  const searchedVendors = useMemo(() => {
    if (!vendorSearch.trim()) return vendors;
    return filterRecordsBySearch(vendors, vendorSearch, {
      exactIdKeys: ['id', 'vendor_id'],
      exactEmailKeys: ['email'],
      broadKeys: ['id', 'vendor_id', 'company_name', 'owner_name', 'email', 'city', 'state'],
    });
  }, [vendors, vendorSearch]);

  const vendorMetrics = useMemo(() => {
    const now = new Date();
    const todayStart = getLocalDayStart(now);
    const weekStart = getRollingWeekStart(now);
    const monthStart = getMonthStart(now);

    return vendors.reduce(
      (acc, vendor) => {
        acc.total += 1;
        if (isVendorActive(vendor)) acc.active += 1;
        if (vendorCreatedSince(vendor, todayStart)) acc.today += 1;
        if (vendorCreatedSince(vendor, weekStart)) acc.week += 1;
        if (vendorCreatedSince(vendor, monthStart)) acc.month += 1;
        return acc;
      },
      { total: 0, active: 0, today: 0, week: 0, month: 0 }
    );
  }, [vendors]);

  const filteredVendors = useMemo(() => {
    const now = new Date();
    const todayStart = getLocalDayStart(now);
    const weekStart = getRollingWeekStart(now);
    const monthStart = getMonthStart(now);

    if (vendorFilter === 'today') return searchedVendors.filter((vendor) => vendorCreatedSince(vendor, todayStart));
    if (vendorFilter === 'week') return searchedVendors.filter((vendor) => vendorCreatedSince(vendor, weekStart));
    if (vendorFilter === 'month') return searchedVendors.filter((vendor) => vendorCreatedSince(vendor, monthStart));
    if (vendorFilter === 'active') return searchedVendors.filter(isVendorActive);
    return searchedVendors;
  }, [searchedVendors, vendorFilter]);

  const filteredPlans = useMemo(() => {
    const term = planSearch.trim().toLowerCase();
    if (!term) return plans;
    return (plans || []).filter((plan) =>
      [plan?.name, plan?.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [plans, planSearch]);

  const selectedPlan = useMemo(() => {
    if (!filteredPlans.length) return null;
    return filteredPlans.find((plan) => plan?.id === selectedPlanId) || filteredPlans[0];
  }, [filteredPlans, selectedPlanId]);

  useEffect(() => {
    if (!filteredPlans.length) {
      if (selectedPlanId) setSelectedPlanId(null);
      return;
    }
    if (!selectedPlanId || !filteredPlans.some((plan) => plan?.id === selectedPlanId)) {
      setSelectedPlanId(filteredPlans[0]?.id || null);
    }
  }, [filteredPlans, selectedPlanId]);

  const draftToPayload = (draft) => {
    const purchaseChannel = normalizePurchaseChannel(draft?.purchase_channel, draft?.sales_assisted === true);
    const certificateTier = String(draft?.certificate_tier || '').trim().toUpperCase();
    const certificateLabel = String(draft?.certificate_label || certificateTier || '').trim();
    const features = {
      purchase: {
        channel: purchaseChannel,
        sales_assisted: purchaseChannel === 'SALES_ASSISTED',
        public_purchase_enabled:
          purchaseChannel === 'SALES_ASSISTED' ? false : draft?.public_purchase_enabled !== false,
        cta_label: String(draft?.sales_cta_label || (purchaseChannel === 'SALES_ASSISTED' ? 'Talk to sales' : 'Buy online')).trim(),
      },
      badge: {
        label: String(draft?.badge_label || '').trim(),
        variant: String(draft?.badge_variant || 'neutral').trim() || 'neutral',
      },
      listing: {
        ranking_label: String(draft?.listing_ranking_label || '').trim(),
        highlight: draft?.listing_highlight === true,
        featured: draft?.listing_featured === true,
        category_top_ranking: draft?.listing_category_top_ranking === true,
        profile_verified_tick: draft?.listing_verified_tick === true,
        trust_seal: draft?.listing_trust_seal === true,
        top_slots: Number(draft?.listing_top_slots || 0),
      },
      verification: {
        kyc_required: draft?.listing_trust_seal === true || draft?.certificate_enabled === true,
        trust_seal: draft?.listing_trust_seal === true,
      },
      leads: {
        priority_leads: draft?.leads_priority === true,
        early_access_leads: draft?.leads_early_access === true,
        rfq_access: draft?.leads_rfq_access !== false,
        direct_call_whatsapp: draft?.leads_direct_call_whatsapp === true,
      },
      support: {
        level: String(draft?.support_level || 'standard').trim().toLowerCase(),
        response_sla_hours: Number(draft?.support_sla_hours || 0),
      },
      analytics: {
        enabled: draft?.analytics_enabled === true,
        export_csv: draft?.analytics_export_csv === true,
      },
      coverage: {
        states_limit: Number(draft?.states_limit || 0),
        cities_limit: Number(draft?.cities_limit || 0),
      },
      pricing: {
        currency: DEFAULT_PLAN_CURRENCY,
        original_price: Number(draft?.original_price || 0),
        discount_percent: Number(draft?.discount_percent || 0),
        discount_label: String(draft?.discount_label || '').trim(),
        regional_prices: regionalPriceDraftsToPayload(draft?.regional_prices),
        extra_lead_price: Number(draft?.extra_lead_price || 0),
      },
      portfolio: {
        enabled: true,
        template: String(draft?.portfolio_template || 'STANDARD').trim().toUpperCase() === 'PREMIUM' ? 'PREMIUM' : 'STANDARD',
        customizable: draft?.portfolio_customizable === true,
        custom_url: draft?.custom_url_enabled === true,
        custom_sections: draft?.portfolio_custom_sections === true,
        sitemap_customization: draft?.sitemap_customization === true,
        sitemap_url_boost: Number(draft?.sitemap_url_boost || 0),
      },
      certificate: {
        enabled: draft?.certificate_enabled === true,
        tier: certificateTier,
        title: String(draft?.certificate_title || '').trim(),
        label: certificateLabel,
      },
      seo: {
        enabled: draft?.seo_enabled === true,
        sitemap: draft?.seo_enabled === true,
        portfolio_schema: draft?.seo_enabled === true,
        url_aliases: Number(draft?.seo_url_aliases || 0),
        city_category_pages: Number(draft?.seo_city_category_pages || 0),
      },
    };

    return {
      name: String(draft?.name || '').trim(),
      description: String(draft?.description || '').trim(),
      price: Number(draft?.price || 0),
      daily_limit: Number(draft?.daily_limit || 0),
      weekly_limit: Number(draft?.weekly_limit || 0),
      yearly_limit: Number(draft?.yearly_limit || 0),
      duration_days: Number(draft?.duration_days || 365),
      is_active: draft?.is_active === true,
      original_price: Number(draft?.original_price || 0),
      discount_percent: Number(draft?.discount_percent || 0),
      discount_label: String(draft?.discount_label || '').trim(),
      currency: DEFAULT_PLAN_CURRENCY,
      regional_prices: regionalPriceDraftsToPayload(draft?.regional_prices),
      extra_lead_price: Number(draft?.extra_lead_price || 0),
      badge_label: features.badge.label,
      badge_variant: features.badge.variant,
      states_limit: features.coverage.states_limit,
      cities_limit: features.coverage.cities_limit,
      features,
    };
  };

  const dirtyPlanIds = useMemo(() => {
    const changed = [];
    (plans || []).forEach((plan) => {
      if (!plan?.id) return;
      const originalPayload = draftToPayload(planToDraft(plan));
      const currentDraft = planDrafts?.[plan.id] || planToDraft(plan);
      const currentPayload = draftToPayload(currentDraft);
      if (JSON.stringify(currentPayload) !== JSON.stringify(originalPayload)) {
        changed.push(plan.id);
      }
    });
    return changed;
  }, [plans, planDrafts]);

  const updatePlanDraft = (planId, key, value) => {
    if (!planId) return;
    setPlanDrafts((prev) => ({
      ...prev,
      [planId]: {
        ...(prev?.[planId] || {}),
        [key]: value,
      },
    }));
  };

  const updatePlanPricingDraft = (planId, key, value) => {
    if (!planId) return;
    setPlanDrafts((prev) => {
      const existing = { ...(prev?.[planId] || {}) };
      const next = { ...existing, [key]: value };

      if (key === 'price' || key === 'original_price') {
        next[key] = toNonNegativeNumber(value, 0);
      }
      if (key === 'discount_percent') {
        next.discount_percent = clampDiscountPercent(value);
      }

      if (key === 'discount_percent' || key === 'original_price') {
        const discountPercent = clampDiscountPercent(next.discount_percent);
        let originalPrice = toNonNegativeNumber(next.original_price, 0);

        if (originalPrice <= 0 && discountPercent > 0) {
          const currentPrice = toNonNegativeNumber(next.price, 0);
          if (currentPrice > 0) {
            originalPrice = currentPrice;
            next.original_price = currentPrice;
          }
        }

        if (originalPrice > 0) {
          next.price = computeDiscountedPrice(originalPrice, discountPercent);
        }
      }

      return {
        ...prev,
        [planId]: next,
      };
    });
  };

  const updateNewPlanPricing = (key, value) => {
    setNewPlanForm((prev) => {
      const next = { ...prev, [key]: value };

      if (key === 'price' || key === 'original_price') {
        next[key] = toNonNegativeNumber(value, 0);
      }
      if (key === 'discount_percent') {
        next.discount_percent = clampDiscountPercent(value);
      }

      if (key === 'discount_percent' || key === 'original_price') {
        const discountPercent = clampDiscountPercent(next.discount_percent);
        let originalPrice = toNonNegativeNumber(next.original_price, 0);

        if (originalPrice <= 0 && discountPercent > 0) {
          const currentPrice = toNonNegativeNumber(next.price, 0);
          if (currentPrice > 0) {
            originalPrice = currentPrice;
            next.original_price = currentPrice;
          }
        }

        if (originalPrice > 0) {
          next.price = computeDiscountedPrice(originalPrice, discountPercent);
        }
      }

      return next;
    });
  };

  const updateRegionalPriceRows = (rows, rowIndex, key, value) => {
    const nextRows = [...(rows || [])];
    const current = makeRegionalPriceDraft(nextRows[rowIndex] || {});
    const next = { ...current, [key]: value };

    if (key === 'currency') {
      next.currency = normalizePlanCurrency(value);
      if (!String(next.market_codes || '').trim()) {
        next.market_codes = defaultMarketCodesForCurrency(next.currency);
      }
    }
    if (key === 'price' || key === 'original_price' || key === 'extra_lead_price') {
      next[key] = toNonNegativeNumber(value, 0);
    }
    if (key === 'discount_percent') {
      next.discount_percent = clampDiscountPercent(value);
    }

    if (key === 'discount_percent' || key === 'original_price') {
      const discountPercent = clampDiscountPercent(next.discount_percent);
      let originalPrice = toNonNegativeNumber(next.original_price, 0);
      if (originalPrice <= 0 && discountPercent > 0) {
        const currentPrice = toNonNegativeNumber(next.price, 0);
        if (currentPrice > 0) {
          originalPrice = currentPrice;
          next.original_price = currentPrice;
        }
      }
      if (originalPrice > 0) {
        next.price = computeDiscountedPrice(originalPrice, discountPercent);
      }
    }

    nextRows[rowIndex] = next;
    return nextRows;
  };

  const renderRegionalPricesEditor = ({ rows = [], onChange, idPrefix }) => {
    const safeRows = Array.isArray(rows) ? rows : [];
    const addRow = () =>
      onChange([
        ...safeRows,
        makeRegionalPriceDraft({
          currency: 'USD',
          market_codes: defaultMarketCodesForCurrency('USD'),
        }),
      ]);

    return (
      <div className="rounded-lg border border-neutral-800 bg-neutral-950/30 p-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] uppercase tracking-wide text-neutral-400">Regional Currency Prices</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={addRow}
            className="h-8 border-neutral-700 text-neutral-300 hover:bg-neutral-800"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Price
          </Button>
        </div>

        {safeRows.length === 0 ? (
          <div className="rounded-md border border-dashed border-neutral-800 px-3 py-4 text-center text-xs text-neutral-500">
            No regional prices
          </div>
        ) : (
          <div className="space-y-3">
            {safeRows.map((row, index) => {
              const rowCurrency = normalizePlanCurrency(row.currency);
              const rowPrice = toNonNegativeNumber(row.price, 0);
              const rowOriginal = toNonNegativeNumber(row.original_price, 0);
              const rowDiscount = clampDiscountPercent(row.discount_percent);
              const rowShowOriginal = rowOriginal > rowPrice && rowPrice >= 0;
              const inputKey = `${idPrefix || 'regional'}-${index}`;

              return (
                <div key={inputKey} className="rounded-lg border border-neutral-800 bg-neutral-900/70 p-3 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-neutral-500">Currency</Label>
                      <Select
                        value={rowCurrency}
                        onValueChange={(value) => onChange(updateRegionalPriceRows(safeRows, index, 'currency', value))}
                      >
                        <SelectTrigger className="bg-neutral-800 border-neutral-700 text-white h-9">
                          <SelectValue placeholder="Currency" />
                        </SelectTrigger>
                        <SelectContent className="bg-neutral-800 border-neutral-700 text-white">
                          {PLAN_CURRENCY_OPTIONS.filter((item) => item.code !== DEFAULT_PLAN_CURRENCY).map((item) => (
                            <SelectItem key={item.code} value={item.code}>
                              {item.code} - {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-neutral-500">Countries / Regions</Label>
                      <Input
                        value={row.market_codes ?? ''}
                        onChange={(e) => onChange(updateRegionalPriceRows(safeRows, index, 'market_codes', e.target.value))}
                        className="bg-neutral-800 border-neutral-700 text-white h-9"
                        placeholder="US, EU, GCC"
                        disableAutoSanitize
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-neutral-500">Current Price</Label>
                      <Input
                        type="number"
                        min="0"
                        value={showBlankForZero(row.price)}
                        onChange={(e) => onChange(updateRegionalPriceRows(safeRows, index, 'price', e.target.value))}
                        className="bg-neutral-800 border-neutral-700 text-white h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-neutral-500">Original Price</Label>
                      <Input
                        type="number"
                        min="0"
                        value={showBlankForZero(row.original_price)}
                        onChange={(e) => onChange(updateRegionalPriceRows(safeRows, index, 'original_price', e.target.value))}
                        className="bg-neutral-800 border-neutral-700 text-white h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-neutral-500">Discount %</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={showBlankForZero(row.discount_percent)}
                        onChange={(e) => onChange(updateRegionalPriceRows(safeRows, index, 'discount_percent', e.target.value))}
                        className="bg-neutral-800 border-neutral-700 text-white h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-neutral-500">Discount Label</Label>
                      <Input
                        value={row.discount_label ?? ''}
                        onChange={(e) => onChange(updateRegionalPriceRows(safeRows, index, 'discount_label', e.target.value))}
                        className="bg-neutral-800 border-neutral-700 text-white h-9"
                        placeholder="Example: 20% OFF"
                        disableAutoSanitize
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-neutral-500">Extra Lead Price</Label>
                      <Input
                        type="number"
                        min="0"
                        value={showBlankForZero(row.extra_lead_price)}
                        onChange={(e) => onChange(updateRegionalPriceRows(safeRows, index, 'extra_lead_price', e.target.value))}
                        className="bg-neutral-800 border-neutral-700 text-white h-9"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => onChange(safeRows.filter((_, rowIndex) => rowIndex !== index))}
                        className="h-9 w-full border-red-900/60 text-red-300 hover:bg-red-950/40"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Remove
                      </Button>
                    </div>
                  </div>
                  <div className="text-xs text-neutral-400">
                    Preview: {rowShowOriginal ? `${formatPlanMoney(rowOriginal, rowCurrency)} -> ` : ''}
                    {formatPlanMoney(rowPrice, rowCurrency)}
                    {rowDiscount > 0 ? ` (${rowDiscount}% OFF)` : ''}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {PLAN_MARKET_REGION_OPTIONS.map((region) => (
            <Badge key={region.code} variant="secondary" className="bg-neutral-800 text-neutral-400">
              {region.code}
            </Badge>
          ))}
        </div>
      </div>
    );
  };

  const resetNewPlanForm = () => {
    setNewPlanForm({
      name: '',
      description: '',
      price: 0,
      daily_limit: 0,
      weekly_limit: 0,
      yearly_limit: 0,
      duration_days: 365,
      is_active: true,
      original_price: 0,
      discount_percent: 0,
      discount_label: '',
      currency: DEFAULT_PLAN_CURRENCY,
      regional_prices: [],
      extra_lead_price: 0,
      badge_label: '',
      badge_variant: 'neutral',
      states_limit: 0,
      cities_limit: 0,
      purchase_channel: 'DIRECT',
      public_purchase_enabled: true,
      sales_cta_label: 'Buy online',
      listing_ranking_label: '',
      listing_top_slots: 0,
      listing_highlight: false,
      listing_featured: false,
      listing_category_top_ranking: false,
      listing_verified_tick: false,
      listing_trust_seal: false,
      leads_priority: false,
      leads_early_access: false,
      leads_rfq_access: true,
      leads_direct_call_whatsapp: false,
      support_level: 'standard',
      support_sla_hours: 0,
      analytics_enabled: false,
      analytics_export_csv: false,
      portfolio_template: 'STANDARD',
      portfolio_customizable: false,
      custom_url_enabled: false,
      portfolio_custom_sections: false,
      sitemap_customization: false,
      sitemap_url_boost: 0,
      certificate_enabled: false,
      certificate_tier: '',
      certificate_title: '',
      certificate_label: '',
      seo_enabled: false,
      seo_url_aliases: 0,
      seo_city_category_pages: 0,
    });
  };

  const savePlan = async (planId) => {
    if (!planId) return;
    const draft = planDrafts?.[planId];
    if (!draft?.name || !String(draft.name).trim()) {
      toast({
        title: 'Required',
        description: 'Plan name is required.',
        variant: 'destructive',
      });
      return;
    }

    const daily = Number(draft?.daily_limit || 0);
    const weekly = Number(draft?.weekly_limit || 0);
    const yearly = Number(draft?.yearly_limit || 0);
    if (weekly < daily || yearly < weekly) {
      toast({
        title: 'Invalid lead limits',
        description: 'Keep limits in order: Daily <= Weekly <= Yearly.',
        variant: 'destructive',
      });
      return;
    }

    setPlanSavingId(planId);
    try {
      const payload = draftToPayload(draft);
      const { plan } = await superAdminServerApi.plans.update(planId, payload);
      if (plan) {
        setPlans((prev) => (prev || []).map((item) => (item.id === planId ? plan : item)));
        setPlanDrafts((prev) => ({
          ...prev,
          [planId]: planToDraft(plan),
        }));
      }
      toast({ title: 'Plan updated', description: draft.name });
      await fetchAuditLogs();
    } catch (error) {
      handleError(error, 'Failed to update plan');
    } finally {
      setPlanSavingId(null);
    }
  };

  const saveAllPlans = async () => {
    const changedPlans = (plans || []).filter((plan) => dirtyPlanIds.includes(plan.id));

    if (!changedPlans.length) {
      toast({
        title: 'No changes',
        description: 'All plans are already up to date.',
      });
      return;
    }

    for (const plan of changedPlans) {
      const draft = planDrafts?.[plan.id] || planToDraft(plan);
      const planName = String(draft?.name || plan?.name || '').trim() || `Plan ${plan.id}`;
      if (!planName) {
        toast({
          title: 'Required',
          description: `Plan name is required (${plan.id}).`,
          variant: 'destructive',
        });
        return;
      }

      const daily = Number(draft?.daily_limit || 0);
      const weekly = Number(draft?.weekly_limit || 0);
      const yearly = Number(draft?.yearly_limit || 0);
      if (weekly < daily || yearly < weekly) {
        toast({
          title: 'Invalid lead limits',
          description: `Fix limits for ${planName}: Daily <= Weekly <= Yearly.`,
          variant: 'destructive',
        });
        return;
      }
    }

    setSavingAllPlans(true);
    let successCount = 0;
    const failures = [];

    try {
      for (const plan of changedPlans) {
        const draft = planDrafts?.[plan.id] || planToDraft(plan);
        const planName = String(draft?.name || plan?.name || '').trim() || `Plan ${plan.id}`;
        try {
          const payload = draftToPayload(draft);
          const { plan: updatedPlan } = await superAdminServerApi.plans.update(plan.id, payload);
          if (updatedPlan) {
            setPlans((prev) => (prev || []).map((item) => (item.id === plan.id ? updatedPlan : item)));
            setPlanDrafts((prev) => ({
              ...prev,
              [plan.id]: planToDraft(updatedPlan),
            }));
          }
          successCount += 1;
        } catch (error) {
          failures.push({ planName, error });
        }
      }

      if (successCount > 0) {
        toast({
          title: 'Plans updated',
          description: `${successCount} plan(s) saved successfully.`,
        });
        await fetchAuditLogs();
      }

      if (failures.length > 0) {
        const first = failures[0];
        toast({
          title: 'Some plans failed',
          description: `${failures.length} failed. First: ${first.planName} (${first.error?.message || 'Update failed'})`,
          variant: 'destructive',
        });
      }
    } finally {
      setSavingAllPlans(false);
    }
  };

  const togglePlanSelectionMode = () => {
    setPlanSelectionMode((prev) => {
      const next = !prev;
      if (!next) {
        setSelectedPlanIds([]);
      }
      return next;
    });
  };

  const togglePlanSelected = (planId, checked) => {
    if (!planId) return;
    setSelectedPlanIds((prev) => {
      const current = prev || [];
      const alreadySelected = current.includes(planId);
      if (checked && !alreadySelected) return [...current, planId];
      if (!checked && alreadySelected) return current.filter((id) => id !== planId);
      return current;
    });
  };

  const deleteSelectedPlans = async () => {
    const selectedIdSet = new Set(selectedPlanIds || []);
    const selectedPlans = (plans || []).filter((plan) => selectedIdSet.has(plan?.id));

    if (!selectedPlans.length) {
      toast({
        title: 'No plans selected',
        description: 'Select one or more plans to delete.',
      });
      return;
    }

    const selectedDirtyCount = selectedPlans.filter((plan) =>
      dirtyPlanIds.includes(plan?.id)
    ).length;

    const confirmText = window.prompt(
      `Type DELETE to permanently delete ${selectedPlans.length} selected plan(s).${
        selectedDirtyCount > 0
          ? ` ${selectedDirtyCount} selected plan(s) have unsaved changes that will be lost.`
          : ''
      }`
    );
    if (confirmText !== 'DELETE') return;

    setDeletingSelectedPlans(true);
    let successCount = 0;
    const failures = [];

    try {
      for (const plan of selectedPlans) {
        const planName = String(plan?.name || '').trim() || `Plan ${plan?.id || ''}`;
        try {
          await superAdminServerApi.plans.delete(plan.id);
          successCount += 1;
        } catch (error) {
          failures.push({ planName, error });
        }
      }

      if (successCount > 0) {
        toast({
          title: 'Plans deleted',
          description: `${successCount} plan(s) deleted successfully.`,
        });
        await fetchPlans();
        await fetchAuditLogs();
      }

      if (failures.length > 0) {
        const first = failures[0];
        toast({
          title: 'Some plans could not be deleted',
          description: `${failures.length} failed. First: ${first.planName} (${first.error?.message || 'Delete failed'})`,
          variant: 'destructive',
        });
      }
    } finally {
      setDeletingSelectedPlans(false);
    }
  };

  const hidePlan = async (plan) => {
    if (!plan?.id) return;
    const planName = String(plan?.name || '').trim() || `Plan ${plan.id}`;
    setPlanDeletingId(plan.id);
    try {
      const { plan: updatedPlan } = await superAdminServerApi.plans.update(plan.id, { is_active: false });
      if (updatedPlan) {
        setPlans((prev) => (prev || []).map((item) => (item.id === plan.id ? updatedPlan : item)));
        setPlanDrafts((prev) => ({
          ...prev,
          [plan.id]: planToDraft(updatedPlan),
        }));
      }
      toast({
        title: 'Plan hidden',
        description: `${planName} is no longer visible for vendor purchase.`,
      });
      await fetchAuditLogs();
    } catch (error) {
      handleError(error, 'Failed to hide plan');
    } finally {
      setPlanDeletingId(null);
    }
  };

  const deletePlan = async (plan) => {
    if (!plan?.id) return;
    const planName = String(plan?.name || '').trim() || `Plan ${plan.id}`;
    const isDirty = dirtyPlanIds.includes(plan.id);
    const confirmText = window.prompt(
      `Type DELETE to delete "${planName}".${
        isDirty ? ' Unsaved changes on this plan will be lost.' : ''
      }\n\nUnused plans are removed permanently. Plans with active vendors or payment history are hidden from the active catalog.`
    );
    if (confirmText !== 'DELETE') return;

    setPlanDeletingId(plan.id);
    try {
      const result = await superAdminServerApi.plans.delete(plan.id);
      toast({
        title: result?.soft_deleted ? 'Plan hidden' : 'Plan deleted',
        description: result?.message || `${planName} was removed from the active catalog.`,
      });
      await fetchPlans();
      await fetchAuditLogs();
    } catch (error) {
      const message = error?.message || 'Delete failed';
      const canHideInstead = window.confirm(
        `${message}\n\nThis plan may have active subscriptions or payment history. Hide it instead so vendors cannot buy it?`
      );
      setPlanDeletingId(null);
      if (canHideInstead) {
        await hidePlan(plan);
      } else {
        toast({
          title: 'Plan not deleted',
          description: message,
          variant: 'destructive',
        });
      }
    } finally {
      setPlanDeletingId(null);
    }
  };

  const createPlan = async (e) => {
    e.preventDefault();
    if (!newPlanForm.name.trim()) {
      toast({
        title: 'Required',
        description: 'Plan name is required.',
        variant: 'destructive',
      });
      return;
    }

    const daily = Number(newPlanForm?.daily_limit || 0);
    const weekly = Number(newPlanForm?.weekly_limit || 0);
    const yearly = Number(newPlanForm?.yearly_limit || 0);
    if (weekly < daily || yearly < weekly) {
      toast({
        title: 'Invalid lead limits',
        description: 'Keep limits in order: Daily <= Weekly <= Yearly.',
        variant: 'destructive',
      });
      return;
    }

    setPlanCreating(true);
    try {
      const payload = draftToPayload(newPlanForm);
      await superAdminServerApi.plans.create(payload);
      toast({ title: 'Plan created', description: newPlanForm.name.trim() });
      setPlanCreateOpen(false);
      resetNewPlanForm();
      await fetchPlans();
      await fetchAuditLogs();
    } catch (error) {
      handleError(error, 'Failed to create plan');
    } finally {
      setPlanCreating(false);
    }
  };

  const saveSystemConfig = async (configOverride = null, options = {}) => {
    setSystemSaving(true);
    const nextConfig = normalizeSystemConfig(configOverride || systemConfig, systemConfig);
    try {
      const { config } = await superAdminServerApi.system.updateConfig({
        maintenance_mode: featureBool(nextConfig.maintenance_mode, false),
        maintenance_message: nextConfig.maintenance_message || '',
        public_notice_enabled: featureBool(nextConfig.public_notice_enabled, false),
        public_notice_message: nextConfig.public_notice_message || '',
        public_notice_variant: nextConfig.public_notice_variant || 'info',
      });
      if (config) {
        setSystemConfig((prev) => normalizeSystemConfig(config, prev));
      }
      if (!options.silent) {
        toast({
          title: 'Saved',
          description: options.description || 'System configuration updated.',
        });
      }
      await fetchAuditLogs();
    } catch (error) {
      handleError(error, 'Failed to save system config');
      await fetchSystemConfig();
    } finally {
      setSystemSaving(false);
    }
  };

  const updatePageStatus = async (pageId, updates) => {
    setPageBusyId(pageId);
    try {
      const { page } = await superAdminServerApi.pages.update(pageId, updates);
      setPages((prev) =>
        (prev || []).map((p) =>
          p.id === pageId ? normalizePageControl({ ...p, ...(page || updates) }) : p
        )
      );
      await fetchAuditLogs();
    } catch (error) {
      handleError(error, 'Failed to update page');
      await fetchPages();
    } finally {
      setPageBusyId(null);
    }
  };

  const handlePageMessageChange = (pageId, value) => {
    setPages((prev) =>
      (prev || []).map((p) => (p.id === pageId ? { ...p, error_message: value } : p))
    );
  };

  const createPageStatus = async () => {
    const page_name = newPage.page_name.trim();
    const page_route = newPage.page_route.trim();
    if (!page_name || !page_route) {
      toast({
        title: 'Required',
        description: 'Page name and route are required.',
        variant: 'destructive',
      });
      return;
    }

    setNewPageSaving(true);
    try {
      await superAdminServerApi.pages.create({
        page_name,
        page_route,
        error_message: newPage.error_message || '',
      });
      toast({ title: 'Page added', description: `${page_name} is now controllable.` });
      setNewPage({ page_name: '', page_route: '', error_message: '' });
      await fetchPages();
      await fetchAuditLogs();
    } catch (error) {
      handleError(error, 'Failed to create page control');
    } finally {
      setNewPageSaving(false);
    }
  };

  const deletePageStatus = async (page) => {
    if (!page?.id) return;
    if (!window.confirm(`Delete page control for ${page.page_name}?`)) return;
    setPageBusyId(page.id);
    try {
      await superAdminServerApi.pages.delete(page.id);
      toast({ title: 'Deleted', description: `${page.page_name} removed.` });
      await fetchPages();
      await fetchAuditLogs();
    } catch (error) {
      handleError(error, 'Failed to delete page control');
    } finally {
      setPageBusyId(null);
    }
  };

  const resetEmployeeForm = () => {
    setEmployeeForm({
      full_name: '',
      email: '',
      password: '',
      phone: '',
      role: 'ADMIN',
      department: 'Administration',
      status: 'ACTIVE',
      state_scope_ids: [],
    });
  };

  const submitEmployee = async (e) => {
    e.preventDefault();
    if (!employeeForm.full_name || !employeeForm.email || !employeeForm.password) {
      toast({
        title: 'Required',
        description: 'Name, email, and password are required.',
        variant: 'destructive',
      });
      return;
    }

    setEmployeeSaving(true);
    try {
      const payload = { ...employeeForm };
      if (payload.role === 'ADMIN') {
        payload.state_scope_ids = (payload.state_scope_ids || []).map((id) => String(id));
      } else {
        delete payload.state_scope_ids;
      }
      await superAdminServerApi.employees.create(payload);
      toast({ title: 'Employee created', description: employeeForm.email });
      setEmployeeModalOpen(false);
      resetEmployeeForm();
      await fetchEmployees();
      await fetchAuditLogs();
    } catch (error) {
      handleError(error, 'Failed to create employee');
    } finally {
      setEmployeeSaving(false);
    }
  };

  const deleteEmployee = async (emp) => {
    if (!emp?.id) return;
    if (!window.confirm(`Delete employee ${emp.full_name || emp.email}?`)) return;
    setEmployeeDeletingId(emp.id);
    try {
      await superAdminServerApi.employees.delete(emp.id);
      toast({ title: 'Deleted', description: emp.email || 'Employee removed.' });
      await fetchEmployees();
      await fetchAuditLogs();
    } catch (error) {
      handleError(error, 'Failed to delete employee');
    } finally {
      setEmployeeDeletingId(null);
    }
  };

  const resetEmployeePassword = async (emp) => {
    if (!emp?.id) return;
    const nextPassword = window.prompt(
      `Enter a new password for ${emp.email} (min 6 characters):`
    );
    if (!nextPassword) return;
    if (nextPassword.length < 6) {
      toast({
        title: 'Invalid password',
        description: 'Password must be at least 6 characters.',
        variant: 'destructive',
      });
      return;
    }

    setEmployeeDeletingId(emp.id);
    try {
      await superAdminServerApi.employees.resetPassword(emp.id, nextPassword);
      toast({
        title: 'Password reset',
        description: `${emp.email} can use the new password now.`,
      });
      await fetchAuditLogs();
    } catch (error) {
      handleError(error, 'Failed to reset password');
    } finally {
      setEmployeeDeletingId(null);
    }
  };

  const deleteVendor = async (vendor) => {
    if (!vendor?.id) return;
    const confirmText = window.prompt(
      `Type DELETE to permanently delete vendor ${
        vendor.company_name || vendor.email
      }. This is destructive.`
    );
    if (confirmText !== 'DELETE') return;

    setVendorDeletingId(vendor.id);
    try {
      await superAdminServerApi.vendors.delete(vendor.id);
      toast({
        title: 'Vendor deleted',
        description: vendor.company_name || vendor.email || vendor.id,
      });
      await fetchVendors();
      await fetchFinance();
      await fetchAuditLogs();
    } catch (error) {
      handleError(error, 'Failed to delete vendor');
    } finally {
      setVendorDeletingId(null);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (!passwordForm.current || !passwordForm.new) {
      toast({
        title: 'Required',
        description: 'Current and new password are required.',
        variant: 'destructive',
      });
      return;
    }
    if (passwordForm.new.length < 8) {
      toast({
        title: 'Weak password',
        description: 'New password must be at least 8 characters.',
        variant: 'destructive',
      });
      return;
    }
    if (passwordForm.new !== passwordForm.confirm) {
      toast({
        title: 'Mismatch',
        description: 'New password and confirm password must match.',
        variant: 'destructive',
      });
      return;
    }

    setPasswordSaving(true);
    try {
      const ok = await changePassword(passwordForm.current, passwordForm.new);
      if (ok) {
        setPasswordForm({ current: '', new: '', confirm: '' });
        await fetchAuditLogs();
      }
    } finally {
      setPasswordSaving(false);
    }
  };

  const navGroups = useMemo(() => {
    const groups = [
      {
        label: 'Platform Control',
        items: [
          { value: 'system', label: 'System', icon: Wrench },
          { value: 'employees', label: 'Employees', icon: Users },
          { value: 'settings', label: 'Security', icon: Settings },
        ],
      },
      {
        label: 'Business Ops',
        items: [
          { value: 'vendors', label: 'Vendors', icon: Building2 },
          { value: 'plans', label: 'Plans', icon: Package },
          { value: 'finance', label: 'Finance', icon: IndianRupee },
        ],
      },
      {
        label: 'Intelligence',
        items: [
          { value: 'monitoring', label: 'Monitoring', icon: BarChart3 },
          { value: 'behavioral', label: 'Demand Intel', icon: Activity },
          { value: 'search360', label: 'Search 360', icon: Search },
        ],
      },
    ];

    if (isGodMode) {
      groups.push({
        label: 'Developer',
        items: [
          { value: 'godmode', label: 'Operations', icon: ShieldAlert },
          { value: 'audit', label: 'DB Activity', icon: History },
        ],
      });
    }

    return groups;
  }, [isGodMode]);

  const handleTabChange = (value) => {
    setActiveTab(value);
    if (value === 'monitoring' && !monitoringOverview && !monitoringLoading) {
      fetchMonitoring();
    }
    if (value === 'behavioral' && !behavioralIntel && !behavioralIntelLoading) {
      fetchBehavioralIntel({ days: behavioralIntelDays });
    }
    if (value === 'vendors' && !(visitorActivity.events || []).length && !visitorActivityLoading) {
      fetchVisitorActivity(monitoringActivityDays);
    }
    if (value === 'godmode' && !(visitorActivity.events || []).length && !visitorActivityLoading) {
      fetchVisitorActivity(monitoringActivityDays);
    }
  };

  if (!superAdmin) return null;

  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-200">
      <header className="bg-black border-b border-neutral-800 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <ShieldAlert className={`h-8 w-8 ${isGodMode ? 'text-red-600' : 'text-yellow-500'}`} />
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              {isGodMode ? 'Developer Console' : 'Super Admin'}
            </h1>
            <p className="text-xs text-neutral-500 font-mono">
              {isGodMode ? 'Platform engineering and diagnostics' : 'ITM owner console for business control'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right hidden md:block">
            <p className="text-sm font-medium text-white">
              {superAdmin?.name || superAdmin?.full_name || 'Super Admin'}
            </p>
            <p className="text-xs text-neutral-500">{superAdmin?.email}</p>
          </div>
          <Button
            variant="outline"
            className="border-red-900 text-red-500 hover:bg-red-950 hover:text-red-400"
            onClick={logout}
          >
            <LogOut className="h-4 w-4 mr-2" /> Disconnect
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full min-w-0 space-y-6 p-6">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <div className="rounded-lg border border-neutral-800 bg-neutral-950/70 p-3">
            <div className="grid gap-3 xl:grid-cols-4">
              {navGroups.map((group) => (
                <div key={group.label} className="rounded-md border border-neutral-800 bg-neutral-900/80 p-2">
                  <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                    {group.label}
                  </p>
                  <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-transparent p-0">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const isDeveloperItem = group.label === 'Developer';
                      return (
                        <TabsTrigger
                          key={item.value}
                          value={item.value}
                          className={`h-9 rounded-md px-3 text-xs data-[state=active]:text-white ${
                            isDeveloperItem
                              ? 'text-red-300 data-[state=active]:bg-red-900'
                              : 'text-neutral-300 data-[state=active]:bg-neutral-700'
                          }`}
                        >
                          <Icon className="mr-2 h-4 w-4" />
                          {item.label}
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>
                </div>
              ))}
            </div>
          </div>

          <TabsContent value="system" className="space-y-4">
            <Card className="bg-neutral-900 border-neutral-800">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-white">Maintenance Mode</CardTitle>
                  <CardDescription className="text-neutral-400">
                    Enable full maintenance and set the message users see.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  onClick={fetchSystemConfig}
                  className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                >
                  <RefreshCw className={`h-4 w-4 ${systemLoading ? 'animate-spin' : ''}`} />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-neutral-300">Maintenance Mode</Label>
                  <Switch
                    checked={featureBool(systemConfig.maintenance_mode, false)}
                    disabled={systemSaving}
                    onCheckedChange={(checked) => {
                      const nextConfig = normalizeSystemConfig(
                        { ...systemConfig, maintenance_mode: checked },
                        systemConfig
                      );
                      setSystemConfig(nextConfig);
                      saveSystemConfig(nextConfig, {
                        description: checked ? 'Maintenance mode enabled.' : 'Maintenance mode disabled.',
                      });
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-neutral-300">Maintenance Message</Label>
                  <Textarea
                    value={systemConfig.maintenance_message || ''}
                    onChange={(e) =>
                      setSystemConfig((prev) => ({
                        ...prev,
                        maintenance_message: e.target.value,
                      }))
                    }
                    className="bg-neutral-800 border-neutral-700 text-neutral-200 min-h-[96px]"
                    placeholder="Example: We are upgrading servers. Please check back soon."
                  />
                </div>
                <div className="flex justify-end">
                  <Button onClick={saveSystemConfig} disabled={systemSaving} className="bg-blue-600 hover:bg-blue-700">
                    {systemSaving ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-neutral-900 border-neutral-800">
              <CardHeader>
                <CardTitle className="text-white">Public Notice Banner</CardTitle>
                <CardDescription className="text-neutral-400">
                  Show any custom message across the website without full maintenance.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-neutral-300">Enable Public Notice</Label>
                  <Switch
                    checked={featureBool(systemConfig.public_notice_enabled, false)}
                    disabled={systemSaving}
                    onCheckedChange={(checked) => {
                      const nextConfig = normalizeSystemConfig(
                        { ...systemConfig, public_notice_enabled: checked },
                        systemConfig
                      );
                      setSystemConfig(nextConfig);
                      saveSystemConfig(nextConfig, {
                        description: checked ? 'Public notice enabled.' : 'Public notice disabled.',
                      });
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-neutral-300">Notice Variant</Label>
                  <Select
                    value={systemConfig.public_notice_variant || 'info'}
                    onValueChange={(value) =>
                      setSystemConfig((prev) => ({ ...prev, public_notice_variant: value }))
                    }
                  >
                    <SelectTrigger className="bg-neutral-800 border-neutral-700 text-white">
                      <SelectValue placeholder="Variant" />
                    </SelectTrigger>
                    <SelectContent className="bg-neutral-800 border-neutral-700 text-white">
                      {NOTICE_VARIANTS.map((variant) => (
                        <SelectItem key={variant} value={variant} className="capitalize">
                          {variant}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-neutral-300">Notice Message</Label>
                  <Textarea
                    value={systemConfig.public_notice_message || ''}
                    onChange={(e) =>
                      setSystemConfig((prev) => ({
                        ...prev,
                        public_notice_message: e.target.value,
                      }))
                    }
                    className="bg-neutral-800 border-neutral-700 text-neutral-200 min-h-[96px]"
                    placeholder="Example: Prices will update tonight at 11:00 PM IST."
                  />
                </div>
                <div className="flex justify-end">
                  <Button onClick={saveSystemConfig} disabled={systemSaving} className="bg-amber-600 hover:bg-amber-700">
                    {systemSaving ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-neutral-900 border-neutral-800">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-white">Page Controls</CardTitle>
                  <CardDescription className="text-neutral-400">
                    Disable individual routes and customize their downtime message.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  onClick={fetchPages}
                  className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                >
                  <RefreshCw className={`h-4 w-4 ${pagesLoading ? 'animate-spin' : ''}`} />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {pagesLoading ? (
                  <div className="text-center py-8">
                    <RefreshCw className="animate-spin h-8 w-8 mx-auto text-neutral-600" />
                  </div>
                ) : (
                  <div className="rounded-md border border-neutral-800 overflow-hidden">
                    <Table>
                      <TableHeader className="bg-neutral-800">
                        <TableRow>
                          <TableHead className="text-neutral-300">Page</TableHead>
                          <TableHead className="text-neutral-300">Route</TableHead>
                          <TableHead className="text-neutral-300">Status</TableHead>
                          <TableHead className="text-neutral-300">Message</TableHead>
                          <TableHead className="text-right text-neutral-300">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(pages || []).map((page) => {
                          const busy = pageBusyId === page.id;
                          const isBlanked = featureBool(page.is_blanked, false);
                          const isOnline = !isBlanked;
                          return (
                            <TableRow key={page.id} className="hover:bg-neutral-800/50">
                              <TableCell className="text-white font-medium">
                                {page.page_name}
                              </TableCell>
                              <TableCell className="text-neutral-400 text-xs font-mono">
                                {page.page_route}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={isOnline ? 'default' : 'destructive'}
                                  className={isOnline ? 'bg-green-600' : ''}
                                >
                                  {isOnline ? 'ONLINE' : 'OFFLINE'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={page.error_message || ''}
                                  onChange={(e) =>
                                    handlePageMessageChange(page.id, e.target.value)
                                  }
                                  onBlur={(e) =>
                                    updatePageStatus(page.id, {
                                      error_message: e.target.value,
                                      is_blanked: isBlanked,
                                    })
                                  }
                                  className="bg-neutral-800 border-neutral-700 text-neutral-200 h-9"
                                  disabled={busy}
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <Switch
                                    checked={isOnline}
                                    disabled={busy}
                                    onCheckedChange={(nextOnline) =>
                                      updatePageStatus(page.id, {
                                        is_blanked: !nextOnline,
                                        error_message: page.error_message || '',
                                      })
                                    }
                                  />
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-red-500 hover:text-red-400 hover:bg-red-900/20"
                                    onClick={() => deletePageStatus(page)}
                                    disabled={busy}
                                  >
                                    {busy ? (
                                      <RefreshCw className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-neutral-800">
                  <div className="space-y-1">
                    <Label className="text-neutral-300">Page Name</Label>
                    <Input
                      value={newPage.page_name}
                      onChange={(e) =>
                        setNewPage((prev) => ({ ...prev, page_name: e.target.value }))
                      }
                      className="bg-neutral-800 border-neutral-700 text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-neutral-300">Page Route</Label>
                    <Input
                      value={newPage.page_route}
                      onChange={(e) =>
                        setNewPage((prev) => ({ ...prev, page_route: e.target.value }))
                      }
                      className="bg-neutral-800 border-neutral-700 text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-neutral-300">Offline Message</Label>
                    <Input
                      value={newPage.error_message}
                      onChange={(e) =>
                        setNewPage((prev) => ({ ...prev, error_message: e.target.value }))
                      }
                      className="bg-neutral-800 border-neutral-700 text-white"
                    />
                  </div>
                  <div className="md:col-span-3 flex justify-end">
                    <Button
                      onClick={createPageStatus}
                      disabled={newPageSaving}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {newPageSaving ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4 mr-2" />
                      )}
                      Add Page Control
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="employees" className="space-y-4">
            <Card className="bg-neutral-900 border-neutral-800">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-white">Employee Management</CardTitle>
                  <CardDescription className="text-neutral-400">
                    Create employees and remove any employee account.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={fetchEmployees}
                    className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                  >
                    <RefreshCw className={`h-4 w-4 ${employeesLoading ? 'animate-spin' : ''}`} />
                  </Button>
                  {isGodMode && (
                    <Button
                      onClick={openSuperadminModal}
                      className="bg-red-900 hover:bg-red-800"
                    >
                      <ShieldAlert className="h-4 w-4 mr-2" /> Create SuperAdmin
                    </Button>
                  )}
                  <Button
                    onClick={() => setEmployeeModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4 mr-2" /> Create Employee
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  placeholder="Search employees by ID, name, email, role..."
                  className="bg-neutral-800 border-neutral-700 text-white"
                />

                <div className="rounded-md border border-neutral-800 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-neutral-800">
                      <TableRow>
                        <TableHead className="text-neutral-300">Employee</TableHead>
                        <TableHead className="text-neutral-300">Role</TableHead>
                        <TableHead className="text-neutral-300">Department</TableHead>
                        <TableHead className="text-neutral-300">Status</TableHead>
                        <TableHead className="text-neutral-300">Created</TableHead>
                        <TableHead className="text-right text-neutral-300">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEmployees.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-neutral-500 py-10">
                            {employeesLoading ? 'Loading employees...' : 'No employees found'}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredEmployees.map((emp) => {
                          const busy = employeeDeletingId === emp.id;
                          const isActive = String(emp.status || '').toUpperCase() === 'ACTIVE';
                          return (
                            <TableRow key={emp.id} className="hover:bg-neutral-800/50">
                              <TableCell>
                                <div className="font-medium text-white">
                                  {emp.full_name || 'Unnamed'}
                                </div>
                                <div className="text-xs text-neutral-500">{emp.email}</div>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className="text-blue-400 border-blue-900 bg-blue-900/20"
                                >
                                  {emp.role}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-neutral-300">
                                {getDepartmentLabel(emp)}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={isActive ? 'default' : 'destructive'}
                                  className={isActive ? 'bg-green-600' : ''}
                                >
                                  {isActive ? 'ACTIVE' : String(emp.status || 'INACTIVE').toUpperCase()}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-neutral-400 text-xs">
                                {formatDateTime(emp.created_at)}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-amber-400 hover:text-amber-300 hover:bg-amber-900/20"
                                    onClick={() => resetEmployeePassword(emp)}
                                    disabled={busy}
                                  >
                                    <KeyRound className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-red-500 hover:text-red-400 hover:bg-red-900/20"
                                    onClick={() => deleteEmployee(emp)}
                                    disabled={busy}
                                  >
                                    {busy ? (
                                      <RefreshCw className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vendors" className="space-y-4">
            <Card className="bg-neutral-900 border-neutral-800">
              <CardHeader className="space-y-2">
                <CardTitle className="text-white">Vendor Onboarding Summary</CardTitle>
                <CardDescription className="text-neutral-400">
                  Track new vendors by day, week, month, active status, and recent website visitor reach.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
                  {[
                    { label: 'Total vendors', value: vendorMetrics.total, hint: 'All onboarded vendor accounts' },
                    { label: 'Active vendors', value: vendorMetrics.active, hint: 'Currently active vendor accounts' },
                    { label: 'Onboarded today', value: vendorMetrics.today, hint: 'Created since today midnight' },
                    { label: 'This week', value: vendorMetrics.week, hint: 'Created in the last 7 days' },
                    { label: 'This month', value: vendorMetrics.month, hint: 'Created from month start' },
                    {
                      label: 'Website visitors',
                      value: visitorActivityLoading ? '...' : Number(visitorActivity.stats?.unique_visitors || 0),
                      hint: `Unique visitors in ${monitoringActivityDays} days`,
                    },
                  ].map((metric) => (
                    <div
                      key={metric.label}
                      className="rounded-lg border border-neutral-800 bg-neutral-950/70 p-4 shadow-sm"
                    >
                      <div className="text-xs uppercase tracking-wide text-neutral-500">{metric.label}</div>
                      <div className="mt-2 text-2xl font-semibold text-white">{metric.value}</div>
                      <div className="mt-1 text-xs text-neutral-500">{metric.hint}</div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-wrap gap-2">
                    {VENDOR_FILTERS.map((filter) => {
                      const active = vendorFilter === filter.value;
                      return (
                        <Button
                          key={filter.value}
                          type="button"
                          size="sm"
                          variant={active ? 'default' : 'outline'}
                          onClick={() => setVendorFilter(filter.value)}
                          className={
                            active
                              ? 'bg-blue-600 text-white hover:bg-blue-500'
                              : 'border-neutral-700 bg-neutral-950 text-neutral-300 hover:bg-neutral-800'
                          }
                        >
                          {filter.label}
                        </Button>
                      );
                    })}
                  </div>
                  <div className="text-sm text-neutral-500">
                    Showing <span className="font-semibold text-neutral-200">{filteredVendors.length}</span> of{' '}
                    <span className="font-semibold text-neutral-200">{vendors.length}</span> vendors
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-neutral-900 border-neutral-800">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-white">Vendor Deletion</CardTitle>
                  <CardDescription className="text-neutral-400">
                    Permanently delete vendor accounts and related data.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  onClick={fetchVendors}
                  className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                >
                  <RefreshCw className={`h-4 w-4 ${vendorsLoading ? 'animate-spin' : ''}`} />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  value={vendorSearch}
                  onChange={(e) => setVendorSearch(e.target.value)}
                  placeholder="Search vendors by company, email, vendor ID, or internal ID..."
                  className="bg-neutral-800 border-neutral-700 text-white"
                />

                <div className="rounded-md border border-neutral-800 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-neutral-800">
                      <TableRow>
                        <TableHead className="text-neutral-300">Vendor</TableHead>
                        <TableHead className="text-neutral-300">KYC</TableHead>
                        <TableHead className="text-neutral-300">Active</TableHead>
                        <TableHead className="text-neutral-300">Location</TableHead>
                        <TableHead className="text-neutral-300">Direct Leads</TableHead>
                        <TableHead className="text-neutral-300">Purchased Leads</TableHead>
                        <TableHead className="text-neutral-300">Opened / Unopened</TableHead>
                        <TableHead className="text-neutral-300">Created</TableHead>
                        <TableHead className="text-right text-neutral-300">Delete</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredVendors.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center text-neutral-500 py-10">
                            {vendorsLoading ? 'Loading vendors...' : 'No vendors found'}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredVendors.map((vendor) => {
                          const busy = vendorDeletingId === vendor.id;
                          const kyc = String(vendor.kyc_status || 'PENDING').toUpperCase();
                          const active = isVendorActive(vendor);
                          const stats = vendor.lead_stats || {};
                          return (
                            <TableRow key={vendor.id} className="hover:bg-neutral-800/50">
                              <TableCell>
                                <div className="font-medium text-white">
                                  {vendor.company_name || 'Unnamed vendor'}
                                </div>
                                <div className="text-xs text-neutral-500">
                                  {vendor.email || vendor.vendor_id || vendor.id}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={
                                    kyc === 'APPROVED'
                                      ? 'text-green-400 border-green-900 bg-green-900/20'
                                      : kyc === 'REJECTED'
                                      ? 'text-red-400 border-red-900 bg-red-900/20'
                                      : 'text-amber-400 border-amber-900 bg-amber-900/20'
                                  }
                                >
                                  {kyc}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={active ? 'default' : 'destructive'}
                                  className={active ? 'bg-green-600' : ''}
                                >
                                  {active ? 'ACTIVE' : 'INACTIVE'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-neutral-300 text-sm">
                                {[vendor.city, vendor.state].filter(Boolean).join(', ') || '—'}
                              </TableCell>
                              <TableCell className="text-sm">
                                <div className="font-semibold text-white">{Number(stats.direct_total || 0)}</div>
                                <div className="text-[11px] text-neutral-500">
                                  {Number(stats.direct_opened || 0)} opened · {Number(stats.direct_unopened || 0)} unopened
                                </div>
                              </TableCell>
                              <TableCell className="text-sm">
                                <div className="font-semibold text-white">{Number(stats.purchased_total || 0)}</div>
                                <div className="text-[11px] text-neutral-500">
                                  {Number(stats.purchased_opened || 0)} opened · {Number(stats.purchased_unopened || 0)} unopened
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className="border-blue-900 bg-blue-900/20 text-blue-300"
                                >
                                  {Number(stats.total_opened || 0)} / {Number(stats.total_unopened || 0)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-neutral-400 text-xs">
                                {formatDateTime(vendor.created_at)}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="bg-red-700 hover:bg-red-600"
                                  onClick={() => deleteVendor(vendor)}
                                  disabled={busy}
                                >
                                  {busy ? (
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="plans" className="space-y-4">
            <Card className="bg-neutral-900 border-neutral-800">
              <CardHeader className="space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <CardTitle className="text-white">Subscription Plan Control</CardTitle>
                    <CardDescription className="text-neutral-400">
                      Configure vendor plan limits, pricing, discount display, and visibility.
                    </CardDescription>
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                    <Button
                      variant="outline"
                      onClick={fetchPlans}
                      disabled={deletingSelectedPlans || planDeletingId !== null}
                      className="border-neutral-700 text-neutral-300 hover:bg-neutral-800 w-full sm:w-auto"
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${plansLoading ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                    <Button
                      onClick={saveAllPlans}
                      disabled={
                        savingAllPlans ||
                        deletingSelectedPlans ||
                        plansLoading ||
                        planSavingId !== null ||
                        planDeletingId !== null ||
                        dirtyPlanIds.length === 0
                      }
                      className="bg-emerald-700 hover:bg-emerald-600 w-full sm:w-auto disabled:opacity-60"
                    >
                      {savingAllPlans ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      {savingAllPlans ? 'Saving...' : `Save All (${dirtyPlanIds.length})`}
                    </Button>
                    <Button
                      onClick={() => setPlanCreateOpen(true)}
                      disabled={deletingSelectedPlans || planDeletingId !== null}
                      className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
                    >
                      <Plus className="h-4 w-4 mr-2" /> Create Plan
                    </Button>
                  </div>
                </div>

                <Input
                  value={planSearch}
                  onChange={(e) => setPlanSearch(e.target.value)}
                  placeholder="Search plans by name or description..."
                  className="bg-neutral-800 border-neutral-700 text-white"
                />

                <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
                  {PLAN_LIMIT_GUIDE.map((item) => (
                    <div
                      key={item.title}
                      className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-3"
                    >
                      <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-neutral-100">
                        <Info className="h-4 w-4 text-blue-300" />
                        {item.title}
                      </div>
                      <p className="text-xs leading-5 text-neutral-400">{item.body}</p>
                    </div>
                  ))}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {filteredPlans.length === 0 ? (
                  <div className="rounded-lg border border-neutral-800 py-12 text-center text-neutral-500">
                    {plansLoading ? 'Loading plans...' : 'No plans found'}
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="space-y-3">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-white">Choose a plan to edit</p>
                          <p className="text-xs text-neutral-500">
                            Click a card to open that plan editor. Use delete only for unused plans.
                          </p>
                        </div>
                        <div className="text-xs text-neutral-500">
                          {filteredPlans.length} plan{filteredPlans.length === 1 ? '' : 's'}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                        {filteredPlans.map((plan) => {
                          const draft = planDrafts?.[plan.id] || planToDraft(plan);
                          const isSelected = selectedPlan?.id === plan.id;
                          const deleting = planDeletingId === plan.id;
                          const isDirty = dirtyPlanIds.includes(plan.id);

                          const openEditor = () => {
                            setSelectedPlanId(plan.id);
                            setPlanEditorOpen(true);
                          };

                          return (
                            <div
                              key={plan.id}
                              role="button"
                              tabIndex={0}
                              onClick={openEditor}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault();
                                  openEditor();
                                }
                              }}
                              className={`group cursor-pointer rounded-xl border p-4 transition-colors ${
                                isSelected
                                  ? 'border-blue-500 bg-blue-950/25 ring-1 ring-blue-500/30'
                                  : 'border-neutral-800 bg-neutral-950/45 hover:border-neutral-700 hover:bg-neutral-900/70'
                              }`}
                            >
                              <div className="mb-4 flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="truncate text-base font-semibold text-white">
                                    {draft.name || 'Untitled plan'}
                                  </div>
                                  <p className="mt-1 line-clamp-2 min-h-8 text-xs leading-4 text-neutral-500">
                                    {draft.description || 'No description added yet.'}
                                  </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      openEditor();
                                    }}
                                    disabled={plansLoading || deleting || savingAllPlans}
                                    className="h-8 bg-blue-600 px-2.5 text-white hover:bg-blue-700"
                                    title="Edit this plan"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                    <span className="ml-1.5">Edit</span>
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      deletePlan(plan);
                                    }}
                                    disabled={
                                      deleting ||
                                      planSavingId === plan.id ||
                                      savingAllPlans ||
                                      deletingSelectedPlans ||
                                      plansLoading
                                    }
                                    className="h-8 border-red-900/70 bg-red-950/20 px-2 text-red-200 hover:bg-red-950/50 hover:text-red-100"
                                    title="Delete this plan"
                                  >
                                    {deleting ? (
                                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-xs">
                                {[
                                  { label: 'Daily', value: draft.daily_limit || 0 },
                                  { label: 'Weekly', value: draft.weekly_limit || 0 },
                                  { label: 'States', value: draft.states_limit || 0 },
                                  { label: 'Cities', value: draft.cities_limit || 0 },
                                ].map((item) => (
                                  <div key={item.label} className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-2">
                                    <div className="text-[10px] uppercase tracking-wide text-neutral-500">{item.label}</div>
                                    <div className="mt-0.5 text-sm font-semibold text-neutral-100">{item.value}</div>
                                  </div>
                                ))}
                              </div>

                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <Badge
                                  variant="secondary"
                                  className={
                                    draft.is_active
                                      ? 'bg-emerald-900/40 text-emerald-300'
                                      : 'bg-neutral-800 text-neutral-400'
                                  }
                                >
                                  {draft.is_active ? 'Visible' : 'Hidden'}
                                </Badge>
                                {isDirty ? (
                                  <Badge variant="secondary" className="bg-amber-950/50 text-amber-300">
                                    Unsaved
                                  </Badge>
                                ) : null}
                                {isSelected ? (
                                  <Badge variant="secondary" className="bg-blue-900/50 text-blue-200">
                                    Selected
                                  </Badge>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <Dialog open={planEditorOpen && Boolean(selectedPlan)} onOpenChange={setPlanEditorOpen}>
                      <DialogContent className="max-h-[92vh] w-[96vw] max-w-[1100px] overflow-y-auto border-neutral-800 bg-neutral-950 text-white">
                        <DialogHeader>
                          <DialogTitle>
                            Edit {String((planDrafts?.[selectedPlan?.id] || (selectedPlan ? planToDraft(selectedPlan) : {}))?.name || 'plan')}
                          </DialogTitle>
                          <DialogDescription className="text-neutral-400">
                            Update this plan, then save changes. Delete is only for unused plans.
                          </DialogDescription>
                        </DialogHeader>

                    <div className="grid grid-cols-1 gap-4">
                    {filteredPlans.filter((plan) => plan?.id === selectedPlan?.id).map((plan) => {
                      const draft = planDrafts?.[plan.id] || planToDraft(plan);
                      const saving = planSavingId === plan.id;
                      const deleting = planDeletingId === plan.id;
                      const selected = selectedPlan?.id === plan.id;
                      const nowPrice = Number(draft?.price || 0);
                      const oldPrice = Number(draft?.original_price || 0);
                      const discountPercent = Number(draft?.discount_percent || 0);
                      const currency = normalizePlanCurrency(draft?.currency);
                      const currencyMeta = getPlanCurrencyMeta(currency);
                      const showOldPrice = Number.isFinite(oldPrice) && oldPrice > nowPrice && nowPrice >= 0;
                      const showPercent = Number.isFinite(discountPercent) && discountPercent > 0;

                      return (
                        <div
                          key={plan.id}
                          className={`rounded-xl border bg-neutral-950/40 p-4 sm:p-5 space-y-4 ${
                            selected
                              ? 'border-blue-700/80 ring-1 ring-blue-800/60'
                              : 'border-neutral-800'
                          }`}
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-2">
                              {planSelectionMode ? (
                                <Checkbox
                                  checked={selected}
                                  onCheckedChange={(checked) =>
                                    togglePlanSelected(plan.id, checked === true)
                                  }
                                  className="border-neutral-600 data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600"
                                />
                              ) : null}
                              <div className="text-xs text-neutral-500">Plan ID: {plan.id}</div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge
                                variant="secondary"
                                className={
                                  draft.is_active
                                    ? 'bg-emerald-900/40 text-emerald-300'
                                    : 'bg-neutral-800 text-neutral-400'
                                }
                              >
                                {draft.is_active ? 'Visible for purchase' : 'Hidden from vendors'}
                              </Badge>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => deletePlan(plan)}
                                disabled={
                                  deleting ||
                                  saving ||
                                  savingAllPlans ||
                                  deletingSelectedPlans ||
                                  plansLoading ||
                                  planSelectionMode
                                }
                                className="h-8 border-red-900/70 bg-red-950/20 px-2.5 text-red-200 hover:bg-red-950/50 hover:text-red-100"
                              >
                                {deleting ? (
                                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                                <span className="ml-1.5">Delete</span>
                              </Button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-3">
                            <div className="space-y-1">
                              <Label className="text-[11px] uppercase tracking-wide text-neutral-400">Plan Name</Label>
                              <Input
                                value={draft.name ?? ''}
                                onChange={(e) => updatePlanDraft(plan.id, 'name', e.target.value)}
                                className="bg-neutral-800 border-neutral-700 text-white h-9"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px] uppercase tracking-wide text-neutral-400">Description</Label>
                              <Input
                                value={draft.description ?? ''}
                                onChange={(e) => updatePlanDraft(plan.id, 'description', e.target.value)}
                                className="bg-neutral-800 border-neutral-700 text-neutral-200 h-9"
                                placeholder="Optional description"
                              />
                            </div>
                          </div>

                          <div className="rounded-lg border border-neutral-800 bg-neutral-900/70 p-3 space-y-3">
                            <p className="text-[11px] uppercase tracking-wide text-neutral-400">Pricing</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[11px] text-neutral-500">Base Currency</Label>
                                <Input
                                  value="INR - Indian Rupee"
                                  readOnly
                                  className="bg-neutral-800 border-neutral-700 text-neutral-300 h-9"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[11px] text-neutral-500">Original Price</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  value={showBlankForZero(draft.original_price)}
                                  onChange={(e) => updatePlanPricingDraft(plan.id, 'original_price', e.target.value)}
                                  className="bg-neutral-800 border-neutral-700 text-white h-9"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[11px] text-neutral-500">Current Price</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  value={showBlankForZero(draft.price)}
                                  onChange={(e) => updatePlanPricingDraft(plan.id, 'price', e.target.value)}
                                  className="bg-neutral-800 border-neutral-700 text-white h-9"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[11px] text-neutral-500">Discount %</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={showBlankForZero(draft.discount_percent)}
                                  onChange={(e) => updatePlanPricingDraft(plan.id, 'discount_percent', e.target.value)}
                                  className="bg-neutral-800 border-neutral-700 text-white h-9"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[11px] text-neutral-500">Discount Label</Label>
                                <Input
                                  type="text"
                                  value={draft.discount_label ?? ''}
                                  onChange={(e) => updatePlanDraft(plan.id, 'discount_label', e.target.value)}
                                  disableAutoSanitize
                                  className="bg-neutral-800 border-neutral-700 text-white h-9"
                                  placeholder="Example: 20% OFF"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[11px] text-neutral-500">Extra Lead Price</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  value={showBlankForZero(draft.extra_lead_price)}
                                  onChange={(e) => updatePlanDraft(plan.id, 'extra_lead_price', e.target.value)}
                                  className="bg-neutral-800 border-neutral-700 text-white h-9"
                                  placeholder="Applied when buying extra lead"
                                />
                              </div>
                            </div>
                            <div className="text-xs text-neutral-400">
                              Preview: {showOldPrice ? `${formatPlanMoney(oldPrice, currency)} -> ` : ''}
                              {formatPlanMoney(nowPrice, currency)}
                              {showPercent ? ` (${discountPercent}% OFF)` : ''}
                              <span className="text-neutral-500"> · {currencyMeta.code}</span>
                            </div>
                            {renderRegionalPricesEditor({
                              rows: draft.regional_prices,
                              idPrefix: `plan-${plan.id}`,
                              onChange: (nextRows) => updatePlanDraft(plan.id, 'regional_prices', nextRows),
                            })}
                          </div>

                          <div className="rounded-lg border border-neutral-800 bg-neutral-900/70 p-3 space-y-3">
                            <div>
                              <p className="text-[11px] uppercase tracking-wide text-neutral-300">Lead Unlock Limits</p>
                              <p className="mt-1 text-xs leading-5 text-neutral-500">
                                Included lead quota. Daily is the per-day unlock cap, weekly is the total cap for the week.
                              </p>
                            </div>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[11px] text-neutral-500">Daily unlocks</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  value={draft.daily_limit ?? 0}
                                  onChange={(e) => updatePlanDraft(plan.id, 'daily_limit', e.target.value)}
                                  className="bg-neutral-800 border-neutral-700 text-white h-9"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[11px] text-neutral-500">Weekly unlocks</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  value={draft.weekly_limit ?? 0}
                                  onChange={(e) => updatePlanDraft(plan.id, 'weekly_limit', e.target.value)}
                                  className="bg-neutral-800 border-neutral-700 text-white h-9"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[11px] text-neutral-500">Yearly unlocks</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  value={draft.yearly_limit ?? 0}
                                  onChange={(e) => updatePlanDraft(plan.id, 'yearly_limit', e.target.value)}
                                  className="bg-neutral-800 border-neutral-700 text-white h-9"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[11px] text-neutral-500">Duration (days)</Label>
                                <Input
                                  type="number"
                                  min="1"
                                  value={draft.duration_days ?? 365}
                                  onChange={(e) => updatePlanDraft(plan.id, 'duration_days', e.target.value)}
                                  className="bg-neutral-800 border-neutral-700 text-white h-9"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="rounded-lg border border-neutral-800 bg-neutral-900/70 p-3 space-y-3">
                            <div>
                              <p className="text-[11px] uppercase tracking-wide text-neutral-300">Search Coverage Limits</p>
                              <p className="mt-1 text-xs leading-5 text-neutral-500">
                                Vendor products appear in search only for the selected states and cities under Plan Business Preferences.
                              </p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[11px] text-neutral-500">Target states allowed</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  value={draft.states_limit ?? 0}
                                  onChange={(e) => updatePlanDraft(plan.id, 'states_limit', e.target.value)}
                                  className="bg-neutral-800 border-neutral-700 text-white h-9"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[11px] text-neutral-500">Target cities allowed</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  value={draft.cities_limit ?? 0}
                                  onChange={(e) => updatePlanDraft(plan.id, 'cities_limit', e.target.value)}
                                  className="bg-neutral-800 border-neutral-700 text-white h-9"
                                />
                              </div>
                            </div>
                            <div className="text-xs text-neutral-500">
                              Search rule: up to {Number(draft.states_limit || 0)} selected states and {Number(draft.cities_limit || 0)} selected cities.
                            </div>
                          </div>

                          <div className="rounded-lg border border-neutral-800 bg-neutral-900/70 p-3 space-y-3">
                            <div>
                              <p className="text-[11px] uppercase tracking-wide text-neutral-300">Purchase & Plan Page</p>
                              <p className="mt-1 text-xs leading-5 text-neutral-500">
                                Direct plans can be bought by vendors. Sales-assisted plans are handled by the sales team.
                              </p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[11px] text-neutral-500">Activation flow</Label>
                                <Select
                                  value={draft.purchase_channel || 'DIRECT'}
                                  onValueChange={(value) => {
                                    updatePlanDraft(plan.id, 'purchase_channel', value);
                                    updatePlanDraft(plan.id, 'public_purchase_enabled', value !== 'SALES_ASSISTED');
                                    updatePlanDraft(plan.id, 'sales_cta_label', value === 'SALES_ASSISTED' ? 'Talk to sales' : 'Buy online');
                                  }}
                                >
                                  <SelectTrigger className="bg-neutral-800 border-neutral-700 text-white h-9">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-neutral-800 border-neutral-700 text-white">
                                    <SelectItem value="DIRECT">Direct purchase</SelectItem>
                                    <SelectItem value="SALES_ASSISTED">Sales assisted</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[11px] text-neutral-500">CTA label</Label>
                                <Input
                                  value={draft.sales_cta_label ?? ''}
                                  onChange={(e) => updatePlanDraft(plan.id, 'sales_cta_label', e.target.value)}
                                  className="bg-neutral-800 border-neutral-700 text-white h-9"
                                  placeholder="Buy online / Talk to sales"
                                />
                              </div>
                              <div className="flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-950/40 px-3 py-2">
                                <Switch
                                  checked={draft.public_purchase_enabled === true}
                                  disabled={draft.purchase_channel === 'SALES_ASSISTED'}
                                  onCheckedChange={(checked) => updatePlanDraft(plan.id, 'public_purchase_enabled', checked)}
                                />
                                <span className="text-sm text-neutral-300">Vendor can buy online</span>
                              </div>
                            </div>
                          </div>

                          <div className="rounded-lg border border-neutral-800 bg-neutral-900/70 p-3 space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-[11px] uppercase tracking-wide text-neutral-300">Listing, Trust & Visibility</p>
                                <p className="mt-1 text-xs leading-5 text-neutral-500">
                                  These options control ranking copy, badges, top slots and public trust signals.
                                </p>
                              </div>
                              <Badge variant="secondary" className="bg-neutral-800 text-neutral-300">
                                {Number(draft.listing_top_slots || 0)} slots
                              </Badge>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[11px] text-neutral-500">Search ranking text</Label>
                                <Input
                                  value={draft.listing_ranking_label ?? ''}
                                  onChange={(e) => updatePlanDraft(plan.id, 'listing_ranking_label', e.target.value)}
                                  className="bg-neutral-800 border-neutral-700 text-white h-9"
                                  placeholder="All Certified member"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[11px] text-neutral-500">Top placement slots</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  value={draft.listing_top_slots ?? 0}
                                  onChange={(e) => updatePlanDraft(plan.id, 'listing_top_slots', e.target.value)}
                                  className="bg-neutral-800 border-neutral-700 text-white h-9"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                              {[
                                ['listing_highlight', 'Highlighted listing'],
                                ['listing_featured', 'Featured listing'],
                                ['listing_category_top_ranking', 'Category top ranking'],
                                ['listing_verified_tick', 'Verified tick on profile'],
                                ['listing_trust_seal', 'KYC trust seal'],
                              ].map(([key, label]) => (
                                <label
                                  key={key}
                                  className="flex min-h-11 flex-row-reverse items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-950/40 px-3 py-2.5 transition-colors hover:border-neutral-700 hover:bg-neutral-900/80"
                                >
                                  <Switch
                                    className="shrink-0"
                                    checked={draft[key] === true}
                                    onCheckedChange={(checked) => updatePlanDraft(plan.id, key, checked)}
                                  />
                                  <span className="min-w-0 flex-1 text-sm leading-5 text-neutral-200">{label}</span>
                                </label>
                              ))}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                            <div className="rounded-lg border border-neutral-800 bg-neutral-900/70 p-3 space-y-3">
                              <p className="text-[11px] uppercase tracking-wide text-neutral-300">Lead Benefits</p>
                              <div className="grid grid-cols-1 gap-2">
                                {[
                                  ['leads_priority', 'Priority leads'],
                                  ['leads_early_access', 'Early access leads'],
                                  ['leads_rfq_access', 'RFQ access'],
                                  ['leads_direct_call_whatsapp', 'Direct call/WhatsApp'],
                                ].map(([key, label]) => (
                                  <label
                                    key={key}
                                    className="flex min-h-11 flex-row-reverse items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-950/40 px-3 py-2.5 transition-colors hover:border-neutral-700 hover:bg-neutral-900/80"
                                  >
                                    <Switch
                                      className="shrink-0"
                                      checked={draft[key] === true}
                                      onCheckedChange={(checked) => updatePlanDraft(plan.id, key, checked)}
                                    />
                                    <span className="min-w-0 flex-1 text-sm leading-5 text-neutral-200">{label}</span>
                                  </label>
                                ))}
                              </div>
                            </div>

                            <div className="rounded-lg border border-neutral-800 bg-neutral-900/70 p-3 space-y-3">
                              <p className="text-[11px] uppercase tracking-wide text-neutral-300">Support & Analytics</p>
                              <div className="grid grid-cols-1 gap-2">
                                <div className="space-y-1">
                                  <Label className="text-[11px] text-neutral-500">Support level</Label>
                                  <Select
                                    value={draft.support_level || 'standard'}
                                    onValueChange={(value) => updatePlanDraft(plan.id, 'support_level', value)}
                                  >
                                    <SelectTrigger className="bg-neutral-800 border-neutral-700 text-white h-9">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-neutral-800 border-neutral-700 text-white">
                                      <SelectItem value="standard">Standard</SelectItem>
                                      <SelectItem value="priority">Priority</SelectItem>
                                      <SelectItem value="dedicated">Dedicated</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[11px] text-neutral-500">SLA hours</Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    value={draft.support_sla_hours ?? 0}
                                    onChange={(e) => updatePlanDraft(plan.id, 'support_sla_hours', e.target.value)}
                                    className="bg-neutral-800 border-neutral-700 text-white h-9"
                                  />
                                </div>
                                {[
                                  ['analytics_enabled', 'Analytics dashboard'],
                                  ['analytics_export_csv', 'Export reports CSV'],
                                ].map(([key, label]) => (
                                  <label
                                    key={key}
                                    className="flex min-h-11 flex-row-reverse items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-950/40 px-3 py-2.5 transition-colors hover:border-neutral-700 hover:bg-neutral-900/80"
                                  >
                                    <Switch
                                      className="shrink-0"
                                      checked={draft[key] === true}
                                      onCheckedChange={(checked) => updatePlanDraft(plan.id, key, checked)}
                                    />
                                    <span className="min-w-0 flex-1 text-sm leading-5 text-neutral-200">{label}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                            <div className="rounded-lg border border-neutral-800 bg-neutral-900/70 p-3 space-y-3">
                              <p className="text-[11px] uppercase tracking-wide text-neutral-300">Portfolio & SEO</p>
                              <div className="grid grid-cols-1 gap-2">
                                <div className="space-y-1">
                                  <Label className="text-[11px] text-neutral-500">Portfolio template</Label>
                                  <Select
                                    value={draft.portfolio_template || 'STANDARD'}
                                    onValueChange={(value) => updatePlanDraft(plan.id, 'portfolio_template', value)}
                                  >
                                    <SelectTrigger className="bg-neutral-800 border-neutral-700 text-white h-9">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-neutral-800 border-neutral-700 text-white">
                                      <SelectItem value="STANDARD">Standard</SelectItem>
                                      <SelectItem value="PREMIUM">Premium portfolio</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[11px] text-neutral-500">Sitemap URL boost</Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    value={draft.sitemap_url_boost ?? 0}
                                    onChange={(e) => updatePlanDraft(plan.id, 'sitemap_url_boost', e.target.value)}
                                    className="bg-neutral-800 border-neutral-700 text-white h-9"
                                  />
                                </div>
                                {[
                                  ['portfolio_customizable', 'Vendor can customize page'],
                                  ['custom_url_enabled', 'Custom profile URL'],
                                  ['portfolio_custom_sections', 'Custom profile sections'],
                                  ['sitemap_customization', 'Custom sitemap pages'],
                                  ['seo_enabled', 'SEO-ready profile'],
                                ].map(([key, label]) => (
                                  <label
                                    key={key}
                                    className="flex min-h-11 flex-row-reverse items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-950/40 px-3 py-2.5 transition-colors hover:border-neutral-700 hover:bg-neutral-900/80"
                                  >
                                    <Switch
                                      className="shrink-0"
                                      checked={draft[key] === true}
                                      onCheckedChange={(checked) => updatePlanDraft(plan.id, key, checked)}
                                    />
                                    <span className="min-w-0 flex-1 text-sm leading-5 text-neutral-200">{label}</span>
                                  </label>
                                ))}
                                <div className="space-y-1">
                                  <Label className="text-[11px] text-neutral-500">SEO URL aliases</Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    value={draft.seo_url_aliases ?? 0}
                                    onChange={(e) => updatePlanDraft(plan.id, 'seo_url_aliases', e.target.value)}
                                    className="bg-neutral-800 border-neutral-700 text-white h-9"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[11px] text-neutral-500">City/category SEO pages</Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    value={draft.seo_city_category_pages ?? 0}
                                    onChange={(e) => updatePlanDraft(plan.id, 'seo_city_category_pages', e.target.value)}
                                    className="bg-neutral-800 border-neutral-700 text-white h-9"
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="rounded-lg border border-neutral-800 bg-neutral-900/70 p-3 space-y-3">
                              <p className="text-[11px] uppercase tracking-wide text-neutral-300">Certificate</p>
                              <div className="grid grid-cols-1 gap-2">
                                <label className="flex min-h-11 flex-row-reverse items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-950/40 px-3 py-2.5 transition-colors hover:border-neutral-700 hover:bg-neutral-900/80">
                                  <Switch
                                    className="shrink-0"
                                    checked={draft.certificate_enabled === true}
                                    onCheckedChange={(checked) => updatePlanDraft(plan.id, 'certificate_enabled', checked)}
                                  />
                                  <span className="min-w-0 flex-1 text-sm leading-5 text-neutral-200">Professional certificate</span>
                                </label>
                                <div className="space-y-1">
                                  <Label className="text-[11px] text-neutral-500">Certificate tier</Label>
                                  <Select
                                    value={draft.certificate_tier || 'NONE'}
                                    onValueChange={(value) => updatePlanDraft(plan.id, 'certificate_tier', value === 'NONE' ? '' : value)}
                                  >
                                    <SelectTrigger className="bg-neutral-800 border-neutral-700 text-white h-9">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-neutral-800 border-neutral-700 text-white">
                                      <SelectItem value="NONE">None</SelectItem>
                                      <SelectItem value="CERTIFIED">Certified</SelectItem>
                                      <SelectItem value="SILVER">Silver</SelectItem>
                                      <SelectItem value="GOLD">Gold</SelectItem>
                                      <SelectItem value="DIAMOND">Diamond</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[11px] text-neutral-500">Certificate title</Label>
                                  <Input
                                    value={draft.certificate_title ?? ''}
                                    onChange={(e) => updatePlanDraft(plan.id, 'certificate_title', e.target.value)}
                                    className="bg-neutral-800 border-neutral-700 text-white h-9"
                                    placeholder="Diamond Vendor on IndianTradeMart"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[11px] text-neutral-500">Certificate badge label</Label>
                                  <Input
                                    value={draft.certificate_label ?? ''}
                                    onChange={(e) => updatePlanDraft(plan.id, 'certificate_label', e.target.value)}
                                    className="bg-neutral-800 border-neutral-700 text-white h-9"
                                    placeholder="Diamond Vendor"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="rounded-lg border border-neutral-800 bg-neutral-900/70 p-3 space-y-3">
                            <p className="text-[11px] uppercase tracking-wide text-neutral-400">Badge & Visibility</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[11px] text-neutral-500">Badge Label</Label>
                                <Input
                                  value={draft.badge_label ?? ''}
                                  onChange={(e) => updatePlanDraft(plan.id, 'badge_label', e.target.value)}
                                  className="bg-neutral-800 border-neutral-700 text-white h-9"
                                  placeholder="Badge label"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[11px] text-neutral-500">Badge Variant</Label>
                                <Select
                                  value={draft.badge_variant || 'neutral'}
                                  onValueChange={(value) => updatePlanDraft(plan.id, 'badge_variant', value)}
                                >
                                  <SelectTrigger className="bg-neutral-800 border-neutral-700 text-white h-9">
                                    <SelectValue placeholder="Badge variant" />
                                  </SelectTrigger>
                                  <SelectContent className="bg-neutral-800 border-neutral-700 text-white">
                                    {PLAN_BADGE_VARIANTS.map((variant) => (
                                      <SelectItem key={variant} value={variant}>
                                        {variant}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={draft.is_active === true}
                                onCheckedChange={(checked) => updatePlanDraft(plan.id, 'is_active', checked)}
                              />
                              <span className="text-sm text-neutral-300">
                                {draft.is_active ? 'Plan is visible to vendors' : 'Plan is hidden from vendors'}
                              </span>
                            </div>
                          </div>

                          <div className="flex justify-end">
                            <Button
                              size="sm"
                              onClick={() => savePlan(plan.id)}
                              disabled={saving || deleting || savingAllPlans || deletingSelectedPlans}
                              className="bg-emerald-700 hover:bg-emerald-600 w-full sm:w-auto"
                            >
                              {saving ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <Save className="h-4 w-4 mr-1" />
                              )}
                              {saving ? '' : 'Save Changes'}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="finance" className="space-y-4">
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => exportPaymentsCsv(financePayments)}
                disabled={financePayments.length === 0}
                className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button
                variant="outline"
                onClick={fetchFinance}
                className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${financeLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { title: 'Total Gross', value: financeSummary.totalGross },
                { title: 'Total Net', value: financeSummary.totalNet },
                { title: 'Last 30 Days', value: financeSummary.last30 },
              ].map((card) => (
                <Card key={card.title} className="bg-neutral-900 border-neutral-800">
                  <CardHeader>
                    <CardTitle className="text-neutral-300 text-sm">{card.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-3xl font-semibold flex items-center gap-2 text-white">
                    <IndianRupee className="h-5 w-5 text-emerald-500" />
                    {money(card.value)}
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="bg-neutral-900 border-neutral-800">
              <CardHeader>
                <CardTitle className="text-white">Recent Payments</CardTitle>
                <CardDescription className="text-neutral-400">
                  Vendor payments and subscriptions.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border border-neutral-800 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-neutral-800">
                      <TableRow>
                        <TableHead className="text-neutral-300">Vendor</TableHead>
                        <TableHead className="text-neutral-300">Plan</TableHead>
                        <TableHead className="text-neutral-300">Gross</TableHead>
                        <TableHead className="text-neutral-300">Net</TableHead>
                        <TableHead className="text-neutral-300">Coupon</TableHead>
                        <TableHead className="text-neutral-300">Date</TableHead>
                        <TableHead className="text-neutral-300">Transaction</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {financePayments.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-neutral-500 py-10">
                            {financeLoading ? 'Loading payments...' : 'No payments found'}
                          </TableCell>
                        </TableRow>
                      ) : (
                        financePayments.slice(0, 200).map((p) => (
                          <TableRow key={p.id} className="hover:bg-neutral-800/50">
                            <TableCell>
                              <div className="text-white font-medium">
                                {p.vendor?.company_name || p.vendor_id}
                              </div>
                              <div className="text-xs text-neutral-500">
                                {p.vendor?.email || ''}
                              </div>
                            </TableCell>
                            <TableCell className="text-neutral-300">
                              {p.plan?.name || p.plan_id || '—'}
                            </TableCell>
                            <TableCell className="text-neutral-300">₹{money(p.amount)}</TableCell>
                            <TableCell className="text-neutral-300">
                              ₹{money(p.net_amount ?? p.amount)}
                            </TableCell>
                            <TableCell className="text-neutral-300">{p.coupon_code || '—'}</TableCell>
                            <TableCell className="text-neutral-400 text-xs">
                              {formatDateTime(p.payment_date)}
                            </TableCell>
                            <TableCell className="text-neutral-400 text-xs font-mono">
                              {p.transaction_id || '—'}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══════════════════════════════════════════════════════
              MONITORING TAB
          ═══════════════════════════════════════════════════════ */}
          <TabsContent value="monitoring" className="space-y-6">

            {/* All-India Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                {
                  label: 'Total Revenue',
                  icon: <IndianRupee className="h-5 w-5 text-green-400" />,
                  value: monitoringOverview
                    ? `₹ ${Number(monitoringOverview.allIndia.totalRevenue).toLocaleString('en-IN')}`
                    : '—',
                  sub: 'All India',
                  color: 'text-green-400',
                },
                {
                  label: 'Active Vendors',
                  icon: <Building2 className="h-5 w-5 text-blue-400" />,
                  value: monitoringOverview ? monitoringOverview.allIndia.totalVendors : '—',
                  sub: 'All India',
                  color: 'text-blue-400',
                },
                {
                  label: 'KYC Pending',
                  icon: <Clock className="h-5 w-5 text-yellow-400" />,
                  value: monitoringOverview ? monitoringOverview.allIndia.kycPending : '—',
                  sub: 'Awaiting review',
                  color: monitoringOverview?.allIndia.kycPending > 20 ? 'text-red-400' : 'text-yellow-400',
                },
                {
                  label: 'Open Complaints',
                  icon: <AlertTriangle className="h-5 w-5 text-orange-400" />,
                  value: monitoringOverview ? monitoringOverview.allIndia.openTickets : '—',
                  sub: 'Unresolved tickets',
                  color: monitoringOverview?.allIndia.openTickets > 50 ? 'text-red-400' : 'text-orange-400',
                },
              ].map((card) => (
                <Card key={card.label} className="bg-neutral-900 border-neutral-800">
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-center gap-2 mb-1">{card.icon}<span className="text-neutral-400 text-xs">{card.label}</span></div>
                    <div className={`text-2xl font-bold ${card.color}`}>{monitoringLoading ? '...' : card.value}</div>
                    <div className="text-neutral-500 text-xs mt-1">{card.sub}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <WebsiteVisitorActivityCard
              events={visitorActivity.events || []}
              stats={visitorActivity.stats || {}}
              loading={visitorActivityLoading}
              onRefresh={() => fetchVisitorActivity(monitoringActivityDays)}
              dark
              technical={isGodMode}
              title="Website Visitor Intelligence"
              description="Public website visits, searches, product/vendor views, and captured contact context."
            />

            {/* Admin Activity Monitor */}
            <Card className="bg-neutral-900 border-neutral-800">
              <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Activity className="h-5 w-5 text-purple-400" /> Admin Activity Monitor
                  </CardTitle>
                  <CardDescription className="text-neutral-400">
                    Kaun kya kar rha hai — per admin breakdown
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={String(monitoringActivityDays)}
                    onValueChange={(v) => {
                      const d = Number(v);
                      setMonitoringActivityDays(d);
                      fetchMonitoring(d);
                    }}
                  >
                    <SelectTrigger className="bg-neutral-800 border-neutral-700 text-white w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-neutral-800 border-neutral-700 text-white">
                      <SelectItem value="7">Last 7 days</SelectItem>
                      <SelectItem value="14">Last 14 days</SelectItem>
                      <SelectItem value="30">Last 30 days</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-neutral-700 text-neutral-300"
                    onClick={() => fetchMonitoring(monitoringActivityDays)}
                    disabled={monitoringLoading}
                  >
                    <RefreshCw className={`h-4 w-4 ${monitoringLoading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {monitoringLoading ? (
                  <div className="text-neutral-400 text-sm py-8 text-center">Loading...</div>
                ) : !monitoringActivity?.activity?.length ? (
                  <div className="text-neutral-500 text-sm py-8 text-center">No ADMIN employees found.</div>
                ) : (
                  <div className="space-y-4">
                    {(monitoringActivity?.activity || []).map((admin) => {
                      const lastActive = admin.last_login ? new Date(admin.last_login) : null;
                      const hoursSince = lastActive ? (Date.now() - lastActive.getTime()) / 3_600_000 : null;
                      const inactive = hoursSince !== null && hoursSince > 48;
                      const scope = Array.isArray(admin.states_scope) && admin.states_scope.length > 0
                        ? admin.states_scope.join(', ')
                        : <span className="text-yellow-500 text-xs">No states assigned</span>;

                      return (
                        <div
                          key={admin.id}
                          className={`rounded-lg border p-4 space-y-3 ${inactive ? 'border-red-800 bg-red-950/20' : 'border-neutral-800 bg-neutral-800/40'}`}
                        >
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-white font-semibold">{admin.full_name || admin.email}</span>
                                {inactive && (
                                  <Badge className="bg-red-900 text-red-300 text-xs">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    {Math.floor(hoursSince / 24)}d inactive
                                  </Badge>
                                )}
                                {!inactive && lastActive && (
                                  <Badge className="bg-green-900/40 text-green-400 text-xs">Active</Badge>
                                )}
                              </div>
                              <div className="text-neutral-400 text-xs mt-0.5">
                                {admin.email} &nbsp;·&nbsp; Last login: {lastActive ? lastActive.toLocaleString() : 'Never'}
                              </div>
                              <div className="text-neutral-500 text-xs mt-0.5 flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                States: {scope}
                                <button
                                  className="ml-2 text-blue-400 hover:text-blue-300 underline text-xs"
                                  onClick={() => {
                                    setStatesScopeTarget(admin);
                                    setStatesScopeSelection(Array.isArray(admin.state_scope_ids) ? admin.state_scope_ids.map((id) => String(id)) : []);
                                    setStatesScopeModalOpen(true);
                                  }}
                                >
                                  Edit
                                </button>
                              </div>
                            </div>
                            <Badge className="bg-neutral-700 text-neutral-200 text-xs">
                              {admin.actionsTotal} actions in {monitoringActivityDays}d
                            </Badge>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                            {[
                              { label: 'KYC Approved', val: admin.kycApproved, good: true },
                              { label: 'KYC Rejected', val: admin.kycRejected, neutral: true },
                              { label: 'Vendors Terminated', val: admin.vendorsTerminated, warn: admin.vendorsTerminated > 5 },
                              { label: 'Vendors Activated', val: admin.vendorsActivated, good: true },
                              { label: 'Staff Created', val: admin.staffCreated, neutral: true },
                              { label: 'Tickets Resolved', val: admin.ticketsResolved, good: true },
                            ].map((stat) => (
                              <div key={stat.label} className="bg-neutral-900 rounded p-2 text-center">
                                <div className={`text-lg font-bold ${stat.good ? 'text-green-400' : stat.warn ? 'text-red-400' : 'text-neutral-300'}`}>
                                  {stat.val}
                                </div>
                                <div className="text-neutral-500 text-xs leading-tight">{stat.label}</div>
                              </div>
                            ))}
                          </div>

                          {/* Region stats (if states assigned) */}
                          {admin.revenue !== null && (
                            <div className="flex flex-wrap gap-3 text-xs text-neutral-400 border-t border-neutral-700 pt-2">
                              <span>💰 Revenue: <span className="text-green-400 font-medium">₹{Number(admin.revenue).toLocaleString('en-IN')}</span></span>
                              <span>🏢 Vendors: <span className="text-blue-400 font-medium">{admin.vendors}</span></span>
                              <span>📋 KYC Pending: <span className={admin.kycPending > 10 ? 'text-red-400 font-medium' : 'text-yellow-400 font-medium'}>{admin.kycPending}</span></span>
                              <span>🎧 Open Tickets: <span className={admin.openTickets > 30 ? 'text-red-400 font-medium' : 'text-orange-400 font-medium'}>{admin.openTickets}</span></span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Region Summary Table */}
            {monitoringOverview?.byRegion?.length > 0 && (
              <Card className="bg-neutral-900 border-neutral-800">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-blue-400" /> Region-wise Summary
                  </CardTitle>
                  <CardDescription className="text-neutral-400">Revenue, vendors, complaints, KYC by region</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-neutral-800 hover:bg-transparent">
                          <TableHead className="text-neutral-400">Region</TableHead>
                          <TableHead className="text-neutral-400 text-right">Revenue</TableHead>
                          <TableHead className="text-neutral-400 text-right">Vendors</TableHead>
                          <TableHead className="text-neutral-400 text-right">KYC Pending</TableHead>
                          <TableHead className="text-neutral-400 text-right">Open Tickets</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(monitoringOverview.byRegion || []).map((r) => (
                          <TableRow key={r.region} className="border-neutral-800 hover:bg-neutral-800/40">
                            <TableCell className="text-white font-medium">
                              {r.region}
                              <div className="text-neutral-500 text-xs">{(r.states || []).slice(0, 5).join(', ')}{r.states?.length > 5 ? '…' : ''}</div>
                            </TableCell>
                            <TableCell className="text-green-400 font-semibold text-right">
                              ₹{Number(r.revenue).toLocaleString('en-IN')}
                            </TableCell>
                            <TableCell className="text-blue-400 text-right">{r.vendors}</TableCell>
                            <TableCell className="text-right">
                              <span className={r.kycPending > 20 ? 'text-red-400 font-semibold' : r.kycPending > 10 ? 'text-yellow-400' : 'text-neutral-300'}>
                                {r.kycPending}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className={r.openTickets > 50 ? 'text-red-400 font-semibold' : r.openTickets > 20 ? 'text-orange-400' : 'text-neutral-300'}>
                                {r.openTickets}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Revenue by State Table */}
            <Card className="bg-neutral-900 border-neutral-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <IndianRupee className="h-5 w-5 text-green-400" /> Revenue by State
                </CardTitle>
                <CardDescription className="text-neutral-400">This month vs last month, state-wise breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                {monitoringLoading ? (
                  <div className="text-neutral-400 text-sm py-6 text-center">Loading...</div>
                ) : !monitoringRevenue.length ? (
                  <div className="text-neutral-500 text-sm py-6 text-center">No payment data available.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-neutral-800 hover:bg-transparent">
                          <TableHead className="text-neutral-400">State</TableHead>
                          <TableHead className="text-neutral-400">Region</TableHead>
                          <TableHead className="text-neutral-400 text-right">Total Revenue</TableHead>
                          <TableHead className="text-neutral-400 text-right">Payments</TableHead>
                          <TableHead className="text-neutral-400 text-right">This Month</TableHead>
                          <TableHead className="text-neutral-400 text-right">Last Month</TableHead>
                          <TableHead className="text-neutral-400 text-right">Trend</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {monitoringRevenue.slice(0, 30).map((s) => (
                          <TableRow key={s.state} className="border-neutral-800 hover:bg-neutral-800/40">
                            <TableCell className="text-white font-medium">{s.state}</TableCell>
                            <TableCell>
                              <Badge className="bg-neutral-700 text-neutral-300 text-xs">{s.region}</Badge>
                            </TableCell>
                            <TableCell className="text-green-400 font-semibold text-right">
                              ₹{Number(s.totalRevenue).toLocaleString('en-IN')}
                            </TableCell>
                            <TableCell className="text-neutral-300 text-right">{s.paymentCount}</TableCell>
                            <TableCell className="text-blue-300 text-right">
                              ₹{Number(s.thisMonth).toLocaleString('en-IN')}
                            </TableCell>
                            <TableCell className="text-neutral-400 text-right">
                              ₹{Number(s.lastMonth).toLocaleString('en-IN')}
                            </TableCell>
                            <TableCell className="text-right">
                              {s.trend === null ? (
                                <span className="text-neutral-600 text-xs">—</span>
                              ) : s.trend > 0 ? (
                                <span className="text-green-400 flex items-center justify-end gap-1 text-xs">
                                  <TrendingUp className="h-3 w-3" /> +{s.trend.toFixed(1)}%
                                </span>
                              ) : s.trend < 0 ? (
                                <span className="text-red-400 flex items-center justify-end gap-1 text-xs">
                                  <TrendingDown className="h-3 w-3" /> {s.trend.toFixed(1)}%
                                </span>
                              ) : (
                                <span className="text-neutral-500 flex items-center justify-end gap-1 text-xs">
                                  <Minus className="h-3 w-3" /> 0%
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* States Scope Edit Modal */}
            <Dialog
              open={statesScopeModalOpen}
              onOpenChange={(o) => {
                if (!o) {
                  setStatesScopeModalOpen(false);
                  setStatesScopeTarget(null);
                  setStatesScopeSelection([]);
                }
              }}
            >
              <DialogContent className="bg-neutral-900 border-neutral-700 text-white w-[32vw]">
                <DialogHeader>
                  <DialogTitle>Edit States Scope</DialogTitle>
                  <DialogDescription className="text-neutral-400">
                    {statesScopeTarget?.full_name} ko DB-backed states assign karo. Empty selection ka matlab All India access hai.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div>
                    <Label className="text-neutral-300 text-sm">States</Label>
                    <div className="mt-2">
                      {renderStateScopeSelector({
                        selectedIds: statesScopeSelection,
                        onChange: setStatesScopeSelection,
                        helperText: 'Select one or more states. Leave empty to keep this admin on all-India coverage.',
                      })}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      className="border-neutral-700 text-neutral-300"
                      onClick={() => {
                        setStatesScopeModalOpen(false);
                        setStatesScopeTarget(null);
                        setStatesScopeSelection([]);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="bg-blue-700 hover:bg-blue-600 text-white"
                      onClick={saveStatesScope}
                      disabled={statesScopeSaving}
                    >
                      {statesScopeSaving ? 'Saving…' : 'Save'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

          </TabsContent>

          <TabsContent value="behavioral" className="space-y-6">
            <Card className="bg-neutral-900 border-neutral-800">
              <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
                <div>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Activity className="h-5 w-5 text-cyan-400" />
                    Behavioral Commerce Intelligence
                  </CardTitle>
                  <CardDescription className="text-neutral-400">
                    Visitor events se demand score, sales forecast, aur vendor intelligence nikalta hai.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={String(behavioralIntelDays)}
                    onValueChange={(value) => fetchBehavioralIntel({ days: Number(value) })}
                  >
                    <SelectTrigger className="bg-neutral-800 border-neutral-700 text-white w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-neutral-800 border-neutral-700 text-white">
                      <SelectItem value="7">Last 7 days</SelectItem>
                      <SelectItem value="30">Last 30 days</SelectItem>
                      <SelectItem value="60">Last 60 days</SelectItem>
                      <SelectItem value="90">Last 90 days</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    className="border-neutral-700 text-neutral-300"
                    onClick={() => fetchBehavioralIntel({ days: behavioralIntelDays, refresh: true })}
                    disabled={behavioralIntelLoading}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${behavioralIntelLoading ? 'animate-spin' : ''}`} />
                    Recompute
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
                  {(behavioralIntel?.algorithm?.modules || [
                    'Visitor Identity & Consent Tracking',
                    'Event-Based Ecommerce Analytics',
                    'Product/Category Demand Scoring',
                    'Sales Forecasting & Vendor Intelligence',
                  ]).map((module, index) => (
                    <div key={module} className="rounded-lg border border-neutral-800 bg-neutral-950 p-4">
                      <div className="text-cyan-300 text-xs font-mono mb-2">MODULE {index + 1}</div>
                      <div className="text-white font-semibold leading-snug">{module}</div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Tracked events', value: behavioralIntel?.summary?.total_events || 0, hint: `${behavioralIntelDays} days` },
                    { label: 'Search intent', value: behavioralIntel?.summary?.searches || 0, hint: 'Product/category searches' },
                    { label: 'Hot demand', value: behavioralIntel?.summary?.hot_demands || 0, hint: 'High conversion signal' },
                    { label: 'Avg 30d forecast', value: behavioralIntel?.summary?.avg_forecast_30d || 0, hint: 'Predicted weighted demand' },
                  ].map((card) => (
                    <Card key={card.label} className="bg-neutral-950 border-neutral-800">
                      <CardContent className="pt-5 pb-4">
                        <div className="text-neutral-400 text-xs">{card.label}</div>
                        <div className="text-2xl font-bold text-white mt-1">
                          {behavioralIntelLoading ? '...' : Number(card.value).toLocaleString('en-IN')}
                        </div>
                        <div className="text-neutral-500 text-xs mt-1">{card.hint}</div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="text-sm font-semibold text-white">Pipeline Health</p>
                      <p className="text-xs text-neutral-500">
                        {'Frontend JS tracker -> API -> Kafka -> ClickHouse -> aggregate job -> demand score -> prediction dashboard'}
                      </p>
                      {behavioralIntel?.summary?.warehouse?.error ? (
                        <p className="text-xs text-amber-300 mt-1">
                          Warehouse fallback: {behavioralIntel.summary.warehouse.error}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge className="bg-blue-950 text-blue-200">
                        Source: {(behavioralIntel?.summary?.source || 'mysql').toUpperCase()}
                      </Badge>
                      <Badge className={behavioralIntel?.summary?.warehouse?.kafka_enabled ? 'bg-purple-950 text-purple-200' : 'bg-neutral-800 text-neutral-300'}>
                        Kafka: {behavioralIntel?.summary?.warehouse?.kafka_enabled ? 'ON' : 'OFF'}
                      </Badge>
                      <Badge className={behavioralIntel?.summary?.warehouse?.clickhouse_enabled ? 'bg-orange-950 text-orange-200' : 'bg-neutral-800 text-neutral-300'}>
                        ClickHouse: {behavioralIntel?.summary?.warehouse?.clickhouse_enabled ? 'ON' : 'OFF'}
                      </Badge>
                      <Badge className="bg-cyan-950 text-cyan-200">
                        Queue pending: {behavioralIntel?.summary?.queue?.pending || 0}
                      </Badge>
                      <Badge className="bg-emerald-950 text-emerald-200">
                        Processed: {behavioralIntel?.summary?.queue?.processed || 0}
                      </Badge>
                      <Badge className="bg-neutral-800 text-neutral-300">
                        Last computed: {behavioralIntel?.summary?.latest_computed_at ? formatDateTime(behavioralIntel.summary.latest_computed_at) : 'Not yet'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 xl:grid-cols-[1.55fr_0.9fr] gap-6">
              <Card className="bg-neutral-900 border-neutral-800">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-emerald-400" />
                    Product & Category Demand Scores
                  </CardTitle>
                  <CardDescription className="text-neutral-400">
                    Searches, product views, vendor views, requirements, leads aur unique visitors ka weighted score.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {behavioralIntelLoading ? (
                    <div className="text-neutral-400 text-sm py-12 text-center">Loading demand intelligence...</div>
                  ) : !(behavioralIntel?.demand_scores || []).length ? (
                    <div className="text-neutral-500 text-sm py-12 text-center">
                      Abhi demand score available nahi hai. Recompute dabao ya tracker data collect hone do.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-neutral-800">
                            <TableHead className="text-neutral-400">Demand</TableHead>
                            <TableHead className="text-neutral-400">Location</TableHead>
                            <TableHead className="text-neutral-400 text-right">Score</TableHead>
                            <TableHead className="text-neutral-400 text-right">Signals</TableHead>
                            <TableHead className="text-neutral-400 text-right">Trend</TableHead>
                            <TableHead className="text-neutral-400">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(behavioralIntel?.demand_scores || []).slice(0, 25).map((row) => {
                            const stageClass = row.demand_stage === 'HOT'
                              ? 'bg-red-950 text-red-200'
                              : row.demand_stage === 'RISING'
                                ? 'bg-emerald-950 text-emerald-200'
                                : row.demand_stage === 'WATCH'
                                  ? 'bg-amber-950 text-amber-200'
                                  : 'bg-neutral-800 text-neutral-300';

                            return (
                              <TableRow key={`${row.demand_key}-${row.window_days}`} className="border-neutral-800 hover:bg-neutral-800/40">
                                <TableCell>
                                  <div className="text-white font-semibold">{row.display_label}</div>
                                  <div className="text-neutral-500 text-xs">{row.category || 'Uncategorized'}</div>
                                </TableCell>
                                <TableCell className="text-neutral-300 text-sm">
                                  {[row.city, row.state].filter(Boolean).join(', ') || 'All India'}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Badge className={stageClass}>{row.demand_stage}</Badge>
                                  <div className="text-white font-semibold mt-1">{Number(row.demand_score || 0).toLocaleString('en-IN')}</div>
                                  <div className="text-neutral-500 text-xs">{row.confidence}% confidence</div>
                                </TableCell>
                                <TableCell className="text-right text-xs text-neutral-400">
                                  <div>{row.search_count} searches</div>
                                  <div>{row.product_views} product views</div>
                                  <div>{row.lead_count + row.requirement_submits} buyer actions</div>
                                </TableCell>
                                <TableCell className="text-right">
                                  {Number(row.trend_percent || 0) > 0 ? (
                                    <span className="text-emerald-400 text-sm flex items-center justify-end gap-1">
                                      <TrendingUp className="h-3 w-3" /> +{Number(row.trend_percent || 0).toFixed(1)}%
                                    </span>
                                  ) : Number(row.trend_percent || 0) < 0 ? (
                                    <span className="text-red-400 text-sm flex items-center justify-end gap-1">
                                      <TrendingDown className="h-3 w-3" /> {Number(row.trend_percent || 0).toFixed(1)}%
                                    </span>
                                  ) : (
                                    <span className="text-neutral-500 text-sm">0%</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-neutral-300 text-xs max-w-xs">
                                  {row.recommended_action}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-neutral-900 border-neutral-800">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-blue-400" />
                    Prediction Engine
                  </CardTitle>
                  <CardDescription className="text-neutral-400">
                    Weighted model v1; future me isi feature data ko LightGBM/XGBoost me plug kar sakte hain.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {behavioralIntelLoading ? (
                    <div className="text-neutral-400 text-sm py-8 text-center">Loading forecasts...</div>
                  ) : !(behavioralIntel?.forecasts || []).length ? (
                    <div className="text-neutral-500 text-sm py-8 text-center">Forecast data not available yet.</div>
                  ) : (
                    (behavioralIntel?.forecasts || []).slice(0, 12).map((row) => {
                      const max = Math.max(...(behavioralIntel?.forecasts || []).map((item) => Number(item.forecast_30d || 0)), 1);
                      const width = Math.max(8, Math.min(100, (Number(row.forecast_30d || 0) / max) * 100));
                      return (
                        <div key={`${row.demand_key}-forecast`} className="rounded-lg border border-neutral-800 bg-neutral-950 p-3">
                          <div className="flex justify-between gap-3">
                            <div>
                              <div className="text-white font-semibold text-sm">{row.display_label}</div>
                              <div className="text-neutral-500 text-xs">{[row.city, row.state].filter(Boolean).join(', ') || 'All India'}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-blue-300 font-semibold">{Number(row.forecast_30d || 0).toLocaleString('en-IN')}</div>
                              <div className="text-neutral-500 text-xs">30d forecast</div>
                            </div>
                          </div>
                          <div className="h-2 bg-neutral-800 rounded-full overflow-hidden mt-3">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${width}%` }} />
                          </div>
                          <div className="flex justify-between text-xs text-neutral-500 mt-2">
                            <span>7d: {Number(row.forecast_7d || 0).toLocaleString('en-IN')}</span>
                            <span>{row.confidence}% confidence</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="search360" className="space-y-4">
            <Search360Workspace
              api={superAdminServerApi.search360}
              impersonationApi={superAdminServerApi.impersonation}
              title="Search 360"
              description="Super Admin view for vendor profile, products, plan, account status, support cases, and cross-team escalation."
              roleLabel={isGodMode ? 'GODMODE' : 'SUPERADMIN'}
              dark
            />
            <SuperAdminBuyerAccessPanel />
          </TabsContent>

          <TabsContent value="audit" className="space-y-4">
            <Card className="bg-neutral-900 border-neutral-800">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-white">Full Audit Log</CardTitle>
                  <CardDescription className="text-neutral-400">
                    Track which admin, employee, or vendor performed each action.
                  </CardDescription>
                </div>
                <Button
                  onClick={() => fetchAuditLogs()}
                  variant="outline"
                  className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                >
                  <RefreshCw className={`h-4 w-4 ${auditLoading ? 'animate-spin' : ''}`} />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-neutral-300">Hours Back</Label>
                    <Input
                      type="number"
                      value={auditFilters.hoursBack}
                      onChange={(e) =>
                        setAuditFilters((prev) => ({
                          ...prev,
                          hoursBack: Number(e.target.value) || 24,
                        }))
                      }
                      className="bg-neutral-800 border-neutral-700 text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-neutral-300">Limit</Label>
                    <Input
                      type="number"
                      value={auditFilters.limit}
                      onChange={(e) =>
                        setAuditFilters((prev) => ({
                          ...prev,
                          limit: Number(e.target.value) || 100,
                        }))
                      }
                      className="bg-neutral-800 border-neutral-700 text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-neutral-300">Actor Type</Label>
                    <Select
                      value={auditFilters.actor_type}
                      onValueChange={(value) =>
                        setAuditFilters((prev) => ({ ...prev, actor_type: value }))
                      }
                    >
                      <SelectTrigger className="bg-neutral-800 border-neutral-700 text-white">
                        <SelectValue placeholder="Actor" />
                      </SelectTrigger>
                      <SelectContent className="bg-neutral-800 border-neutral-700 text-white">
                        <SelectItem value="ALL">All</SelectItem>
                        <SelectItem value="SUPERADMIN">Superadmin</SelectItem>
                        <SelectItem value="EMPLOYEE">Employee</SelectItem>
                        <SelectItem value="VENDOR">Vendor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-neutral-300">Action Contains</Label>
                    <Input
                      value={auditFilters.action_contains}
                      onChange={(e) =>
                        setAuditFilters((prev) => ({
                          ...prev,
                          action_contains: e.target.value,
                        }))
                      }
                      className="bg-neutral-800 border-neutral-700 text-white"
                      placeholder="Example: STAFF, PAYMENT, VENDOR"
                    />
                  </div>
                  <div className="md:col-span-4 flex justify-end">
                    <Button
                      onClick={() => fetchAuditLogs(auditFilters)}
                      className="bg-amber-600 hover:bg-amber-700"
                      disabled={auditLoading}
                    >
                      {auditLoading ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <History className="h-4 w-4 mr-2" />
                      )}
                      Apply Filters
                    </Button>
                  </div>
                </div>

                <div className="rounded-md border border-neutral-800 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-neutral-800">
                      <TableRow>
                        <TableHead className="text-neutral-300">When</TableHead>
                        <TableHead className="text-neutral-300">Actor</TableHead>
                        <TableHead className="text-neutral-300">Action</TableHead>
                        <TableHead className="text-neutral-300">Entity</TableHead>
                        <TableHead className="text-neutral-300">Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-neutral-500 py-10">
                            {auditLoading ? 'Loading audit logs...' : 'No audit logs found'}
                          </TableCell>
                        </TableRow>
                      ) : (
                        auditLogs.map((log) => (
                          <TableRow key={log.id} className="hover:bg-neutral-800/50 align-top">
                            <TableCell className="text-neutral-400 text-xs whitespace-nowrap">
                              {formatDateTime(log.created_at)}
                            </TableCell>
                            <TableCell>
                              <div className="text-white text-sm">
                                {log.actor?.email || log.actor?.id || 'System'}
                              </div>
                              <div className="text-xs text-neutral-500">
                                {log.actor?.type || '—'}{' '}
                                {log.actor?.role ? `• ${log.actor.role}` : ''}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className="text-amber-400 border-amber-900 bg-amber-900/20 font-mono text-xs"
                              >
                                {log.action}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-neutral-300 text-xs font-mono">
                              {log.entity_type}
                              {log.entity_id ? `#${String(log.entity_id).slice(0, 8)}` : ''}
                            </TableCell>
                            <TableCell className="text-neutral-500 text-xs w-[22vw]">
                              {log.details ? JSON.stringify(log.details).slice(0, 180) : '—'}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card className="bg-neutral-900 border-neutral-800 w-[36vw]">
              <CardHeader>
                <CardTitle className="text-white">Super Admin Credentials</CardTitle>
                <CardDescription className="text-neutral-400">
                  Update your master password. This requires the current password.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-neutral-300">Current Password</Label>
                    <Input
                      type="password"
                      value={passwordForm.current}
                      onChange={(e) =>
                        setPasswordForm((prev) => ({ ...prev, current: e.target.value }))
                      }
                      className="bg-neutral-800 border-neutral-700 text-white"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-neutral-300">New Password</Label>
                    <Input
                      type="password"
                      value={passwordForm.new}
                      onChange={(e) =>
                        setPasswordForm((prev) => ({ ...prev, new: e.target.value }))
                      }
                      className="bg-neutral-800 border-neutral-700 text-white"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-neutral-300">Confirm New Password</Label>
                    <Input
                      type="password"
                      value={passwordForm.confirm}
                      onChange={(e) =>
                        setPasswordForm((prev) => ({ ...prev, confirm: e.target.value }))
                      }
                      className="bg-neutral-800 border-neutral-700 text-white"
                      required
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      className="bg-red-800 hover:bg-red-700 text-white"
                      disabled={passwordSaving}
                    >
                      {passwordSaving ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Update Password
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* GOD MODE ONLY — Manage SUPERADMIN accounts */}
          {isGodMode && (
            <TabsContent value="godmode" className="space-y-4">
              <Card className="bg-neutral-900 border-red-900">
                <CardHeader>
                  <CardTitle className="text-red-300 flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5" />
                    Developer Operations
                  </CardTitle>
                  <CardDescription className="text-neutral-400">
                    Live website signals, DB activity, and high-impact platform controls in one workspace.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      ['Website Events', visitorActivity.stats?.total_events || visitorActivity.events?.length || 0],
                      ['Product Visits', visitorActivity.stats?.product_views || 0],
                      ['Unique Visitors', visitorActivity.stats?.unique_visitors || 0],
                      ['DB Updates', auditLogs.length || 0],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-md border border-neutral-800 bg-neutral-950 p-3">
                        <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
                        <p className="mt-1 text-2xl font-bold text-white">{value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                    <div className="rounded-lg border border-neutral-800 bg-neutral-950">
                      <div className="border-b border-neutral-800 px-4 py-3">
                        <p className="text-sm font-semibold text-white">Live DB Activity</p>
                        <p className="text-xs text-neutral-500">Recent writes and admin actions from the audit stream.</p>
                      </div>
                      <div className="divide-y divide-neutral-800">
                        {(auditLogs || []).slice(0, 8).length ? (
                          (auditLogs || []).slice(0, 8).map((log) => (
                            <div key={log.id || `${log.action}-${log.created_at}`} className="flex items-start justify-between gap-3 px-4 py-3 text-xs">
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-neutral-100">{log.action || 'DB_UPDATE'}</p>
                                <p className="mt-1 truncate text-neutral-500">
                                  {log.entity_type || 'record'} {log.entity_id ? `• ${log.entity_id}` : ''}
                                </p>
                              </div>
                              <span className="shrink-0 text-neutral-500">{formatDateTime(log.created_at)}</span>
                            </div>
                          ))
                        ) : (
                          <div className="px-4 py-6 text-center text-sm text-neutral-500">No DB activity loaded.</div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-4">
                      <p className="text-sm font-semibold text-white">Fast Actions</p>
                      <p className="mt-1 text-xs text-neutral-500">Jump to the areas used for most operational fixes.</p>
                      <div className="mt-4 grid gap-2">
                        {[
                          ['System & Pages', 'system'],
                          ['Vendor Control', 'vendors'],
                          ['Plans & Pricing', 'plans'],
                          ['Search 360', 'search360'],
                          ['Visitor Intelligence', 'monitoring'],
                          ['Security', 'settings'],
                          ['Full DB Activity', 'audit'],
                        ].map(([label, tab]) => (
                          <Button
                            key={tab}
                            variant="outline"
                            className="justify-between border-neutral-800 bg-neutral-900 text-neutral-200 hover:bg-neutral-800"
                            onClick={() => handleTabChange(tab)}
                          >
                            {label}
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <WebsiteVisitorActivityCard
                events={visitorActivity.events || []}
                stats={visitorActivity.stats || {}}
                loading={visitorActivityLoading}
                onRefresh={() => fetchVisitorActivity(monitoringActivityDays)}
                dark
                technical
                title="Developer Visitor Feed"
                description="GOD MODE view includes technical context such as user agent and IP for diagnostics."
              />

              <Search360Workspace
                api={superAdminServerApi.search360}
                impersonationApi={superAdminServerApi.impersonation}
                title="Developer Search 360"
                description="GOD MODE view for all-region vendor intelligence, escalations, and operational diagnostics."
                roleLabel="GODMODE"
                dark
              />
              <SuperAdminBuyerAccessPanel title="Developer Buyer Dashboard Access" />

              <Card className="bg-neutral-900 border-red-900">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-red-400 flex items-center gap-2">
                      <ShieldAlert className="h-5 w-5" /> Super Admin Accounts (ITM Owner)
                    </CardTitle>
                    <CardDescription className="text-neutral-400">
                      Only you (GOD MODE) can create, deactivate, or delete SUPERADMIN accounts.
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    className="border-red-800 text-red-400 hover:bg-red-950"
                    onClick={openSuperadminModal}
                  >
                    <Plus className="h-4 w-4 mr-2" /> Add SuperAdmin
                  </Button>
                </CardHeader>
                <CardContent>
                  {superadminsLoading ? (
                    <p className="text-neutral-400 text-sm">Loading...</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="border-neutral-800">
                          <TableHead className="text-neutral-400">Email</TableHead>
                          <TableHead className="text-neutral-400">Role</TableHead>
                          <TableHead className="text-neutral-400">Status</TableHead>
                          <TableHead className="text-neutral-400">Last Login</TableHead>
                          <TableHead className="text-neutral-400">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(superadminsList || []).map((sa) => (
                          <TableRow key={sa.id} className="border-neutral-800">
                            <TableCell className="text-white">{sa.email}</TableCell>
                            <TableCell>
                              <Badge className={sa.role === 'GODMODE' ? 'bg-red-900 text-red-200' : 'bg-yellow-900 text-yellow-200'}>
                                {sa.role === 'GODMODE' ? 'GOD MODE' : 'SUPERADMIN'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={sa.is_active ? 'bg-green-900 text-green-300' : 'bg-neutral-700 text-neutral-400'}>
                                {sa.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-neutral-400 text-sm">{formatDateTime(sa.last_login)}</TableCell>
                            <TableCell className="flex gap-2">
                              {sa.role !== 'GODMODE' && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-neutral-700 text-neutral-300 text-xs"
                                    onClick={async () => {
                                      try {
                                        await superAdminServerApi.godmode.toggleActive(sa.id);
                                        await fetchSuperadmins();
                                        toast({ title: 'Done', description: `Account ${sa.is_active ? 'deactivated' : 'activated'}` });
                                      } catch (err) {
                                        toast({ title: 'Error', description: err?.message, variant: 'destructive' });
                                      }
                                    }}
                                  >
                                    {sa.is_active ? 'Deactivate' : 'Activate'}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="text-xs"
                                    onClick={async () => {
                                      if (!window.confirm(`Delete superadmin ${sa.email}?`)) return;
                                      try {
                                        await superAdminServerApi.godmode.deleteSuperadmin(sa.id);
                                        await fetchSuperadmins();
                                        toast({ title: 'Deleted', description: `${sa.email} removed` });
                                      } catch (err) {
                                        toast({ title: 'Error', description: err?.message, variant: 'destructive' });
                                      }
                                    }}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </main>

      {/* GOD MODE — Create Superadmin Modal */}
      <Dialog open={superadminModalOpen} onOpenChange={setSuperadminModalOpen}>
        <DialogContent className="bg-neutral-900 border-red-900 text-white">
          <DialogHeader>
            <DialogTitle className="text-red-400">Create SUPERADMIN Account</DialogTitle>
            <DialogDescription className="text-neutral-400">
              This creates an ITM Owner (SUPERADMIN) account. Only GOD MODE can do this.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setSuperadminSaving(true);
              try {
                await superAdminServerApi.godmode.createSuperadmin(superadminForm);
                await fetchSuperadmins();
                setSuperadminModalOpen(false);
                setSuperadminForm({ email: '', password: '', full_name: '' });
                toast({ title: 'Created', description: 'SUPERADMIN account created successfully' });
              } catch (err) {
                toast({ title: 'Error', description: err?.message, variant: 'destructive' });
              } finally {
                setSuperadminSaving(false);
              }
            }}
            className="space-y-4 mt-4"
          >
            <div className="space-y-2">
              <Label className="text-neutral-300">Full Name</Label>
              <Input
                value={superadminForm.full_name}
                onChange={(e) => setSuperadminForm((p) => ({ ...p, full_name: e.target.value }))}
                className="bg-neutral-800 border-neutral-700"
                placeholder="ITM Owner Name"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-neutral-300">Email</Label>
              <Input
                type="email"
                value={superadminForm.email}
                onChange={(e) => setSuperadminForm((p) => ({ ...p, email: e.target.value }))}
                className="bg-neutral-800 border-neutral-700"
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-neutral-300">Password</Label>
              <Input
                type="password"
                value={superadminForm.password}
                onChange={(e) => setSuperadminForm((p) => ({ ...p, password: e.target.value }))}
                className="bg-neutral-800 border-neutral-700"
                required
                minLength={8}
              />
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <Button type="button" variant="ghost" onClick={() => setSuperadminModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={superadminSaving} className="bg-red-900 hover:bg-red-800">
                {superadminSaving ? 'Creating...' : 'Create SUPERADMIN'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={employeeModalOpen} onOpenChange={setEmployeeModalOpen}>
        <DialogContent className="bg-neutral-900 border-neutral-800 text-white">
          <DialogHeader>
            <DialogTitle>Create Employee</DialogTitle>
            <DialogDescription className="text-neutral-400">
              This creates a MySQL auth user and an employees table record.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitEmployee} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label className="text-neutral-300">Full Name</Label>
              <Input
                value={employeeForm.full_name}
                onChange={(e) =>
                  setEmployeeForm((prev) => ({ ...prev, full_name: e.target.value }))
                }
                className="bg-neutral-800 border-neutral-700"
                required
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-neutral-300">Email</Label>
                <Input
                  type="email"
                  value={employeeForm.email}
                  onChange={(e) =>
                    setEmployeeForm((prev) => ({ ...prev, email: e.target.value }))
                  }
                  className="bg-neutral-800 border-neutral-700"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="text-neutral-300">Phone</Label>
                <Input
                  value={employeeForm.phone}
                  onChange={(e) =>
                    setEmployeeForm((prev) => ({ ...prev, phone: e.target.value }))
                  }
                  className="bg-neutral-800 border-neutral-700"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-neutral-300">Temporary Password</Label>
              <Input
                type="password"
                value={employeeForm.password}
                onChange={(e) =>
                  setEmployeeForm((prev) => ({ ...prev, password: e.target.value }))
                }
                className="bg-neutral-800 border-neutral-700"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-neutral-300">Role</Label>
                <Select
                  value={employeeForm.role}
                  onValueChange={(value) =>
                    setEmployeeForm((prev) => ({
                      ...prev,
                      role: value,
                      department: value === 'ADMIN' ? 'Administration' : prev.department,
                      state_scope_ids: value === 'ADMIN' ? prev.state_scope_ids : [],
                    }))
                  }
                >
                  <SelectTrigger className="bg-neutral-800 border-neutral-700 text-white">
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-800 border-neutral-700 text-white">
                    {EMPLOYEE_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-neutral-300">Department</Label>
                <Input
                  value={employeeForm.department}
                  onChange={(e) =>
                    setEmployeeForm((prev) => ({ ...prev, department: e.target.value }))
                  }
                  className="bg-neutral-800 border-neutral-700"
                />
              </div>
            </div>

            {/* States Scope — only for ADMIN role */}
            {employeeForm.role === 'ADMIN' && (
              <div className="space-y-2">
                <Label className="text-neutral-300 flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-blue-400" />
                  States Scope
                </Label>
                {renderStateScopeSelector({
                  selectedIds: employeeForm.state_scope_ids,
                  onChange: (nextIds) => setEmployeeForm((prev) => ({ ...prev, state_scope_ids: nextIds })),
                  helperText: 'Select the states this admin will manage. Leave empty for All India access.',
                })}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="border-neutral-700 text-neutral-300"
                onClick={() => setEmployeeModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={employeeSaving}>
                {employeeSaving ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Create Employee
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={planCreateOpen} onOpenChange={setPlanCreateOpen}>
        <DialogContent className="bg-neutral-900 border-neutral-800 text-white w-[96vw] sm:w-[52vw] max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Subscription Plan</DialogTitle>
            <DialogDescription className="text-neutral-400">
              Add a new vendor plan. Existing plans stay unchanged.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={createPlan} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label className="text-neutral-300">Plan Name</Label>
              <Input
                value={newPlanForm.name}
                onChange={(e) => setNewPlanForm((prev) => ({ ...prev, name: e.target.value }))}
                className="bg-neutral-800 border-neutral-700"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-neutral-300">Description</Label>
              <Input
                value={newPlanForm.description}
                onChange={(e) => setNewPlanForm((prev) => ({ ...prev, description: e.target.value }))}
                className="bg-neutral-800 border-neutral-700"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label className="text-neutral-300">Base Currency</Label>
                <Input
                  value="INR - Indian Rupee"
                  readOnly
                  className="bg-neutral-800 border-neutral-700 text-neutral-300"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-neutral-300">Current Price</Label>
                <Input
                  type="number"
                  min="0"
                  value={showBlankForZero(newPlanForm.price)}
                  onChange={(e) => updateNewPlanPricing('price', e.target.value)}
                  className="bg-neutral-800 border-neutral-700"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-neutral-300">Original Price (old)</Label>
                <Input
                  type="number"
                  min="0"
                  value={showBlankForZero(newPlanForm.original_price)}
                  onChange={(e) => updateNewPlanPricing('original_price', e.target.value)}
                  className="bg-neutral-800 border-neutral-700"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-neutral-300">Discount %</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={showBlankForZero(newPlanForm.discount_percent)}
                  onChange={(e) => updateNewPlanPricing('discount_percent', e.target.value)}
                  className="bg-neutral-800 border-neutral-700"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-neutral-300">Discount Label</Label>
                <Input
                  type="text"
                  value={newPlanForm.discount_label}
                  onChange={(e) => setNewPlanForm((prev) => ({ ...prev, discount_label: e.target.value }))}
                  disableAutoSanitize
                  className="bg-neutral-800 border-neutral-700"
                  placeholder="Example: 20% OFF"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-neutral-300">Extra Lead Price</Label>
                <Input
                  type="number"
                  min="0"
                  value={showBlankForZero(newPlanForm.extra_lead_price)}
                  onChange={(e) => setNewPlanForm((prev) => ({ ...prev, extra_lead_price: e.target.value }))}
                  className="bg-neutral-800 border-neutral-700"
                  placeholder="Applied when daily/weekly included quota is exhausted"
                />
              </div>
            </div>

            {renderRegionalPricesEditor({
              rows: newPlanForm.regional_prices,
              idPrefix: 'new-plan',
              onChange: (nextRows) => setNewPlanForm((prev) => ({ ...prev, regional_prices: nextRows })),
            })}

            <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-3">
              <div className="mb-3">
                <p className="text-[11px] uppercase tracking-wide text-neutral-300">Lead Unlock Limits</p>
                <p className="mt-1 text-xs leading-5 text-neutral-500">
                  Daily is the per-day included unlock cap. Weekly is the maximum included unlocks in one week.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label className="text-neutral-300">Daily unlocks</Label>
                <Input
                  type="number"
                  min="0"
                  value={newPlanForm.daily_limit}
                  onChange={(e) => setNewPlanForm((prev) => ({ ...prev, daily_limit: e.target.value }))}
                  className="bg-neutral-800 border-neutral-700"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-neutral-300">Weekly unlocks</Label>
                <Input
                  type="number"
                  min="0"
                  value={newPlanForm.weekly_limit}
                  onChange={(e) => setNewPlanForm((prev) => ({ ...prev, weekly_limit: e.target.value }))}
                  className="bg-neutral-800 border-neutral-700"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-neutral-300">Yearly unlocks</Label>
                <Input
                  type="number"
                  min="0"
                  value={newPlanForm.yearly_limit}
                  onChange={(e) => setNewPlanForm((prev) => ({ ...prev, yearly_limit: e.target.value }))}
                  className="bg-neutral-800 border-neutral-700"
                />
              </div>
              </div>
            </div>

            <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-3">
              <div className="mb-3">
                <p className="text-[11px] uppercase tracking-wide text-neutral-300">Search Coverage Limits</p>
                <p className="mt-1 text-xs leading-5 text-neutral-500">
                  States and cities decide where this vendor can show in buyer search after they select coverage in Plan Business Preferences.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-neutral-300">Target states allowed</Label>
                  <Input
                    type="number"
                    min="0"
                    value={newPlanForm.states_limit}
                    onChange={(e) => setNewPlanForm((prev) => ({ ...prev, states_limit: e.target.value }))}
                    className="bg-neutral-800 border-neutral-700"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-neutral-300">Target cities allowed</Label>
                  <Input
                    type="number"
                    min="0"
                    value={newPlanForm.cities_limit}
                    onChange={(e) => setNewPlanForm((prev) => ({ ...prev, cities_limit: e.target.value }))}
                    className="bg-neutral-800 border-neutral-700"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-neutral-300">Duration (days)</Label>
                <Input
                  type="number"
                  min="1"
                  value={newPlanForm.duration_days}
                  onChange={(e) => setNewPlanForm((prev) => ({ ...prev, duration_days: e.target.value }))}
                  className="bg-neutral-800 border-neutral-700"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-neutral-300">Badge Label</Label>
                <Input
                  value={newPlanForm.badge_label}
                  onChange={(e) => setNewPlanForm((prev) => ({ ...prev, badge_label: e.target.value }))}
                  className="bg-neutral-800 border-neutral-700"
                  placeholder="Example: Most Popular"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <div className="space-y-2">
                <Label className="text-neutral-300">Badge Variant</Label>
                <Select
                  value={newPlanForm.badge_variant}
                  onValueChange={(value) => setNewPlanForm((prev) => ({ ...prev, badge_variant: value }))}
                >
                  <SelectTrigger className="bg-neutral-800 border-neutral-700 text-white">
                    <SelectValue placeholder="Badge variant" />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-800 border-neutral-700 text-white">
                    {PLAN_BADGE_VARIANTS.map((variant) => (
                      <SelectItem key={variant} value={variant}>
                        {variant}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 rounded-md border border-neutral-700 px-3 py-2 h-10">
                <Switch
                  checked={newPlanForm.is_active === true}
                  onCheckedChange={(checked) => setNewPlanForm((prev) => ({ ...prev, is_active: checked }))}
                />
                <span className="text-sm text-neutral-200">Plan Active</span>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="border-neutral-700 text-neutral-300 w-full sm:w-auto"
                onClick={() => setPlanCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto" disabled={planCreating}>
                {planCreating ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Create Plan
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
