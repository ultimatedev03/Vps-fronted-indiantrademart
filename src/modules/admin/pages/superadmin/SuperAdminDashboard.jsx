import React, { useEffect, useMemo, useState } from 'react';
import { useSuperAdmin } from '@/modules/admin/context/SuperAdminContext';
import { superAdminServerApi } from '@/modules/admin/services/superAdminServerApi';
import { toast } from '@/components/ui/use-toast';
import { filterRecordsBySearch } from '@/modules/admin/lib/search';
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
} from 'lucide-react';

// SUPERADMIN (ITM Owner) can only create ADMIN employees.
// ADMIN creates HR/FINANCE. HR creates SALES/SUPPORT/DATA_ENTRY/MANAGER/VP.
const EMPLOYEE_ROLES = ['ADMIN'];
const NOTICE_VARIANTS = ['info', 'warning', 'critical'];
const PLAN_BADGE_VARIANTS = ['neutral', 'green', 'blue', 'purple', 'gold', 'diamond', 'slate'];
const VENDOR_FETCH_BATCH_SIZE = 500;

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

  let originalPrice = configuredOriginal;
  if ((!Number.isFinite(originalPrice) || originalPrice <= 0) && discountPercent > 0 && discountPercent < 100) {
    originalPrice = Number(((currentPrice * 100) / (100 - discountPercent)).toFixed(2));
  }
  if (!Number.isFinite(originalPrice) || originalPrice <= currentPrice) originalPrice = 0;

  return {
    original_price: originalPrice,
    discount_percent: Number.isFinite(discountPercent) ? Math.max(0, Math.min(100, discountPercent)) : 0,
    discount_label: String(pricing.discount_label || '').trim(),
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

const planToDraft = (plan) => {
  const pricing = getPlanPricingMeta(plan);
  const coverage = getPlanCoverageMeta(plan);
  return {
    name: String(plan?.name || ''),
    description: String(plan?.description || ''),
    price: Number(plan?.price || 0),
    daily_limit: Number(plan?.daily_limit || 0),
    weekly_limit: Number(plan?.weekly_limit || 0),
    yearly_limit: Number(plan?.yearly_limit || 0),
    duration_days: Number(plan?.duration_days || 365),
    is_active: plan?.is_active !== false,
    original_price: Number(pricing.original_price || 0),
    discount_percent: Number(pricing.discount_percent || 0),
    discount_label: pricing.discount_label,
    extra_lead_price: Number(pricing.extra_lead_price || 0),
    badge_label: pricing.badge_label,
    badge_variant: pricing.badge_variant,
    states_limit: Number(coverage.states_limit || 0),
    cities_limit: Number(coverage.cities_limit || 0),
  };
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
  const [vendorDeletingId, setVendorDeletingId] = useState(null);

  // Plans
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [planSavingId, setPlanSavingId] = useState(null);
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
    extra_lead_price: 0,
    badge_label: '',
    badge_variant: 'neutral',
    states_limit: 0,
    cities_limit: 0,
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
  const [monitoringActivityDays, setMonitoringActivityDays] = useState(7);
  const [statesScopeModalOpen, setStatesScopeModalOpen] = useState(false);
  const [statesScopeTarget, setStatesScopeTarget] = useState(null);
  const [statesScopeSelection, setStatesScopeSelection] = useState([]);
  const [statesScopeSaving, setStatesScopeSaving] = useState(false);

  // Settings
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [passwordSaving, setPasswordSaving] = useState(false);

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
        setSystemConfig((prev) => ({
          ...prev,
          ...config,
          maintenance_mode: config.maintenance_mode === true,
          maintenance_message: config.maintenance_message || '',
          public_notice_enabled: config.public_notice_enabled === true,
          public_notice_message: config.public_notice_message || '',
          public_notice_variant: config.public_notice_variant || prev.public_notice_variant,
        }));
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
      setPages(pageList || []);
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
        include_inactive: true,
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
    try {
      const [overviewRes, activityRes, revenueRes] = await Promise.all([
        superAdminServerApi.monitoring.overview(),
        superAdminServerApi.monitoring.adminActivity(days),
        superAdminServerApi.monitoring.revenueByState(),
      ]);
      setMonitoringOverview(overviewRes?.data || null);
      setMonitoringActivity(activityRes?.data || null);
      setMonitoringRevenue(revenueRes?.data || []);
    } catch (err) {
      handleError(err, 'Failed to load monitoring data');
    } finally {
      setMonitoringLoading(false);
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

  const filteredVendors = useMemo(() => {
    if (!vendorSearch.trim()) return vendors;
    return filterRecordsBySearch(vendors, vendorSearch, {
      exactIdKeys: ['id', 'vendor_id'],
      exactEmailKeys: ['email'],
      broadKeys: ['id', 'vendor_id', 'company_name', 'owner_name', 'email', 'city', 'state'],
    });
  }, [vendors, vendorSearch]);

  const filteredPlans = useMemo(() => {
    const term = planSearch.trim().toLowerCase();
    if (!term) return plans;
    return (plans || []).filter((plan) =>
      [plan?.name, plan?.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [plans, planSearch]);

  const draftToPayload = (draft) => ({
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
    extra_lead_price: Number(draft?.extra_lead_price || 0),
    badge_label: String(draft?.badge_label || '').trim(),
    badge_variant: String(draft?.badge_variant || 'neutral').trim() || 'neutral',
    states_limit: Number(draft?.states_limit || 0),
    cities_limit: Number(draft?.cities_limit || 0),
  });

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
      extra_lead_price: 0,
      badge_label: '',
      badge_variant: 'neutral',
      states_limit: 0,
      cities_limit: 0,
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

  const saveSystemConfig = async () => {
    setSystemSaving(true);
    try {
      await superAdminServerApi.system.updateConfig({
        maintenance_mode: systemConfig.maintenance_mode === true,
        maintenance_message: systemConfig.maintenance_message || '',
        public_notice_enabled: systemConfig.public_notice_enabled === true,
        public_notice_message: systemConfig.public_notice_message || '',
        public_notice_variant: systemConfig.public_notice_variant || 'info',
      });
      toast({ title: 'Saved', description: 'System configuration updated.' });
      await fetchAuditLogs();
    } catch (error) {
      handleError(error, 'Failed to save system config');
    } finally {
      setSystemSaving(false);
    }
  };

  const updatePageStatus = async (pageId, updates) => {
    setPageBusyId(pageId);
    try {
      const { page } = await superAdminServerApi.pages.update(pageId, updates);
      setPages((prev) => (prev || []).map((p) => (p.id === pageId ? { ...p, ...page } : p)));
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

  if (!superAdmin) return null;

  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-200">
      <header className="bg-black border-b border-neutral-800 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <ShieldAlert className={`h-8 w-8 ${isGodMode ? 'text-red-600' : 'text-yellow-500'}`} />
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              {isGodMode ? '🔥 GOD MODE' : '👑 SUPER ADMIN'}
            </h1>
            <p className="text-xs text-neutral-500 font-mono">
              {isGodMode ? 'Developer Console — Full Platform Access' : 'ITM Owner Console — Business Control'}
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

      <main className="p-6 max-w-7xl mx-auto space-y-6">
        <Tabs defaultValue="system" className="space-y-6">
          <TabsList className="bg-neutral-800 border border-neutral-700 p-1 flex flex-wrap">
            <TabsTrigger value="system" className="data-[state=active]:bg-neutral-700">
              <Wrench className="h-4 w-4 mr-2" /> System
            </TabsTrigger>
            <TabsTrigger value="employees" className="data-[state=active]:bg-neutral-700">
              <Users className="h-4 w-4 mr-2" /> Employees
            </TabsTrigger>
            <TabsTrigger value="vendors" className="data-[state=active]:bg-neutral-700">
              <Building2 className="h-4 w-4 mr-2" /> Vendors
            </TabsTrigger>
            <TabsTrigger value="plans" className="data-[state=active]:bg-neutral-700">
              <Package className="h-4 w-4 mr-2" /> Plans
            </TabsTrigger>
            <TabsTrigger value="finance" className="data-[state=active]:bg-neutral-700">
              <IndianRupee className="h-4 w-4 mr-2" /> Finance
            </TabsTrigger>
            <TabsTrigger value="monitoring" className="data-[state=active]:bg-neutral-700" onClick={() => { if (!monitoringOverview && !monitoringLoading) fetchMonitoring(); }}>
              <BarChart3 className="h-4 w-4 mr-2" /> Monitoring
            </TabsTrigger>
            <TabsTrigger value="audit" className="data-[state=active]:bg-neutral-700">
              <History className="h-4 w-4 mr-2" /> Audit Logs
            </TabsTrigger>
            <TabsTrigger value="settings" className="data-[state=active]:bg-neutral-700">
              <Settings className="h-4 w-4 mr-2" /> Security
            </TabsTrigger>
            {/* GOD MODE only tab */}
            {isGodMode && (
              <TabsTrigger value="godmode" className="data-[state=active]:bg-red-900 text-red-400 data-[state=active]:text-red-200">
                <ShieldAlert className="h-4 w-4 mr-2" /> GOD MODE
              </TabsTrigger>
            )}
          </TabsList>

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
                    checked={systemConfig.maintenance_mode === true}
                    onCheckedChange={(checked) =>
                      setSystemConfig((prev) => ({ ...prev, maintenance_mode: checked }))
                    }
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
                    checked={systemConfig.public_notice_enabled === true}
                    onCheckedChange={(checked) =>
                      setSystemConfig((prev) => ({ ...prev, public_notice_enabled: checked }))
                    }
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
                          const isOnline = page.is_blanked !== true;
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
                                      is_blanked: page.is_blanked === true,
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
                        <TableHead className="text-neutral-300">Created</TableHead>
                        <TableHead className="text-right text-neutral-300">Delete</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredVendors.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-neutral-500 py-10">
                            {vendorsLoading ? 'Loading vendors...' : 'No vendors found'}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredVendors.map((vendor) => {
                          const busy = vendorDeletingId === vendor.id;
                          const kyc = String(vendor.kyc_status || 'PENDING').toUpperCase();
                          const active = vendor.is_active !== false;
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
                      disabled={deletingSelectedPlans}
                      className="border-neutral-700 text-neutral-300 hover:bg-neutral-800 w-full sm:w-auto"
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${plansLoading ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                    <Button
                      variant={planSelectionMode ? 'secondary' : 'outline'}
                      onClick={togglePlanSelectionMode}
                      disabled={savingAllPlans || plansLoading || planSavingId !== null || deletingSelectedPlans}
                      className="border-neutral-700 text-neutral-300 hover:bg-neutral-800 w-full sm:w-auto"
                    >
                      {planSelectionMode ? 'Cancel Select' : 'Select Plans'}
                    </Button>
                    {planSelectionMode ? (
                      <Button
                        variant="destructive"
                        onClick={deleteSelectedPlans}
                        disabled={
                          deletingSelectedPlans ||
                          savingAllPlans ||
                          plansLoading ||
                          planSavingId !== null ||
                          selectedPlanIds.length === 0
                        }
                        className="bg-red-700 hover:bg-red-600 w-full sm:w-auto disabled:opacity-60"
                      >
                        {deletingSelectedPlans ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 mr-2" />
                        )}
                        {deletingSelectedPlans
                          ? 'Deleting...'
                          : `Delete Selected (${selectedPlanIds.length})`}
                      </Button>
                    ) : null}
                    <Button
                      onClick={saveAllPlans}
                      disabled={
                        savingAllPlans ||
                        deletingSelectedPlans ||
                        plansLoading ||
                        planSavingId !== null ||
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
                      disabled={deletingSelectedPlans}
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
              </CardHeader>

              <CardContent className="space-y-4">
                {filteredPlans.length === 0 ? (
                  <div className="rounded-lg border border-neutral-800 py-12 text-center text-neutral-500">
                    {plansLoading ? 'Loading plans...' : 'No plans found'}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    {filteredPlans.map((plan) => {
                      const draft = planDrafts?.[plan.id] || planToDraft(plan);
                      const saving = planSavingId === plan.id;
                      const selected = selectedPlanIds.includes(plan.id);
                      const nowPrice = Number(draft?.price || 0);
                      const oldPrice = Number(draft?.original_price || 0);
                      const discountPercent = Number(draft?.discount_percent || 0);
                      const showOldPrice = Number.isFinite(oldPrice) && oldPrice > nowPrice && nowPrice >= 0;
                      const showPercent = Number.isFinite(discountPercent) && discountPercent > 0;

                      return (
                        <div
                          key={plan.id}
                          className={`rounded-xl border bg-neutral-950/40 p-4 sm:p-5 space-y-4 ${
                            selected
                              ? 'border-red-700/80 ring-1 ring-red-800/60'
                              : 'border-neutral-800'
                          }`}
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
                            <Badge
                              variant="secondary"
                              className={
                                draft.is_active
                                  ? 'bg-emerald-900/40 text-emerald-300'
                                  : 'bg-neutral-800 text-neutral-400'
                              }
                            >
                              {draft.is_active ? 'Active' : 'Hidden'}
                            </Badge>
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
                              Preview: {showOldPrice ? `Rs. ${money(oldPrice)} -> ` : ''}Rs. {money(nowPrice)}
                              {showPercent ? ` (${discountPercent}% OFF)` : ''}
                            </div>
                          </div>

                          <div className="rounded-lg border border-neutral-800 bg-neutral-900/70 p-3 space-y-3">
                            <p className="text-[11px] uppercase tracking-wide text-neutral-400">Lead Limits</p>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[11px] text-neutral-500">Daily</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  value={draft.daily_limit ?? 0}
                                  onChange={(e) => updatePlanDraft(plan.id, 'daily_limit', e.target.value)}
                                  className="bg-neutral-800 border-neutral-700 text-white h-9"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[11px] text-neutral-500">Weekly</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  value={draft.weekly_limit ?? 0}
                                  onChange={(e) => updatePlanDraft(plan.id, 'weekly_limit', e.target.value)}
                                  className="bg-neutral-800 border-neutral-700 text-white h-9"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[11px] text-neutral-500">Yearly</Label>
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
                            <p className="text-[11px] uppercase tracking-wide text-neutral-400">Coverage Limits</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[11px] text-neutral-500">States</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  value={draft.states_limit ?? 0}
                                  onChange={(e) => updatePlanDraft(plan.id, 'states_limit', e.target.value)}
                                  className="bg-neutral-800 border-neutral-700 text-white h-9"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[11px] text-neutral-500">Cities</Label>
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
                              Vendor card preview: Up to {Number(draft.states_limit || 0)} states and Up to {Number(draft.cities_limit || 0)} cities
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
                              disabled={saving || savingAllPlans || deletingSelectedPlans}
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
              <DialogContent className="bg-neutral-900 border-neutral-700 text-white max-w-lg">
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
                            <TableCell className="text-neutral-500 text-xs max-w-[360px]">
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
            <Card className="bg-neutral-900 border-neutral-800 max-w-xl">
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
                                {sa.role === 'GODMODE' ? '🔥 GOD MODE' : '👑 SUPERADMIN'}
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
              This creates a Supabase auth user and an employees table record.
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
        <DialogContent className="bg-neutral-900 border-neutral-800 text-white max-w-[96vw] sm:max-w-3xl max-h-[88vh] overflow-y-auto">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label className="text-neutral-300">Daily</Label>
                <Input
                  type="number"
                  min="0"
                  value={newPlanForm.daily_limit}
                  onChange={(e) => setNewPlanForm((prev) => ({ ...prev, daily_limit: e.target.value }))}
                  className="bg-neutral-800 border-neutral-700"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-neutral-300">Weekly</Label>
                <Input
                  type="number"
                  min="0"
                  value={newPlanForm.weekly_limit}
                  onChange={(e) => setNewPlanForm((prev) => ({ ...prev, weekly_limit: e.target.value }))}
                  className="bg-neutral-800 border-neutral-700"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-neutral-300">Yearly</Label>
                <Input
                  type="number"
                  min="0"
                  value={newPlanForm.yearly_limit}
                  onChange={(e) => setNewPlanForm((prev) => ({ ...prev, yearly_limit: e.target.value }))}
                  className="bg-neutral-800 border-neutral-700"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-neutral-300">States</Label>
                <Input
                  type="number"
                  min="0"
                  value={newPlanForm.states_limit}
                  onChange={(e) => setNewPlanForm((prev) => ({ ...prev, states_limit: e.target.value }))}
                  className="bg-neutral-800 border-neutral-700"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-neutral-300">Cities</Label>
                <Input
                  type="number"
                  min="0"
                  value={newPlanForm.cities_limit}
                  onChange={(e) => setNewPlanForm((prev) => ({ ...prev, cities_limit: e.target.value }))}
                  className="bg-neutral-800 border-neutral-700"
                />
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
