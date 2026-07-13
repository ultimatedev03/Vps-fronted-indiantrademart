import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { superAdminServerApi } from '@/modules/admin/services/superAdminServerApi';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
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
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Download,
  Eye,
  Mail,
  MapPin,
  PackageSearch,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Target,
  TrendingUp,
  UserRoundSearch,
  Users,
} from 'lucide-react';

const PAGE_SIZE = 50;

const LEVEL_OPTIONS = [
  { value: 'head', label: 'Main categories' },
  { value: 'sub', label: 'Sub categories' },
  { value: 'micro', label: 'Micro categories' },
];

const RANGE_OPTIONS = [
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '180', label: 'Last 180 days' },
  { value: '365', label: 'Last 12 months' },
  { value: '0', label: 'All time' },
];

const SORT_OPTIONS = [
  { value: 'opportunity', label: 'Best opportunity' },
  { value: 'demand', label: 'Buyer demand' },
  { value: 'vendors', label: 'Vendor count' },
  { value: 'gap', label: 'Supply gap' },
  { value: 'category', label: 'Category name' },
];

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

const escapeCsv = (value) => {
  const text = String(value ?? '').replace(/"/g, '""');
  return /[",\n]/.test(text) ? `"${text}"` : text;
};

function exportCsv(rows, level, days) {
  const headers = [
    'Category',
    'Main Category',
    'Sub Category',
    'Total Vendors',
    'Vendors With Listings',
    'Vendors With Preferences',
    'Active Products',
    'Buyer Requirements',
    'Unique Buyers',
    'Demand Per Vendor',
    'Net Supply Gap',
    'Status',
    'Latest Requirement',
  ];
  const body = rows.map((row) => [
    row.category_path,
    row.head_category_name,
    row.sub_category_name,
    row.vendor_count,
    row.listed_vendor_count,
    row.preference_vendor_count,
    row.active_product_count,
    row.requirement_count,
    row.buyer_count,
    row.demand_per_vendor ?? 'No supply',
    row.net_supply_gap,
    STATUS_META[row.match_status]?.label || row.match_status,
    row.latest_requirement_at || '',
  ]);
  const csv = [headers, ...body].map((line) => line.map(escapeCsv).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `category-demand-${level}-${days === 0 ? 'all-time' : `${days}-days`}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.SUPPLY_ONLY;
  return (
    <span className={`inline-flex whitespace-nowrap rounded border px-2 py-1 text-[11px] font-medium ${meta.className}`}>
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
      {label}
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

export default function CategoryDemandAnalytics() {
  const [level, setLevel] = useState('head');
  const [days, setDays] = useState(90);
  const [sortBy, setSortBy] = useState('opportunity');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ rows: [], summary: {}, pagination: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [details, setDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState('');

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await superAdminServerApi.intelligence.categoryDemand({
        level,
        days,
        limit: 5000,
      });
      setData(response?.data || { rows: [], summary: {}, pagination: {} });
    } catch (requestError) {
      setError(requestError?.message || 'Failed to load category demand analytics');
    } finally {
      setLoading(false);
    }
  }, [days, level]);

  useEffect(() => {
    void fetchAnalytics();
  }, [fetchAnalytics]);

  useEffect(() => {
    setPage(1);
    setSelectedCategory(null);
    setDetails(null);
  }, [days, level, search, sortBy]);

  const fetchCategoryDetails = useCallback(async (row) => {
    if (!row?.category_id) return;
    setSelectedCategory(row);
    setDetails(null);
    setDetailsError('');
    setDetailsLoading(true);
    try {
      const response = await superAdminServerApi.intelligence.categoryDemandDetails({
        categoryId: row.category_id,
        level,
        days,
        vendorLimit: 100,
        demandLimit: 100,
      });
      setDetails(response?.data || null);
    } catch (requestError) {
      setDetailsError(requestError?.message || 'Failed to load category verification records');
    } finally {
      setDetailsLoading(false);
    }
  }, [days, level]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = (data?.rows || []).filter((row) => {
      if (!term) return true;
      return [
        row.category_name,
        row.category_path,
        row.head_category_name,
        row.sub_category_name,
        STATUS_META[row.match_status]?.label,
      ].some((value) => String(value || '').toLowerCase().includes(term));
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'demand') {
        return Number(b.requirement_count || 0) - Number(a.requirement_count || 0)
          || Number(b.buyer_count || 0) - Number(a.buyer_count || 0);
      }
      if (sortBy === 'vendors') {
        return Number(b.vendor_count || 0) - Number(a.vendor_count || 0)
          || Number(b.active_product_count || 0) - Number(a.active_product_count || 0);
      }
      if (sortBy === 'gap') {
        return Number(b.net_supply_gap || 0) - Number(a.net_supply_gap || 0);
      }
      if (sortBy === 'category') {
        return String(a.category_path || '').localeCompare(String(b.category_path || ''));
      }

      const priority = { NO_SUPPLY: 4, HIGH_DEMAND: 3, BALANCED: 2, SUPPLY_HEAVY: 1, SUPPLY_ONLY: 0 };
      return Number(priority[b.match_status] || 0) - Number(priority[a.match_status] || 0)
        || Number(b.opportunity_score || 0) - Number(a.opportunity_score || 0)
        || Number(b.requirement_count || 0) - Number(a.requirement_count || 0);
    });
  }, [data?.rows, search, sortBy]);

  const opportunities = useMemo(
    () => [...(data?.rows || [])]
      .filter((row) => ['NO_SUPPLY', 'HIGH_DEMAND'].includes(row.match_status))
      .sort((a, b) => Number(b.opportunity_score || 0) - Number(a.opportunity_score || 0))
      .slice(0, 8),
    [data?.rows]
  );

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const summary = data?.summary || {};
  const coverage = Math.max(0, Math.min(100, Number(summary.demand_coverage_percent || 0)));
  const vendorCountMatches = details && selectedCategory
    ? Number(details?.totals?.vendors || 0) === Number(selectedCategory.vendor_count || 0)
    : false;
  const requirementCountMatches = details && selectedCategory
    ? Number(details?.totals?.requirements || 0) === Number(selectedCategory.requirement_count || 0)
    : false;
  const recordsReconciled = Boolean(details && vendorCountMatches && requirementCountMatches);

  return (
    <div className="space-y-4">
      <Card className="border-neutral-800 bg-neutral-900">
        <CardHeader className="gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-white">
              <Target className="h-5 w-5 text-cyan-400" />
              Category Demand & Supply
            </CardTitle>
            <CardDescription className="mt-2 max-w-3xl text-neutral-400">
              Vendor supply combines active listings and saved business preferences. Buyer demand uses deduplicated requirements.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={String(days)} onValueChange={(value) => setDays(Number(value))}>
              <SelectTrigger className="h-9 w-44 border-neutral-700 bg-neutral-950 text-neutral-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-neutral-700 bg-neutral-900 text-neutral-200">
                {RANGE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              className="h-9 border-neutral-700 text-neutral-300 hover:bg-neutral-800"
              onClick={() => exportCsv(rows, level, days)}
              disabled={!rows.length}
              title="Export filtered analytics as CSV"
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button
              variant="outline"
              className="h-9 border-neutral-700 text-neutral-300 hover:bg-neutral-800"
              onClick={fetchAnalytics}
              disabled={loading}
              title="Refresh category analytics"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="inline-flex flex-wrap rounded-md border border-neutral-700 bg-neutral-950 p-1" role="group" aria-label="Category hierarchy level">
            {LEVEL_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setLevel(option.value)}
                className={`h-8 rounded px-3 text-xs ${
                  level === option.value
                    ? 'bg-neutral-700 text-white hover:bg-neutral-700'
                    : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
                }`}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {error ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-red-900 bg-red-950/50 px-4 py-3 text-sm text-red-300">
          <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{error}</span>
          <Button variant="ghost" size="sm" onClick={fetchAnalytics} className="text-red-200 hover:bg-red-900">Retry</Button>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-neutral-800 bg-neutral-900">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm text-neutral-300">
              Categorized Vendors <Building2 className="h-4 w-4 text-blue-400" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-white">{loading ? '-' : formatNumber(summary.categorized_vendors)}</div>
            <p className="mt-1 text-xs text-neutral-500">
              {formatNumber(summary.uncategorized_vendors)} of {formatNumber(summary.active_vendors)} need category mapping
            </p>
          </CardContent>
        </Card>
        <Card className="border-neutral-800 bg-neutral-900">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm text-neutral-300">
              Buyer Requirements <Users className="h-4 w-4 text-violet-400" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-white">{loading ? '-' : formatNumber(summary.total_requirements)}</div>
            <p className="mt-1 text-xs text-neutral-500">
              {formatNumber(summary.total_buyers)} identified buyers, {formatNumber(summary.uncategorized_requirements)} uncategorized
            </p>
          </CardContent>
        </Card>
        <Card className="border-neutral-800 bg-neutral-900">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm text-neutral-300">
              Demand Coverage <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-white">{loading ? '-' : `${coverage.toFixed(1)}%`}</div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-800">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${coverage}%` }} />
            </div>
          </CardContent>
        </Card>
        <Card className="border-neutral-800 bg-neutral-900">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm text-neutral-300">
              Opportunity Categories <TrendingUp className="h-4 w-4 text-amber-400" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-white">{loading ? '-' : formatNumber(summary.opportunity_categories)}</div>
            <p className="mt-1 text-xs text-neutral-500">No supply or demand at least 2x vendor count</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-neutral-800 bg-neutral-900">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-white">Top Business Opportunities</CardTitle>
          <CardDescription className="text-neutral-400">Categories where current buyer demand needs more vendor coverage.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-sm text-neutral-400">Loading category opportunities...</div>
          ) : opportunities.length === 0 ? (
            <div className="py-8 text-center text-sm text-neutral-500">No high-gap categories in this period.</div>
          ) : (
            <div className="divide-y divide-neutral-800">
              {opportunities.map((row, index) => (
                <div key={row.category_id} className="grid gap-3 py-3 md:grid-cols-[36px_minmax(0,1fr)_100px_110px_170px_90px] md:items-center">
                  <span className="text-sm font-semibold text-neutral-500">#{index + 1}</span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white" title={row.category_path}>{row.category_path}</p>
                    <p className="mt-0.5 text-xs text-neutral-500">{formatNumber(row.active_product_count)} active products</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500">Vendors</p>
                    <p className="text-sm font-semibold text-blue-300">{formatNumber(row.vendor_count)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500">Requirements</p>
                    <p className="text-sm font-semibold text-violet-300">{formatNumber(row.requirement_count)}</p>
                  </div>
                  <StatusBadge status={row.match_status} />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                    onClick={() => fetchCategoryDetails(row)}
                  >
                    <Eye className="mr-1.5 h-3.5 w-3.5" />
                    Verify
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-neutral-800 bg-neutral-900">
        <CardHeader className="gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <CardTitle className="text-base text-white">Category Breakdown</CardTitle>
            <CardDescription className="mt-1 text-neutral-400">
              {formatNumber(rows.length)} matching categories
              {data?.pagination?.truncated ? ` of ${formatNumber(data.pagination.total)}` : ''}
            </CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 sm:w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search category or hierarchy..."
                className="h-9 border-neutral-700 bg-neutral-950 pl-9 text-neutral-200"
              />
            </div>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-9 w-full border-neutral-700 bg-neutral-950 text-neutral-200 sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-neutral-700 bg-neutral-900 text-neutral-200">
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border border-neutral-800">
            <Table>
              <TableHeader className="bg-neutral-950">
                <TableRow className="border-neutral-800 hover:bg-neutral-950">
                  <TableHead className="min-w-72 text-neutral-400">Category</TableHead>
                  <TableHead className="text-right text-neutral-400">Vendors</TableHead>
                  <TableHead className="text-right text-neutral-400">Products</TableHead>
                  <TableHead className="text-right text-neutral-400">Buyer Demand</TableHead>
                  <TableHead className="text-right text-neutral-400">Demand / Vendor</TableHead>
                  <TableHead className="text-right text-neutral-400">Net Gap</TableHead>
                  <TableHead className="text-neutral-400">Business Fit</TableHead>
                  <TableHead className="text-neutral-400">Latest Demand</TableHead>
                  <TableHead className="w-16 text-right text-neutral-400">Verify</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow className="border-neutral-800">
                    <TableCell colSpan={9} className="py-12 text-center text-neutral-400">Loading category analytics...</TableCell>
                  </TableRow>
                ) : pageRows.length === 0 ? (
                  <TableRow className="border-neutral-800">
                    <TableCell colSpan={9} className="py-12 text-center text-neutral-500">No category data matches these filters.</TableCell>
                  </TableRow>
                ) : pageRows.map((row) => (
                  <TableRow key={row.category_id} className="border-neutral-800 hover:bg-neutral-800/40">
                    <TableCell>
                      <p className="max-w-lg text-sm font-medium text-white" title={row.category_path}>{row.category_path}</p>
                      <p className="mt-1 text-xs text-neutral-500">{row.category_slug || row.category_id}</p>
                    </TableCell>
                    <TableCell className="text-right">
                      <p className="font-semibold text-blue-300">{formatNumber(row.vendor_count)}</p>
                      <p className="whitespace-nowrap text-[11px] text-neutral-500">
                        {formatNumber(row.listed_vendor_count)} listed / {formatNumber(row.preference_vendor_count)} preferred
                      </p>
                    </TableCell>
                    <TableCell className="text-right text-neutral-300">{formatNumber(row.active_product_count)}</TableCell>
                    <TableCell className="text-right">
                      <p className="font-semibold text-violet-300">{formatNumber(row.requirement_count)}</p>
                      <p className="text-[11px] text-neutral-500">{formatNumber(row.buyer_count)} buyers</p>
                    </TableCell>
                    <TableCell className="text-right text-neutral-300">
                      {row.demand_per_vendor == null ? 'No supply' : Number(row.demand_per_vendor).toFixed(2)}
                    </TableCell>
                    <TableCell className={`text-right font-medium ${Number(row.net_supply_gap || 0) > 0 ? 'text-amber-300' : 'text-neutral-400'}`}>
                      {Number(row.net_supply_gap || 0) > 0 ? '+' : ''}{formatNumber(row.net_supply_gap)}
                    </TableCell>
                    <TableCell><StatusBadge status={row.match_status} /></TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-neutral-400">{formatDate(row.latest_requirement_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-neutral-400 hover:bg-neutral-800 hover:text-cyan-300"
                        onClick={() => fetchCategoryDetails(row)}
                        title="Verify matching leads and vendors"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex flex-col gap-3 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
            <p>
              Showing {rows.length ? (safePage - 1) * PAGE_SIZE + 1 : 0}-{Math.min(safePage * PAGE_SIZE, rows.length)} of {formatNumber(rows.length)}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 border-neutral-700 text-neutral-300"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={safePage <= 1}
                title="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-20 text-center">Page {safePage} of {pageCount}</span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 border-neutral-700 text-neutral-300"
                onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                disabled={safePage >= pageCount}
                title="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(selectedCategory)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedCategory(null);
            setDetails(null);
            setDetailsError('');
          }
        }}
      >
        <DialogContent className="flex max-h-[92vh] w-[96vw] max-w-[1500px] flex-col overflow-hidden border-neutral-800 bg-neutral-950 p-0 text-neutral-200">
          <DialogHeader className="shrink-0 border-b border-neutral-800 px-6 py-5 text-left">
            <div className="flex flex-col gap-3 pr-8 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <DialogTitle className="flex items-center gap-2 text-lg text-white">
                  <ClipboardCheck className="h-5 w-5 text-cyan-400" />
                  Verify Category Match
                </DialogTitle>
                <DialogDescription className="mt-1 truncate text-neutral-400" title={selectedCategory?.category_path}>
                  {selectedCategory?.category_path || 'Category records'}
                </DialogDescription>
              </div>
              {selectedCategory ? <StatusBadge status={selectedCategory.match_status} /> : null}
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
            {detailsLoading ? (
              <div className="flex min-h-80 items-center justify-center gap-3 text-sm text-neutral-400">
                <RefreshCw className="h-5 w-5 animate-spin text-cyan-400" />
                Reconciling vendor and buyer records...
              </div>
            ) : detailsError ? (
              <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-md border border-red-900 bg-red-950/30 px-6 text-center">
                <AlertTriangle className="h-7 w-7 text-red-400" />
                <p className="text-sm text-red-300">{detailsError}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-red-800 text-red-200 hover:bg-red-950"
                  onClick={() => fetchCategoryDetails(selectedCategory)}
                >
                  Retry verification
                </Button>
              </div>
            ) : details ? (
              <div className="space-y-5">
                <div className={`flex flex-col gap-3 rounded-md border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
                  recordsReconciled
                    ? 'border-emerald-900 bg-emerald-950/30'
                    : 'border-red-900 bg-red-950/30'
                }`}>
                  <div className="flex items-start gap-3">
                    {recordsReconciled ? (
                      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
                    )}
                    <div>
                      <p className={`text-sm font-semibold ${recordsReconciled ? 'text-emerald-200' : 'text-red-200'}`}>
                        {recordsReconciled ? 'Aggregate and detailed records reconcile' : 'Count mismatch needs review'}
                      </p>
                      <p className="mt-1 text-xs text-neutral-400">
                        Vendor count {vendorCountMatches ? 'matches' : 'does not match'}; buyer requirement count {requirementCountMatches ? 'matches' : 'does not match'}.
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 shrink-0 border-neutral-700 text-neutral-300 hover:bg-neutral-900"
                    onClick={() => fetchCategoryDetails(selectedCategory)}
                  >
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    Recheck
                  </Button>
                </div>

                <div className="grid overflow-hidden rounded-md border border-neutral-800 bg-neutral-900 sm:grid-cols-2 xl:grid-cols-5">
                  {[
                    ['Matching vendors', details.totals?.vendors, selectedCategory?.vendor_count, 'text-blue-300'],
                    ['Buyer requirements', details.totals?.requirements, selectedCategory?.requirement_count, 'text-violet-300'],
                    ['Category searches', details.activity?.searches, null, 'text-cyan-300'],
                    ['Interested visitors', details.activity?.unique_visitors, null, 'text-emerald-300'],
                    ['Mirrored rows removed', details.reconciliation?.mirrored_leads_excluded, null, 'text-amber-300'],
                  ].map(([label, value, aggregate, valueClass], index) => (
                    <div key={label} className={`px-4 py-3 ${index ? 'border-t border-neutral-800 sm:border-l sm:border-t-0' : ''}`}>
                      <p className="text-[11px] uppercase text-neutral-500">{label}</p>
                      <p className={`mt-1 text-xl font-semibold ${valueClass}`}>{formatNumber(value)}</p>
                      {aggregate != null ? <p className="text-[11px] text-neutral-600">Aggregate: {formatNumber(aggregate)}</p> : null}
                    </div>
                  ))}
                </div>

                <section className="rounded-md border border-neutral-800 bg-neutral-900/60">
                  <div className="border-b border-neutral-800 px-4 py-3">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                      <Search className="h-4 w-4 text-cyan-400" />
                      Customer interest signals
                    </h3>
                    <p className="mt-1 text-xs text-neutral-500">Public searches and browsing activity associated with this category.</p>
                  </div>
                  <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {[
                        ['All actions', details.activity?.total_events],
                        ['Category views', details.activity?.category_views],
                        ['Product views', details.activity?.product_views],
                        ['Vendor views', details.activity?.vendor_views],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded border border-neutral-800 bg-neutral-950 px-3 py-2">
                          <p className="text-[11px] text-neutral-500">{label}</p>
                          <p className="mt-1 text-base font-semibold text-neutral-200">{formatNumber(value)}</p>
                        </div>
                      ))}
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-medium text-neutral-400">Top related searches</p>
                      {(details.activity?.top_searches || []).length ? (
                        <div className="flex flex-wrap gap-2">
                          {details.activity.top_searches.map((item) => (
                            <span key={item.search_query} className="inline-flex items-center gap-2 rounded border border-neutral-700 bg-neutral-950 px-2.5 py-1.5 text-xs text-neutral-300">
                              <span className="max-w-56 truncate">{item.search_query}</span>
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

                <div className="grid gap-4 xl:grid-cols-2">
                  <section className="min-w-0 rounded-md border border-neutral-800 bg-neutral-900/60">
                    <div className="flex items-start justify-between gap-3 border-b border-neutral-800 px-4 py-3">
                      <div>
                        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                          <UserRoundSearch className="h-4 w-4 text-violet-400" />
                          Buyer requirements
                        </h3>
                        <p className="mt-1 text-xs text-neutral-500">Canonical proposals and standalone leads only.</p>
                      </div>
                      <Badge variant="outline" className="border-violet-900 bg-violet-950 text-violet-300">
                        {formatNumber(details.totals?.requirements)}
                      </Badge>
                    </div>
                    <div className="max-h-[680px] space-y-2 overflow-y-auto p-3">
                      {(details.requirements || []).length ? details.requirements.map((requirement) => (
                        <article key={requirement.demand_id} className="rounded-md border border-neutral-800 bg-neutral-950 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-white" title={requirement.product_name || requirement.title}>
                                {requirement.product_name || requirement.title || 'Untitled requirement'}
                              </p>
                              <p className="mt-1 truncate text-xs text-neutral-500">
                                {requirement.buyer_name || requirement.company_name || requirement.buyer_email || requirement.buyer_key || 'Anonymous buyer'}
                              </p>
                            </div>
                            <SourceBadge source={requirement.source_type} />
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                            <div><span className="text-neutral-600">Quantity</span><p className="mt-0.5 text-neutral-300">{requirement.quantity || '-'}</p></div>
                            <div><span className="text-neutral-600">Budget</span><p className="mt-0.5 text-neutral-300">{formatBudget(requirement.budget)}</p></div>
                            <div><span className="text-neutral-600">Status</span><p className="mt-0.5 text-neutral-300">{requirement.status || '-'}</p></div>
                            <div><span className="text-neutral-600">Created</span><p className="mt-0.5 text-neutral-300">{formatDateTime(requirement.created_at)}</p></div>
                          </div>
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
                      )) : (
                        <div className="py-12 text-center text-sm text-neutral-600">No buyer requirement found in this period.</div>
                      )}
                    </div>
                  </section>

                  <section className="min-w-0 rounded-md border border-neutral-800 bg-neutral-900/60">
                    <div className="flex items-start justify-between gap-3 border-b border-neutral-800 px-4 py-3">
                      <div>
                        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                          <Building2 className="h-4 w-4 text-blue-400" />
                          Matching vendors
                        </h3>
                        <p className="mt-1 text-xs text-neutral-500">Active vendors matched through listings or saved preferences.</p>
                      </div>
                      <Badge variant="outline" className="border-blue-900 bg-blue-950 text-blue-300">
                        {formatNumber(details.totals?.vendors)}
                      </Badge>
                    </div>
                    <div className="max-h-[680px] space-y-2 overflow-y-auto p-3">
                      {(details.vendors || []).length ? details.vendors.map((vendor) => (
                        <article key={vendor.id} className="rounded-md border border-neutral-800 bg-neutral-950 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-sm font-semibold text-white" title={vendor.company_name}>{vendor.company_name || 'Unnamed vendor'}</p>
                                {vendor.is_verified ? <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" /> : null}
                              </div>
                              <p className="mt-1 truncate text-xs text-neutral-500">
                                {[vendor.owner_name, vendor.primary_business_type].filter(Boolean).join(' | ') || vendor.display_vendor_id || vendor.id}
                              </p>
                            </div>
                            <SourceBadge source={vendor.membership_source} />
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                            <div><span className="text-neutral-600">Active products</span><p className="mt-0.5 font-semibold text-blue-300">{formatNumber(vendor.active_product_count)}</p></div>
                            <div><span className="text-neutral-600">KYC / account</span><p className="mt-0.5 text-neutral-300">{vendor.kyc_status || vendor.account_status || vendor.status || '-'}</p></div>
                            <div><span className="text-neutral-600">Profile completion</span><p className="mt-0.5 text-neutral-300">{formatNumber(vendor.profile_completion)}%</p></div>
                            <div><span className="text-neutral-600">Latest listing</span><p className="mt-0.5 text-neutral-300">{formatDate(vendor.latest_product_at)}</p></div>
                          </div>
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
                              <a
                                href={`/directory/vendor/${vendor.slug}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300"
                              >
                                Public profile <ArrowUpRight className="h-3.5 w-3.5" />
                              </a>
                            ) : null}
                          </div>
                          <p className="mt-2 truncate text-[10px] text-neutral-600" title={vendor.id}>
                            Vendor ID: {vendor.display_vendor_id || vendor.id}
                          </p>
                        </article>
                      )) : (
                        <div className="py-12 text-center text-sm text-neutral-600">No matching active vendor found.</div>
                      )}
                    </div>
                  </section>
                </div>

                <div className="grid gap-2 rounded-md border border-neutral-800 bg-neutral-900/60 p-3 text-xs text-neutral-400 sm:grid-cols-2 lg:grid-cols-5">
                  <span>Preference only: <strong className="text-neutral-200">{formatNumber(details.reconciliation?.preference_only_vendors)}</strong></span>
                  <span>Listing only: <strong className="text-neutral-200">{formatNumber(details.reconciliation?.listing_only_vendors)}</strong></span>
                  <span>Both sources: <strong className="text-neutral-200">{formatNumber(details.reconciliation?.listing_and_preference_vendors)}</strong></span>
                  <span>Missing contact: <strong className="text-amber-300">{formatNumber(details.reconciliation?.requirements_without_contact)}</strong></span>
                  <span>Anonymous demand: <strong className="text-amber-300">{formatNumber(details.reconciliation?.anonymous_requirements)}</strong></span>
                </div>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
