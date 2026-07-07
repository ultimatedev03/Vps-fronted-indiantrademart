import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardList,
  Database,
  ExternalLink,
  Headphones,
  Package,
  RefreshCw,
  Search,
  ShieldAlert,
  Tags,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { dbClient } from '@/lib/dbClient';

const TEAM_OPTIONS = [
  { value: 'ADMIN', label: 'Admin', icon: ShieldAlert, caseType: 'SUSPENSION_REVIEW' },
  { value: 'DATA_ENTRY', label: 'Data Entry', icon: Database, caseType: 'PRODUCT_LISTING' },
  { value: 'SALES', label: 'Sales', icon: Tags, caseType: 'PLAN_UPGRADE' },
  { value: 'SUPPORT', label: 'Support', icon: Headphones, caseType: 'GENERAL_SUPPORT' },
];

const CASE_OPTIONS = [
  { value: 'SUSPENSION_REVIEW', label: 'Suspension review' },
  { value: 'PRODUCT_LISTING', label: 'Product listing' },
  { value: 'PRODUCT_REMOVAL', label: 'Product removal' },
  { value: 'PLAN_UPGRADE', label: 'Plan upgrade' },
  { value: 'KYC_REVIEW', label: 'KYC review' },
  { value: 'GENERAL_SUPPORT', label: 'General support' },
];

const PRIORITY_OPTIONS = ['MEDIUM', 'HIGH', 'URGENT', 'LOW'];

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
};

const money = (value) => {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return 'Rs 0';
  return `Rs ${Math.round(n).toLocaleString('en-IN')}`;
};

const statusClass = (status = '', dark = false) => {
  const value = String(status || '').toUpperCase();
  if (['ACTIVE', 'APPROVED', 'RESOLVED', 'CLOSED'].includes(value)) {
    return dark ? 'bg-emerald-900 text-emerald-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }
  if (['SUSPENDED', 'TERMINATED', 'URGENT', 'HIGH'].includes(value)) {
    return dark ? 'bg-red-950 text-red-200' : 'bg-red-50 text-red-700 border-red-200';
  }
  if (['OPEN', 'IN_PROGRESS', 'PENDING', 'SUBMITTED'].includes(value)) {
    return dark ? 'bg-amber-950 text-amber-200' : 'bg-amber-50 text-amber-700 border-amber-200';
  }
  return dark ? 'bg-neutral-800 text-neutral-300' : 'bg-slate-50 text-slate-600 border-slate-200';
};

const shortId = (value = '') => {
  const raw = String(value || '');
  if (raw.length <= 14) return raw || '-';
  return `${raw.slice(0, 7)}...${raw.slice(-5)}`;
};

const getName = (vendor) =>
  vendor?.profile?.company_name ||
  vendor?.profile?.owner_name ||
  vendor?.profile?.email ||
  vendor?.profile?.vendor_id ||
  'Unnamed vendor';

const getPlanLabel = (plan) => {
  if (!plan) return 'No plan';
  return plan.plan_name || plan.name || plan.plan_id || 'Plan';
};

const Search360Workspace = ({
  api,
  title = 'Search 360',
  description = 'Unified vendor profile, products, plan, account status, and escalation context.',
  dark = false,
  roleLabel = '',
  impersonationApi = null,
}) => {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState({ vendors: [], actor: {}, scope: {} });
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [caseBusyId, setCaseBusyId] = useState('');
  const [impersonating, setImpersonating] = useState(false);
  const [draft, setDraft] = useState({
    target_team: '',
    case_type: 'GENERAL_SUPPORT',
    priority: 'MEDIUM',
    note: '',
  });

  const vendors = result?.vendors || [];
  const selected = useMemo(
    () => vendors.find((vendor) => vendor.id === selectedId) || vendors[0] || null,
    [vendors, selectedId]
  );
  const permissions = result?.actor?.permissions || {};
  const actorRole = String(result?.actor?.role || '').toUpperCase();
  const allowedTargets = permissions.allowed_targets || [];
  const targetOptions = TEAM_OPTIONS.filter((team) => allowedTargets.includes(team.value));

  const shellClass = dark
    ? 'text-neutral-100'
    : 'text-slate-950';
  const panelClass = dark
    ? 'rounded-lg border border-neutral-800 bg-neutral-950/80'
    : 'rounded-lg border border-slate-200 bg-white shadow-sm';
  const mutedClass = dark ? 'text-neutral-400' : 'text-slate-500';
  const inputClass = dark
    ? 'border-neutral-800 bg-neutral-900 text-neutral-100 placeholder:text-neutral-500'
    : 'border-slate-200 bg-white';

  const load = async (nextQuery = query) => {
    setLoading(true);
    try {
      const data = await api.search({ query: nextQuery, limit: 25 });
      setResult(data || { vendors: [] });
      const rows = data?.vendors || [];
      setSelectedId((current) => (rows.some((row) => row.id === current) ? current : rows[0]?.id || ''));
    } catch (error) {
      toast({
        title: 'Search 360 failed',
        description: error?.message || 'Could not load vendor intelligence.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!draft.target_team && targetOptions.length) {
      setDraft((current) => ({
        ...current,
        target_team: targetOptions[0].value,
        case_type: targetOptions[0].caseType,
      }));
    }
  }, [draft.target_team, targetOptions]);

  const submitEscalation = async () => {
    if (!selected?.id || !draft.target_team || !draft.note.trim()) return;
    setSaving(true);
    try {
      await api.escalate({
        vendor_id: selected.id,
        target_team: draft.target_team,
        case_type: draft.case_type,
        priority: draft.priority,
        note: draft.note.trim(),
      });
      toast({ title: 'Escalation created', description: `${TEAM_OPTIONS.find((t) => t.value === draft.target_team)?.label || draft.target_team} has been notified.` });
      setDraft((current) => ({ ...current, note: '' }));
      await load(query);
    } catch (error) {
      toast({
        title: 'Escalation failed',
        description: error?.message || 'Could not create Search 360 case.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const resolveCase = async (item) => {
    if (!item?.id) return;
    setCaseBusyId(item.id);
    try {
      await api.updateCaseStatus(item.id, {
        status: 'RESOLVED',
        resolution_note: 'Resolved from Search 360 workspace.',
      });
      toast({ title: 'Case resolved', description: item.subject || item.case_type });
      await load(query);
    } catch (error) {
      toast({
        title: 'Could not update case',
        description: error?.message || 'Permission or backend error.',
        variant: 'destructive',
      });
    } finally {
      setCaseBusyId('');
    }
  };

  const setQuickTarget = (team) => {
    setDraft((current) => ({
      ...current,
      target_team: team.value,
      case_type: team.caseType,
    }));
  };

  const canResolveCase = (item) => {
    const status = String(item?.status || '').toUpperCase();
    if (['RESOLVED', 'CLOSED'].includes(status)) return false;
    if (!permissions.can_update_cases) return false;
    if (['ADMIN', 'SUPERADMIN', 'GODMODE', 'MANAGER', 'VP'].includes(actorRole)) return true;
    const target = String(item?.target_team || '').toUpperCase();
    return actorRole === target || (actorRole === 'DATA_ENTRY' && target === 'DATA_ENTRY');
  };

  const canOpenAssistedVendor =
    !!impersonationApi?.start &&
    !!selected?.id &&
    ['SUPERADMIN', 'GODMODE'].includes(actorRole);

  const openAssistedVendorDashboard = async () => {
    if (!canOpenAssistedVendor || impersonating) return;
    setImpersonating(true);
    try {
      const data = await impersonationApi.start({
        target_type: 'VENDOR',
        target_id: selected.id,
      });
      const next = data?.next || '/vendor/dashboard';
      await dbClient.auth.setSession();
      toast({
        title: 'Opening vendor dashboard',
        description: `Assisted access started for ${getName(selected)}.`,
      });
      if (typeof window !== 'undefined') {
        window.location.assign(next);
      }
    } catch (error) {
      toast({
        title: 'Could not open vendor dashboard',
        description: error?.message || 'Assisted access failed.',
        variant: 'destructive',
      });
    } finally {
      setImpersonating(false);
    }
  };

  return (
    <div className={`space-y-4 text-sm ${shellClass}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className={`text-xl font-semibold ${dark ? 'text-white' : 'text-slate-950'}`}>{title}</h1>
            {roleLabel ? <Badge className={statusClass(roleLabel, dark)}>{roleLabel}</Badge> : null}
          </div>
          <p className={`mt-1 max-w-3xl text-xs ${mutedClass}`}>{description}</p>
        </div>
        <div className={`text-xs ${mutedClass}`}>
          Scope: <span className={dark ? 'text-neutral-200' : 'text-slate-700'}>{result?.scope?.mode || 'Loading'}</span>
        </div>
      </div>

      <div className={`${panelClass} p-3`}>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className={`absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${mutedClass}`} />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') load(query);
              }}
              className={`h-10 pl-9 text-sm ${inputClass}`}
              placeholder="Search vendor, owner, email, phone, GST, city, state..."
            />
          </div>
          <Button onClick={() => load(query)} disabled={loading} className="h-10 bg-blue-600 hover:bg-blue-700">
            <Search className="mr-2 h-4 w-4" />
            Search
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setQuery('');
              load('');
            }}
            disabled={loading}
            className={dark ? 'h-10 border-neutral-800 text-neutral-200 hover:bg-neutral-900' : 'h-10'}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className={`${panelClass} min-h-[420px] overflow-hidden`}>
          <div className={`border-b p-3 ${dark ? 'border-neutral-800' : 'border-slate-100'}`}>
            <div className="flex items-center justify-between">
              <p className="font-medium">Results</p>
              <span className={`text-xs ${mutedClass}`}>{result?.total ?? vendors.length} found</span>
            </div>
          </div>
          <div className="max-h-[650px] overflow-y-auto p-2">
            {loading ? (
              <p className={`p-4 text-xs ${mutedClass}`}>Loading vendor intelligence...</p>
            ) : vendors.length ? (
              vendors.map((vendor) => {
                const active = selected?.id === vendor.id;
                return (
                  <button
                    type="button"
                    key={vendor.id}
                    onClick={() => setSelectedId(vendor.id)}
                    className={`mb-2 w-full rounded-md border p-3 text-left transition ${
                      active
                        ? dark
                          ? 'border-blue-500 bg-blue-950/40'
                          : 'border-blue-300 bg-blue-50'
                        : dark
                          ? 'border-neutral-800 bg-neutral-900 hover:bg-neutral-800'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{getName(vendor)}</p>
                        <p className={`mt-0.5 truncate text-xs ${mutedClass}`}>{vendor.profile?.email || vendor.profile?.phone || shortId(vendor.id)}</p>
                      </div>
                      <Badge className={statusClass(vendor.account?.status_label, dark)}>
                        {vendor.account?.status_label || 'ACTIVE'}
                      </Badge>
                    </div>
                    <div className={`mt-2 flex flex-wrap gap-2 text-xs ${mutedClass}`}>
                      <span>{vendor.profile?.state || 'No state'}</span>
                      <span>{vendor.products?.total || 0} products</span>
                      <span>{getPlanLabel(vendor.plan)}</span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className={`p-6 text-center text-xs ${mutedClass}`}>
                <Search className="mx-auto mb-2 h-6 w-6" />
                No vendors matched this search.
              </div>
            )}
          </div>
        </div>

        {selected ? (
          <div className="space-y-4">
            <div className={`${panelClass} p-4`}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Building2 className={dark ? 'h-5 w-5 text-blue-300' : 'h-5 w-5 text-blue-600'} />
                    <h2 className="truncate text-lg font-semibold">{getName(selected)}</h2>
                    <Badge className={statusClass(selected.account?.status_label, dark)}>
                      {selected.account?.status_label || 'ACTIVE'}
                    </Badge>
                    {selected.account?.is_suspended ? (
                      <Badge className={statusClass('SUSPENDED', dark)}>
                        <AlertTriangle className="mr-1 h-3 w-3" />
                        Needs admin
                      </Badge>
                    ) : null}
                  </div>
                  <div className={`mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs ${mutedClass}`}>
                    <span>ID: {selected.profile?.vendor_id || shortId(selected.id)}</span>
                    <span>{selected.profile?.owner_name || 'Owner not set'}</span>
                    <span>{selected.profile?.email || 'No email'}</span>
                    <span>{selected.profile?.phone || 'No phone'}</span>
                    <span>{[selected.profile?.city, selected.profile?.state].filter(Boolean).join(', ') || 'Region unmapped'}</span>
                  </div>
                  {selected.account?.reason ? (
                    <p className={`mt-2 rounded-md px-3 py-2 text-xs ${dark ? 'bg-red-950/40 text-red-200' : 'bg-red-50 text-red-700'}`}>
                      {selected.account.reason}
                    </p>
                  ) : null}
                </div>
                <div className={`grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 lg:min-w-[420px]`}>
                  <Metric icon={Package} label="Products" value={selected.products?.total || 0} dark={dark} />
                  <Metric icon={CheckCircle2} label="Active" value={selected.products?.active || 0} dark={dark} />
                  <Metric icon={ClipboardList} label="Open Tickets" value={selected.support?.open || 0} dark={dark} />
                  <Metric icon={Tags} label="Plan" value={getPlanLabel(selected.plan)} dark={dark} />
                </div>
              </div>
              {canOpenAssistedVendor ? (
                <div className="mt-3 flex justify-end">
                  <Button
                    type="button"
                    onClick={openAssistedVendorDashboard}
                    disabled={impersonating}
                    className="h-9 bg-emerald-700 text-xs text-white hover:bg-emerald-600"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    {impersonating ? 'Opening...' : 'Open Vendor Dashboard'}
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="space-y-4">
                <Section title="Profile" icon={Users} dark={dark}>
                  <DetailGrid
                    dark={dark}
                    rows={[
                      ['KYC', selected.profile?.kyc_status || '-'],
                      ['Completion', `${selected.profile?.profile_completion || 0}%`],
                      ['GST', selected.profile?.gst_number || '-'],
                      ['PAN', selected.profile?.pan_number || '-'],
                      ['Business', selected.profile?.primary_business_type || '-'],
                      ['Updated', formatDate(selected.profile?.updated_at)],
                    ]}
                  />
                </Section>

                <Section title="Products Listed" icon={Package} dark={dark}>
                  {selected.products?.recent?.length ? (
                    <div className="divide-y divide-slate-100 dark:divide-neutral-800">
                      {selected.products.recent.map((product) => (
                        <div key={product.id} className="flex items-center justify-between gap-3 py-2 text-xs">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{product.name || 'Untitled product'}</p>
                            <p className={mutedClass}>{product.category || '-'} | {formatDate(product.created_at)}</p>
                          </div>
                          <Badge className={statusClass(product.status, dark)}>{product.status || 'DRAFT'}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className={`text-xs ${mutedClass}`}>No products listed.</p>
                  )}
                </Section>

                <Section title="Support And Escalation Cases" icon={Headphones} dark={dark}>
                  <div className="space-y-2">
                    {(selected.cases || []).length ? selected.cases.map((item) => (
                      <div key={item.id} className={`rounded-md border p-3 text-xs ${dark ? 'border-neutral-800 bg-neutral-900' : 'border-slate-200 bg-slate-50'}`}>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold">{item.subject || item.case_type}</p>
                            <p className={mutedClass}>{item.target_team} | {item.source_role} | {formatDate(item.created_at)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={statusClass(item.status, dark)}>{item.status}</Badge>
                            {canResolveCase(item) ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className={dark ? 'h-7 border-neutral-700 text-xs text-neutral-200' : 'h-7 text-xs'}
                                disabled={caseBusyId === item.id}
                                onClick={() => resolveCase(item)}
                              >
                                Resolve
                              </Button>
                            ) : null}
                          </div>
                        </div>
                        {item.note ? <p className={`mt-2 ${mutedClass}`}>{item.note}</p> : null}
                      </div>
                    )) : (
                      <p className={`text-xs ${mutedClass}`}>No Search 360 cases yet.</p>
                    )}
                  </div>
                </Section>
              </div>

              <div className="space-y-4">
                <Section title="Current Plan" icon={Tags} dark={dark}>
                  {selected.plan ? (
                    <DetailGrid
                      dark={dark}
                      rows={[
                        ['Plan', getPlanLabel(selected.plan)],
                        ['Status', selected.plan.status || '-'],
                        ['Price', money(selected.plan.plan_price)],
                        ['End date', formatDate(selected.plan.end_date)],
                        ['Sales code', selected.plan.sales_code || '-'],
                      ]}
                    />
                  ) : (
                    <p className={`text-xs ${mutedClass}`}>No active plan history found.</p>
                  )}
                </Section>

                <Section title="Escalate" icon={ArrowRight} dark={dark}>
                  {targetOptions.length ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 gap-2">
                        {targetOptions.map((team) => {
                          const Icon = team.icon;
                          const active = draft.target_team === team.value;
                          return (
                            <button
                              key={team.value}
                              type="button"
                              onClick={() => setQuickTarget(team)}
                              className={`flex items-center justify-between rounded-md border px-3 py-2 text-left text-xs transition ${
                                active
                                  ? dark
                                    ? 'border-blue-500 bg-blue-950 text-blue-100'
                                    : 'border-blue-300 bg-blue-50 text-blue-800'
                                  : dark
                                    ? 'border-neutral-800 bg-neutral-900 text-neutral-200 hover:bg-neutral-800'
                                    : 'border-slate-200 bg-white hover:bg-slate-50'
                              }`}
                            >
                              <span className="flex items-center gap-2">
                                <Icon className="h-4 w-4" />
                                {team.label}
                              </span>
                              <ArrowRight className="h-3.5 w-3.5" />
                            </button>
                          );
                        })}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <Select
                          value={draft.case_type}
                          onValueChange={(value) => setDraft((current) => ({ ...current, case_type: value }))}
                        >
                          <SelectTrigger className={`h-9 text-xs ${inputClass}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CASE_OPTIONS.map((item) => (
                              <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={draft.priority}
                          onValueChange={(value) => setDraft((current) => ({ ...current, priority: value }))}
                        >
                          <SelectTrigger className={`h-9 text-xs ${inputClass}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PRIORITY_OPTIONS.map((item) => (
                              <SelectItem key={item} value={item}>{item}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Textarea
                        value={draft.note}
                        onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
                        className={`min-h-24 text-sm ${inputClass}`}
                        placeholder="Add issue context, customer expectation, and next action..."
                      />
                      <Button
                        onClick={submitEscalation}
                        disabled={saving || !draft.note.trim()}
                        className="w-full bg-blue-600 hover:bg-blue-700"
                      >
                        {saving ? 'Creating...' : 'Create Search 360 Case'}
                      </Button>
                    </div>
                  ) : (
                    <p className={`text-xs ${mutedClass}`}>This role has view-only access.</p>
                  )}
                </Section>

                <Section title="Recent Tickets" icon={ClipboardList} dark={dark}>
                  {(selected.support?.recent || []).length ? (
                    <div className="space-y-2">
                      {selected.support.recent.map((ticket) => (
                        <div key={ticket.id} className={`rounded-md border p-2 text-xs ${dark ? 'border-neutral-800 bg-neutral-900' : 'border-slate-200 bg-slate-50'}`}>
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate font-medium">{ticket.subject || ticket.ticket_display_id}</p>
                            <Badge className={statusClass(ticket.status, dark)}>{ticket.status || 'OPEN'}</Badge>
                          </div>
                          <p className={mutedClass}>{ticket.ticket_display_id || shortId(ticket.id)} | {formatDate(ticket.created_at)}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className={`text-xs ${mutedClass}`}>No support tickets found.</p>
                  )}
                </Section>
              </div>
            </div>
          </div>
        ) : (
          <div className={`${panelClass} flex min-h-[420px] items-center justify-center p-8 text-center`}>
            <div>
              <Search className={`mx-auto mb-3 h-8 w-8 ${mutedClass}`} />
              <p className="font-medium">Search a vendor to open the 360 view.</p>
              <p className={`mt-1 text-xs ${mutedClass}`}>Profile, products, plan, account status, tickets, and escalation history load together.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const Metric = ({ icon: Icon, label, value, dark }) => (
  <div className={`rounded-md border p-2 ${dark ? 'border-neutral-800 bg-neutral-900' : 'border-slate-200 bg-slate-50'}`}>
    <div className="flex items-center gap-1.5">
      <Icon className={dark ? 'h-3.5 w-3.5 text-neutral-400' : 'h-3.5 w-3.5 text-slate-500'} />
      <span className={dark ? 'text-neutral-400' : 'text-slate-500'}>{label}</span>
    </div>
    <p className="mt-1 truncate font-semibold">{value}</p>
  </div>
);

const Section = ({ title, icon: Icon, children, dark }) => (
  <section className={`rounded-lg border p-4 ${dark ? 'border-neutral-800 bg-neutral-950/80' : 'border-slate-200 bg-white shadow-sm'}`}>
    <div className="mb-3 flex items-center gap-2">
      <Icon className={dark ? 'h-4 w-4 text-blue-300' : 'h-4 w-4 text-blue-600'} />
      <h3 className="text-sm font-semibold">{title}</h3>
    </div>
    {children}
  </section>
);

const DetailGrid = ({ rows, dark }) => (
  <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
    {rows.map(([label, value]) => (
      <div key={label} className={`rounded-md border px-3 py-2 text-xs ${dark ? 'border-neutral-800 bg-neutral-900' : 'border-slate-100 bg-slate-50'}`}>
        <dt className={dark ? 'text-neutral-400' : 'text-slate-500'}>{label}</dt>
        <dd className="mt-1 truncate font-medium">{value}</dd>
      </div>
    ))}
  </dl>
);

export default Search360Workspace;
