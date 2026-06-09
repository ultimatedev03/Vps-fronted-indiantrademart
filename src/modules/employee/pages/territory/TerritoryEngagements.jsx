import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Activity,
  Building2,
  CalendarClock,
  CheckCircle2,
  Filter,
  Link as LinkIcon,
  Loader2,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  Share2,
  Users,
  X,
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { territoryApi } from '@/modules/employee/services/territoryApi';

const ALL_VALUE = 'ALL';
const ENGAGEMENT_TYPES = [
  { value: ALL_VALUE, label: 'All activity' },
  { value: 'CALL', label: 'Call' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'VISIT', label: 'Visit' },
  { value: 'DEMO', label: 'Demo' },
  { value: 'FOLLOW_UP', label: 'Follow-up' },
  { value: 'PLAN_PITCH', label: 'Plan pitch' },
  { value: 'PLAN_SHARED', label: 'Plan shared' },
  { value: 'CONVERTED', label: 'Converted' },
  { value: 'UNMASK_REQUEST', label: 'Unmask request' },
];

const STATUS_OPTIONS = [
  { value: ALL_VALUE, label: 'All statuses' },
  { value: 'OPEN', label: 'Open' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'SENT', label: 'Sent' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'DONE', label: 'Done' },
  { value: 'CONVERTED', label: 'Converted' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'FAILED', label: 'Failed' },
];

const safeNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatMoney = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '-';
  return `Rs ${numeric.toLocaleString('en-IN')}`;
};

const cleanLabel = (value) =>
  String(value || '-')
    .replaceAll('_', ' ')
    .trim();

const statusBadgeClass = (status) => {
  const normalized = String(status || '').toUpperCase();
  if (['DONE', 'CONVERTED', 'CLOSED'].includes(normalized)) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (['FAILED', 'REJECTED'].includes(normalized)) return 'bg-red-50 text-red-700 border-red-200';
  if (['SENT', 'IN_PROGRESS'].includes(normalized)) return 'bg-blue-50 text-blue-700 border-blue-200';
  return 'bg-amber-50 text-amber-700 border-amber-200';
};

const isDue = (row) => {
  const value = row?.next_follow_up_at ? new Date(row.next_follow_up_at).getTime() : 0;
  if (!value) return false;
  const status = String(row?.status || '').toUpperCase();
  return value <= Date.now() && ['OPEN', 'PENDING', 'SENT', 'IN_PROGRESS'].includes(status);
};

const defaultFilters = () => ({
  search: '',
  vendor_id: '',
  engagement_type: ALL_VALUE,
  status: ALL_VALUE,
  due: false,
  date_from: '',
  date_to: '',
});

const StatCard = ({ icon: Icon, label, value, subtext }) => (
  <Card className="border-slate-200">
    <CardContent className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
          {subtext ? <p className="mt-1 text-xs text-slate-500">{subtext}</p> : null}
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
          <Icon className="h-4 w-4 text-slate-700" />
        </div>
      </div>
    </CardContent>
  </Card>
);

const TerritoryEngagements = () => {
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(defaultFilters);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({});

  const load = async (nextFilters = filters) => {
    try {
      setLoading(true);
      const query = {
        limit: 500,
        search: nextFilters.search,
        vendor_id: nextFilters.vendor_id,
        engagement_type: nextFilters.engagement_type === ALL_VALUE ? '' : nextFilters.engagement_type,
        status: nextFilters.status === ALL_VALUE ? '' : nextFilters.status,
        due: nextFilters.due ? 'true' : '',
        date_from: nextFilters.date_from,
        date_to: nextFilters.date_to,
      };
      const data = await territoryApi.getEngagementsWithMeta(query);
      setRows(data.engagements || []);
      setMeta(data.meta || {});
    } catch (error) {
      toast({
        title: 'Failed to load engagements',
        description: error?.message || 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(defaultFilters());
  }, []);

  const summary = meta?.summary || {};
  const vendorMatches = Array.isArray(meta?.vendor_matches) ? meta.vendor_matches : [];
  const dueRows = useMemo(() => rows.filter(isDue), [rows]);
  const activeFilters = useMemo(
    () =>
      Object.entries(filters).filter(([key, value]) => {
        if (key === 'due') return value === true;
        if (key === 'engagement_type' || key === 'status') return value && value !== ALL_VALUE;
        return Boolean(String(value || '').trim());
      }).length,
    [filters]
  );

  const updateFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  const clearFilters = () => {
    const reset = defaultFilters();
    setFilters(reset);
    load(reset);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Activity className="h-4 w-4" />
            Sales governance
          </div>
          <h1 className="mt-2 text-2xl font-bold text-slate-950">Engagement Command Center</h1>
          <p className="mt-1 text-sm text-slate-600">
            Track vendor touchpoints, plan shares, follow-ups, ownership, and territory performance in one queue.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {activeFilters ? (
            <Badge variant="outline" className="h-9 rounded-md px-3 text-slate-700">
              <Filter className="mr-2 h-3.5 w-3.5" />
              {activeFilters} filter{activeFilters > 1 ? 's' : ''}
            </Badge>
          ) : null}
          <Button variant="outline" onClick={() => load()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={Activity} label="Touchpoints" value={safeNumber(summary.total)} subtext="Current filtered view" />
        <StatCard icon={CalendarClock} label="Due follow-ups" value={safeNumber(summary.due_count || dueRows.length)} subtext="Needs action now" />
        <StatCard icon={Share2} label="Plans shared" value={safeNumber(summary.plan_shared_count)} subtext="Tracked with sales code" />
        <StatCard icon={CheckCircle2} label="Conversions" value={safeNumber(summary.converted_count)} subtext="Attributed wins" />
        <StatCard icon={Users} label="Vendors covered" value={safeNumber(summary.unique_vendors)} subtext={`${safeNumber(summary.unique_sales_users)} owner(s)`} />
      </div>

      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
            <div className="relative lg:col-span-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={filters.search}
                onChange={(event) => updateFilter('search', event.target.value)}
                placeholder="Search vendor, city, plan, sales user, phone..."
                className="pl-9"
              />
            </div>
            <Input
              className="lg:col-span-3"
              value={filters.vendor_id}
              onChange={(event) => updateFilter('vendor_id', event.target.value)}
              placeholder="Vendor code, UUID, email or phone"
            />
            <Select value={filters.engagement_type} onValueChange={(value) => updateFilter('engagement_type', value)}>
              <SelectTrigger className="lg:col-span-2">
                <SelectValue placeholder="Activity type" />
              </SelectTrigger>
              <SelectContent>
                {ENGAGEMENT_TYPES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.status} onValueChange={(value) => updateFilter('status', value)}>
              <SelectTrigger className="lg:col-span-2">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant={filters.due ? 'default' : 'outline'}
              className="lg:col-span-1"
              onClick={() => updateFilter('due', !filters.due)}
            >
              Due
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
            <Input
              type="date"
              value={filters.date_from}
              onChange={(event) => updateFilter('date_from', event.target.value)}
            />
            <Input
              type="date"
              value={filters.date_to}
              onChange={(event) => updateFilter('date_to', event.target.value)}
            />
            <Button onClick={() => load()} disabled={loading}>
              <Filter className="mr-2 h-4 w-4" />
              Apply
            </Button>
            <Button variant="outline" onClick={clearFilters} disabled={loading || !activeFilters}>
              <X className="mr-2 h-4 w-4" />
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-100">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">Recent Engagements</CardTitle>
            <p className="text-xs text-slate-500">{rows.length} record{rows.length === 1 ? '' : 's'} loaded</p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="grid h-64 place-items-center text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-md border border-dashed border-slate-300 bg-slate-50">
                <Activity className="h-5 w-5 text-slate-500" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-950">No matching engagement records</h3>
              {vendorMatches.length ? (
                <div className="mx-auto mt-4 max-w-2xl rounded-md border border-slate-200 bg-slate-50 p-4 text-left">
                  <p className="text-sm font-semibold text-slate-950">Matching vendor found in database</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {vendorMatches.slice(0, 4).map((vendor) => (
                      <div key={vendor.id || vendor.vendor_id} className="rounded-md border border-slate-200 bg-white p-3">
                        <p className="font-medium text-slate-950">{vendor.company_name || vendor.vendor_id || '-'}</p>
                        <p className="mt-1 text-xs text-slate-500">{vendor.vendor_id || '-'}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {[vendor.city, vendor.state, vendor.pincode].filter(Boolean).join(', ') || 'Location not set'}
                        </p>
                        {vendor.email || vendor.phone ? (
                          <p className="mt-1 text-xs text-slate-500">{[vendor.email, vendor.phone].filter(Boolean).join(' | ')}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    Vendor exists, but no sales engagement has been logged yet. Share a plan, create a reminder, or save a follow-up to create an activity record.
                  </p>
                </div>
              ) : (
                <p className="mx-auto mt-1 max-w-xl text-sm text-slate-500">
                  Plan shares, reminders, converted payments, and manual follow-ups will appear here once the sales team starts logging activity.
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Vendor</th>
                    <th className="px-4 py-3 text-left">Activity</th>
                    <th className="px-4 py-3 text-left">Plan</th>
                    <th className="px-4 py-3 text-left">Owner</th>
                    <th className="px-4 py-3 text-left">Territory</th>
                    <th className="px-4 py-3 text-left">Follow-up</th>
                    <th className="px-4 py-3 text-left">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => {
                    const vendorLocation = [row.vendor?.city, row.vendor?.state, row.vendor?.pincode].filter(Boolean).join(', ');
                    const divisionLocation = [row.division?.city?.name, row.division?.state?.name].filter(Boolean).join(', ');
                    return (
                      <tr key={row.id} className="align-top hover:bg-slate-50/70">
                        <td className="px-4 py-4">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 rounded-md border border-slate-200 bg-white p-2">
                              <Building2 className="h-4 w-4 text-slate-600" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-950">{row.vendor?.company_name || row.vendor_id || '-'}</p>
                              <p className="mt-0.5 text-xs text-slate-500">{row.vendor?.vendor_id || row.vendor_id || '-'}</p>
                              {vendorLocation ? (
                                <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                                  <MapPin className="h-3 w-3" />
                                  {vendorLocation}
                                </p>
                              ) : null}
                              <div className="mt-2 space-y-1 text-xs text-slate-500">
                                {row.vendor?.phone ? (
                                  <div className="flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    {row.vendor.phone}
                                  </div>
                                ) : null}
                                {row.vendor?.email ? (
                                  <div className="flex items-center gap-1">
                                    <Mail className="h-3 w-3" />
                                    {row.vendor.email}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline">{cleanLabel(row.engagement_type)}</Badge>
                            <Badge className={statusBadgeClass(row.status)} variant="outline">
                              {cleanLabel(row.status)}
                            </Badge>
                          </div>
                          <p className="mt-2 text-xs text-slate-500">{formatDateTime(row.created_at)}</p>
                          {row.channel ? <p className="mt-1 text-xs text-slate-500">Channel: {cleanLabel(row.channel)}</p> : null}
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-medium text-slate-900">{row.plan?.name || '-'}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {row.plan?.price !== undefined && row.plan?.price !== null ? formatMoney(row.plan.price) : ''}
                            {row.plan?.duration_days ? ` for ${row.plan.duration_days} days` : ''}
                          </p>
                          {row.sales_code ? (
                            <Badge variant="outline" className="mt-2 rounded-md">
                              Code: {row.sales_code}
                            </Badge>
                          ) : null}
                          {row.plan_share_url ? (
                            <a
                              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline"
                              href={row.plan_share_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <LinkIcon className="h-3 w-3" />
                              Open share link
                            </a>
                          ) : null}
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-medium text-slate-900">{row.sales_user?.full_name || row.sales_user?.email || row.sales_user_id || '-'}</p>
                          {row.sales_user?.sales_code ? <p className="mt-1 text-xs text-slate-500">{row.sales_user.sales_code}</p> : null}
                          <p className="mt-2 text-xs text-slate-500">
                            Manager: {row.manager_user?.full_name || row.manager_user?.email || row.manager_user_id || '-'}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-medium text-slate-900">{row.division?.name || row.division_id || '-'}</p>
                          <p className="mt-1 text-xs text-slate-500">{divisionLocation || '-'}</p>
                          <p className="mt-1 text-xs text-slate-500">Pincodes: {safeNumber(row.division?.pincode_count)}</p>
                        </td>
                        <td className="px-4 py-4">
                          <Badge
                            variant="outline"
                            className={isDue(row) ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-white text-slate-700'}
                          >
                            {isDue(row) ? 'Due now' : 'Scheduled'}
                          </Badge>
                          <p className="mt-2 text-xs text-slate-500">{formatDateTime(row.next_follow_up_at)}</p>
                        </td>
                        <td className="max-w-[260px] px-4 py-4">
                          <p className="line-clamp-3 text-sm text-slate-600">{row.notes || '-'}</p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TerritoryEngagements;
