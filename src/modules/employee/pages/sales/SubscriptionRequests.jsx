import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { salesApi } from '@/modules/employee/services/salesApi';

const ALL_VALUE = 'ALL';

const defaultForm = () => ({
  vendor_id: '',
  vendor_name: '',
  vendor_state: '',
  vendor_city: '',
  reason: '',
  extension_days: '',
  sales_note: '',
});

const safeNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const cleanLabel = (value) =>
  String(value || '-')
    .replaceAll('_', ' ')
    .trim();

const statusBadgeClass = (status) => {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'RESOLVED') return 'bg-emerald-50 border-emerald-200 text-emerald-700';
  if (normalized === 'REJECTED') return 'bg-red-50 border-red-200 text-red-700';
  if (normalized === 'FORWARDED') return 'bg-blue-50 border-blue-200 text-blue-700';
  return 'bg-amber-50 border-amber-200 text-amber-700';
};

const levelLabel = (level) => {
  const normalized = String(level || '').toUpperCase();
  if (normalized === 'SALES') return 'Manager review';
  if (normalized === 'MANAGER') return 'VP review';
  if (normalized === 'VP') return 'Admin resolution';
  if (normalized === 'ADMIN') return 'Admin';
  return cleanLabel(level);
};

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

function VendorSearchInput({ value, onSelect }) {
  const [query, setQuery] = useState(value || '');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  const search = useCallback(async (q) => {
    if (!q.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    setSearching(true);
    try {
      const data = await salesApi.searchVendors(q);
      setResults(Array.isArray(data) ? data : []);
      setOpen(true);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleInput = (event) => {
    const val = event.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 300);
  };

  const handleSelect = (vendor) => {
    onSelect(vendor);
    setQuery(vendor.company_name || '');
    setOpen(false);
    setResults([]);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setOpen(false);
    onSelect(null);
  };

  useEffect(() => {
    const handler = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <Input
        type="text"
        value={query}
        onChange={handleInput}
        placeholder="Search vendor company"
        className="pl-9 pr-9"
        autoComplete="off"
      />
      {query ? (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}

      {open ? (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {searching ? (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching vendors...
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-500">No vendors found</div>
          ) : (
            results.map((vendor) => (
              <button
                key={vendor.id}
                type="button"
                onClick={() => handleSelect(vendor)}
                className="flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-slate-50"
              >
                <Building2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-950">{vendor.company_name}</span>
                  <span className="block text-xs text-slate-500">
                    {[vendor.city, vendor.state].filter(Boolean).join(', ') || 'Location not set'}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {[vendor.vendor_id, vendor.email, vendor.phone].filter(Boolean).join(' | ')}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function SubscriptionRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(ALL_VALUE);

  const load = async () => {
    setLoading(true);
    try {
      const data = await salesApi.getMyExtensionRequests();
      setRequests(Array.isArray(data) ? data : []);
    } catch (error) {
      toast({ title: 'Load failed', description: error?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const open = requests.filter((row) => ['OPEN', 'FORWARDED'].includes(String(row.status || '').toUpperCase())).length;
    const resolved = requests.filter((row) => String(row.status || '').toUpperCase() === 'RESOLVED').length;
    const rejected = requests.filter((row) => String(row.status || '').toUpperCase() === 'REJECTED').length;
    const totalDays = requests.reduce((sum, row) => sum + safeNumber(row.extension_days), 0);
    return { open, resolved, rejected, totalDays };
  }, [requests]);

  const filteredRequests = useMemo(() => {
    const term = search.trim().toLowerCase();
    return requests.filter((row) => {
      if (status !== ALL_VALUE && String(row.status || '').toUpperCase() !== status) return false;
      if (!term) return true;
      return [row.vendor_name, row.vendor_state, row.reason, row.sales_note, row.current_level, row.status]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term);
    });
  }, [requests, search, status]);

  const handleVendorSelect = (vendor) => {
    if (!vendor) {
      setSelectedVendor(null);
      setForm((current) => ({ ...current, vendor_id: '', vendor_name: '', vendor_state: '', vendor_city: '' }));
      return;
    }
    setSelectedVendor(vendor);
    setForm((current) => ({
      ...current,
      vendor_id: vendor.id,
      vendor_name: vendor.company_name,
      vendor_state: vendor.state || '',
      vendor_city: vendor.city || '',
    }));
  };

  const updateFormField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const resetForm = () => {
    setForm(defaultForm());
    setSelectedVendor(null);
  };

  const handleSubmit = async () => {
    const days = parseInt(form.extension_days, 10);
    if (!form.vendor_id) return toast({ title: 'Please select a vendor', variant: 'destructive' });
    if (!form.reason.trim()) return toast({ title: 'Reason is required', variant: 'destructive' });
    if (!Number.isFinite(days) || days < 1 || days > 365) {
      return toast({ title: 'Extension days must be between 1 and 365', variant: 'destructive' });
    }

    setSubmitting(true);
    try {
      await salesApi.createExtensionRequest({
        vendor_id: form.vendor_id,
        vendor_name: form.vendor_name,
        vendor_state: form.vendor_state,
        reason: form.reason.trim(),
        extension_days: days,
        sales_note: form.sales_note.trim() || undefined,
      });
      toast({ title: 'Request submitted', description: 'Manager review queue has been updated.' });
      resetForm();
      setFormOpen(false);
      load();
    } catch (error) {
      toast({ title: 'Submit failed', description: error?.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <ShieldCheck className="h-4 w-4" />
            Subscription governance
          </div>
          <h1 className="mt-2 text-2xl font-bold text-slate-950">Extension Request Desk</h1>
          <p className="mt-1 text-sm text-slate-600">
            Raise vendor extension exceptions with enough commercial context for Manager, VP, and Admin approval.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Request
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={FileText} label="My requests" value={requests.length} subtext="All extension cases" />
        <StatCard icon={CalendarClock} label="Open pipeline" value={stats.open} subtext="Needs reviewer action" />
        <StatCard icon={CheckCircle2} label="Resolved" value={stats.resolved} subtext={`${stats.rejected} rejected`} />
        <StatCard icon={AlertTriangle} label="Days requested" value={stats.totalDays} subtext="Commercial exception size" />
      </div>

      <Card className="border-slate-200">
        <CardContent className="grid grid-cols-1 gap-3 p-4 lg:grid-cols-4">
          {[
            ['Sales', 'Capture vendor issue and business reason'],
            ['Manager', 'Validate account context and ROI risk'],
            ['VP', 'Approve regional exception and priority'],
            ['Admin', 'Apply extension and close request'],
          ].map(([title, description], index) => (
            <div key={title} className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-white text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                  {index + 1}
                </span>
                <p className="font-semibold text-slate-950">{title}</p>
              </div>
              <p className="mt-2 text-xs text-slate-500">{description}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-100">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle className="text-base">My Request Queue</CardTitle>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(220px,320px)_180px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search vendor, reason, state"
                  className="pl-9"
                />
              </div>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>All statuses</SelectItem>
                  <SelectItem value="OPEN">Open</SelectItem>
                  <SelectItem value="FORWARDED">Forwarded</SelectItem>
                  <SelectItem value="RESOLVED">Resolved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="grid h-56 place-items-center text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-md border border-dashed border-slate-300 bg-slate-50">
                <FileText className="h-5 w-5 text-slate-500" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-950">No extension requests match this view</h3>
              <p className="mx-auto mt-1 max-w-xl text-sm text-slate-500">
                Use this desk for vendors who need retention support, technical recovery time, or strategic account exceptions.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1040px] text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Vendor</th>
                    <th className="px-4 py-3 text-left">Exception</th>
                    <th className="px-4 py-3 text-left">Stage</th>
                    <th className="px-4 py-3 text-left">Reviewer Notes</th>
                    <th className="px-4 py-3 text-left">Outcome</th>
                    <th className="px-4 py-3 text-left">Raised</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRequests.map((row) => (
                    <tr key={row.id} className="align-top hover:bg-slate-50/70">
                      <td className="px-4 py-4">
                        <p className="font-semibold text-slate-950">{row.vendor_name || '-'}</p>
                        <p className="mt-1 text-xs text-slate-500">{row.vendor_state || 'State not set'}</p>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{safeNumber(row.extension_days)} days</Badge>
                          <Badge className={statusBadgeClass(row.status)} variant="outline">
                            {cleanLabel(row.status)}
                          </Badge>
                        </div>
                        <p className="mt-2 max-w-[320px] text-sm text-slate-700">{row.reason || '-'}</p>
                        {row.sales_note ? <p className="mt-1 max-w-[320px] text-xs text-slate-500">Sales note: {row.sales_note}</p> : null}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <ArrowUpRight className="h-4 w-4 text-blue-600" />
                          <span className="font-medium text-slate-900">{levelLabel(row.current_level)}</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">Current level: {cleanLabel(row.current_level)}</p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="max-w-[260px] text-xs text-slate-600">
                          {row.manager_note ? `Manager: ${row.manager_note}` : 'Manager note pending'}
                        </p>
                        <p className="mt-1 max-w-[260px] text-xs text-slate-600">
                          {row.vp_note ? `VP: ${row.vp_note}` : 'VP note pending'}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        {row.extension_granted_days ? (
                          <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700" variant="outline">
                            {row.extension_granted_days} days granted
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-500">Awaiting decision</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-xs text-slate-500">{formatDate(row.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          if (submitting) return;
          setFormOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>New Subscription Extension Request</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Vendor</label>
              <VendorSearchInput value={form.vendor_name} onSelect={handleVendorSelect} />
            </div>

            {selectedVendor ? (
              <div className="rounded-md border border-blue-100 bg-blue-50 p-3">
                <div className="flex items-start gap-3">
                  <Building2 className="mt-0.5 h-5 w-5 text-blue-700" />
                  <div>
                    <p className="font-semibold text-slate-950">{selectedVendor.company_name}</p>
                    <p className="text-xs text-slate-600">
                      {[selectedVendor.city, selectedVendor.state].filter(Boolean).join(', ') || 'Location not available'}
                    </p>
                    {selectedVendor.email ? <p className="mt-1 text-xs text-slate-500">{selectedVendor.email}</p> : null}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Extension Days</label>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={form.extension_days}
                  onChange={(event) => updateFormField('extension_days', event.target.value)}
                  placeholder="e.g. 30"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Vendor State</label>
                <Input value={form.vendor_state} readOnly placeholder="Auto-filled" className="bg-slate-50 text-slate-500" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-slate-700">Business Reason</label>
                <textarea
                  id="subscription-extension-business-reason"
                  name="subscription_extension_business_reason"
                  rows={4}
                  value={form.reason}
                  onInput={(event) => updateFormField('reason', event.currentTarget.value)}
                  onChange={(event) => updateFormField('reason', event.currentTarget.value)}
                  placeholder="Explain retention risk, service issue, account value, or why extension is commercially justified."
                  data-disable-auto-sanitize="true"
                  className="flex min-h-[120px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-slate-950 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-slate-700">Internal Sales Note</label>
                <textarea
                  id="subscription-extension-sales-note"
                  name="subscription_extension_sales_note"
                  rows={3}
                  value={form.sales_note}
                  onInput={(event) => updateFormField('sales_note', event.currentTarget.value)}
                  onChange={(event) => updateFormField('sales_note', event.currentTarget.value)}
                  placeholder="Add context for the manager review queue."
                  data-disable-auto-sanitize="true"
                  className="flex min-h-[96px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-slate-950 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={submitting || !selectedVendor}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Submit To Manager
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
