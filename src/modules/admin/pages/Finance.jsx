import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { IndianRupee, Percent, RefreshCw } from 'lucide-react';
import { fetchWithCsrf } from '@/lib/fetchWithCsrf';

const number = (v) => Number(v || 0);
const COUPON_CODE_REGEX = /^[A-Z0-9_-]+$/;
const normalizeCouponCode = (value) =>
  String(value || '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 32);
const fmt = (d) => {
  if (!d) return '-';
  const date = new Date(d);
  if (isNaN(date)) return '-';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const toLocalDateTime = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const toIsoOrNull = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
};

const fmtDateTime = (d) => {
  if (!d) return '-';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-IN');
};

const resolveCouponStatusMeta = (coupon = {}, nowTs = Date.now()) => {
  const explicitStatus = String(coupon?.effective_status || '').trim().toUpperCase();
  const expiresAt = coupon?.expires_at ? new Date(coupon.expires_at).getTime() : null;
  const usedCount = Number(coupon?.used_count || 0);
  const maxUses = Number(coupon?.max_uses || 0);

  if (coupon?.is_active === false || explicitStatus === 'INACTIVE') {
    return { label: 'Inactive', variant: 'secondary' };
  }
  if (explicitStatus === 'EXPIRED') return { label: 'Expired', variant: 'destructive' };
  if (expiresAt !== null && !Number.isNaN(expiresAt) && expiresAt <= nowTs) {
    return { label: 'Expired', variant: 'destructive' };
  }
  if (explicitStatus === 'USED_UP' || (maxUses > 0 && usedCount >= maxUses)) {
    return { label: 'Used Up', variant: 'secondary' };
  }
  return { label: 'Active', variant: 'default' };
};

const isDuplicateCouponError = (message) => {
  const normalized = String(message || '').trim().toLowerCase();
  return (
    normalized.includes('already exists') ||
    normalized.includes('vendor_plan_coupons_code_key') ||
    (normalized.includes('duplicate') && normalized.includes('coupon'))
  );
};

const getCouponCreateErrorMessage = (error) => {
  const message = String(error?.message || error || '').trim();
  if (isDuplicateCouponError(message)) {
    return 'Coupon code already exists. Use a different code.';
  }
  return message || 'Failed to create coupon';
};

const defaultReferralSettings = {
  is_enabled: false,
  first_paid_plan_only: true,
  allow_coupon_stack: false,
  min_plan_amount: 0,
  min_cashout_amount: 500,
  reward_hold_days: 0,
};

const defaultRuleDraft = {
  is_enabled: true,
  discount_type: 'PERCENT',
  discount_value: 0,
  discount_cap: '',
  reward_type: 'PERCENT',
  reward_value: 0,
  reward_cap: '',
  valid_from: '',
  valid_to: '',
};

const AdminFinance = () => {
  const [payments, setPayments] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [plans, setPlans] = useState([]);
  const [referralPlans, setReferralPlans] = useState([]);
  const [referralSettings, setReferralSettings] = useState(defaultReferralSettings);
  const [ruleDrafts, setRuleDrafts] = useState({});
  const [cashouts, setCashouts] = useState([]);
  const [cashoutStatus, setCashoutStatus] = useState('ALL');
  const [ruleSaving, setRuleSaving] = useState({});
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [cashoutActionLoading, setCashoutActionLoading] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [couponStatusNow, setCouponStatusNow] = useState(() => Date.now());
  const [pendingCoupons, setPendingCoupons] = useState([]);
  const [decisionLoading, setDecisionLoading] = useState({});
  const [rejectModal, setRejectModal] = useState(null); // { id, code }
  const [rejectReason, setRejectReason] = useState('');
  const [form, setForm] = useState({
    code: '',
    discount_type: 'PERCENT',
    value: '',
    plan_id: 'ANY',
    vendor_id: '',
    max_uses: '',
    expires_at: '',
  });

  const planNameById = useMemo(
    () =>
      (plans || []).reduce((acc, plan) => {
        if (plan?.id) acc[plan.id] = plan.name || plan.plan_name || plan.id;
        return acc;
      }, {}),
    [plans]
  );

  const ruleFromApi = (row) => ({
    is_enabled: row?.is_enabled !== false,
    discount_type: row?.discount_type || 'PERCENT',
    discount_value: Number(row?.discount_value || 0),
    discount_cap: row?.discount_cap === null || row?.discount_cap === undefined ? '' : Number(row?.discount_cap),
    reward_type: row?.reward_type || 'PERCENT',
    reward_value: Number(row?.reward_value || 0),
    reward_cap: row?.reward_cap === null || row?.reward_cap === undefined ? '' : Number(row?.reward_cap),
    valid_from: toLocalDateTime(row?.valid_from),
    valid_to: toLocalDateTime(row?.valid_to),
  });

  const fetchData = async (scope = 'ALL', initial = false) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    try {
      const statusQuery =
        scope && scope !== 'ALL' ? `?status=${encodeURIComponent(scope)}` : '';
      const [payRes, cpnRes, planRes, refRes, cashRes] = await Promise.all([
        fetchWithCsrf('/api/finance/payments'),
        fetchWithCsrf('/api/finance/coupons'),
        fetchWithCsrf('/api/payment/plans'),
        fetchWithCsrf('/api/finance/referrals/settings'),
        fetchWithCsrf(`/api/finance/referrals/cashouts${statusQuery}`),
      ]);
      const payJson = await payRes.json();
      const cpnJson = await cpnRes.json();
      const planJson = await planRes.json();
      const refJson = await refRes.json();
      const cashJson = await cashRes.json();
      if (payJson.success) setPayments(payJson.data || []);
      if (cpnJson.success) setCoupons(cpnJson.data || []);
      if (planJson.success) setPlans(planJson.data || []);

      if (refJson.success) {
        const incomingSettings = refJson.data?.settings || defaultReferralSettings;
        const incomingPlans = refJson.data?.plans || [];
        const rules = refJson.data?.rules || [];
        const ruleMap = rules.reduce((acc, item) => {
          if (item?.plan_id) acc[item.plan_id] = item;
          return acc;
        }, {});

        setReferralSettings({
          is_enabled: Boolean(incomingSettings.is_enabled),
          first_paid_plan_only: incomingSettings.first_paid_plan_only !== false,
          allow_coupon_stack: Boolean(incomingSettings.allow_coupon_stack),
          min_plan_amount: Number(incomingSettings.min_plan_amount || 0),
          min_cashout_amount: Number(incomingSettings.min_cashout_amount || 0),
          reward_hold_days: Number(incomingSettings.reward_hold_days || 0),
        });
        setReferralPlans(incomingPlans);
        setRuleDrafts(
          incomingPlans.reduce((acc, plan) => {
            acc[plan.id] = ruleFromApi(ruleMap[plan.id] || defaultRuleDraft);
            return acc;
          }, {})
        );
      }

      if (cashJson.success) {
        setCashouts(cashJson.data || []);
      }

      // Load pending coupon approvals
      const pendingRes = await fetchWithCsrf('/api/admin/coupons/pending');
      const pendingJson = await pendingRes.json();
      if (pendingJson.success) setPendingCoupons(pendingJson.data || []);
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to load finance data', variant: 'destructive' });
    } finally {
      if (initial) setLoading(false);
      else setRefreshing(false);
    }
  };

  const decideCoupon = async (id, decision, reason = '') => {
    setDecisionLoading((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await fetchWithCsrf(`/api/admin/coupons/${id}/decision`, {
        method: 'POST',
        body: JSON.stringify({ decision, reason }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed');
      toast({
        title: decision === 'APPROVE' ? 'Coupon Approved' : 'Coupon Rejected',
        description: json.message,
      });
      setRejectModal(null);
      setRejectReason('');
      fetchData(cashoutStatus, false);
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setDecisionLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

  const deleteCoupon = async (id) => {
    if (!id) return;
    if (!window.confirm('Delete this coupon?')) return;
    try {
      const res = await fetchWithCsrf(`/api/finance/coupons/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed');
      toast({ title: 'Deleted', description: 'Coupon removed' });
      fetchData(cashoutStatus, false);
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  useEffect(() => {
    fetchData('ALL', true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => setCouponStatusNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const kpis = useMemo(() => {
    const gross = payments.reduce((s, p) => s + number(p.amount), 0);
    const net = payments.reduce((s, p) => s + number(p.net_amount ?? p.amount), 0);
    const pendingCashouts = cashouts
      .filter((row) => ['REQUESTED', 'APPROVED'].includes(String(row.status || '').toUpperCase()))
      .reduce((s, row) => s + number(row.requested_amount), 0);
    return { gross, net, pendingCashouts };
  }, [payments, cashouts]);

  const createCoupon = async () => {
    try {
      const normalizedCode = normalizeCouponCode(form.code);
      const numericValue = Number(form.value);
      const numericMaxUses = form.max_uses === '' ? 0 : Number(form.max_uses);

      if (!normalizedCode || form.value === '') {
        toast({ title: 'Required', description: 'Code and value are required', variant: 'destructive' });
        return;
      }

      if (!COUPON_CODE_REGEX.test(normalizedCode)) {
        toast({
          title: 'Invalid code',
          description: 'Use letters, numbers, hyphen, or underscore only',
          variant: 'destructive',
        });
        return;
      }

      if (!Number.isFinite(numericValue) || numericValue <= 0) {
        toast({ title: 'Invalid value', description: 'Value must be greater than 0', variant: 'destructive' });
        return;
      }

      if (form.discount_type === 'PERCENT' && numericValue > 100) {
        toast({
          title: 'Invalid percent',
          description: 'Percent coupon cannot be more than 100',
          variant: 'destructive',
        });
        return;
      }

      if (!Number.isFinite(numericMaxUses) || numericMaxUses < 0) {
        toast({
          title: 'Invalid max uses',
          description: 'Max uses must be 0 or more',
          variant: 'destructive',
        });
        return;
      }

      if ((coupons || []).some((coupon) => normalizeCouponCode(coupon?.code) === normalizedCode)) {
        toast({
          title: 'Duplicate code',
          description: 'Coupon code already exists. Use a different code.',
          variant: 'destructive',
        });
        return;
      }

      const payload = {
        ...form,
        code: normalizedCode,
        value: numericValue,
        max_uses: Math.trunc(numericMaxUses),
        plan_id: form.plan_id === 'ANY' ? null : form.plan_id,
        vendor_id: form.vendor_id.trim() || null,
        expires_at: toIsoOrNull(form.expires_at),
      };
      const res = await fetchWithCsrf('/api/finance/coupons', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed');
      toast({ title: 'Coupon created', description: payload.code });
      setForm((prev) => ({ ...prev, code: '', value: '', max_uses: '', vendor_id: '', expires_at: '' }));
      fetchData(cashoutStatus, false);
    } catch (e) {
      toast({ title: 'Error', description: getCouponCreateErrorMessage(e), variant: 'destructive' });
    }
  };

  const setRuleValue = (planId, key, value) => {
    setRuleDrafts((prev) => ({
      ...prev,
      [planId]: {
        ...(prev[planId] || defaultRuleDraft),
        [key]: value,
      },
    }));
  };

  const saveReferralSettings = async () => {
    setSettingsSaving(true);
    try {
      const payload = {
        is_enabled: Boolean(referralSettings.is_enabled),
        first_paid_plan_only: Boolean(referralSettings.first_paid_plan_only),
        allow_coupon_stack: Boolean(referralSettings.allow_coupon_stack),
        min_plan_amount: Math.max(0, Number(referralSettings.min_plan_amount || 0)),
        min_cashout_amount: Math.max(0, Number(referralSettings.min_cashout_amount || 0)),
        reward_hold_days: Math.max(0, Number(referralSettings.reward_hold_days || 0)),
      };

      const res = await fetchWithCsrf('/api/finance/referrals/settings', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed');

      toast({ title: 'Saved', description: 'Referral settings updated' });
      fetchData(cashoutStatus, false);
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSettingsSaving(false);
    }
  };

  const savePlanRule = async (planId) => {
    const rule = ruleDrafts[planId];
    if (!rule) return;

    setRuleSaving((prev) => ({ ...prev, [planId]: true }));
    try {
      const discountValue = Number(rule.discount_value || 0);
      const rewardValue = Number(rule.reward_value || 0);

      if (rule.discount_type === 'PERCENT' && discountValue > 100) {
        throw new Error('Discount percent cannot exceed 100');
      }
      if (rule.reward_type === 'PERCENT' && rewardValue > 100) {
        throw new Error('Reward percent cannot exceed 100');
      }

      const payload = {
        is_enabled: Boolean(rule.is_enabled),
        discount_type: rule.discount_type,
        discount_value: Math.max(0, discountValue),
        discount_cap: rule.discount_cap === '' ? null : Math.max(0, Number(rule.discount_cap || 0)),
        reward_type: rule.reward_type,
        reward_value: Math.max(0, rewardValue),
        reward_cap: rule.reward_cap === '' ? null : Math.max(0, Number(rule.reward_cap || 0)),
        valid_from: toIsoOrNull(rule.valid_from),
        valid_to: toIsoOrNull(rule.valid_to),
      };

      const res = await fetchWithCsrf(`/api/finance/referrals/plan-rules/${planId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed');

      toast({ title: 'Saved', description: 'Plan referral rule updated' });
      fetchData(cashoutStatus, false);
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setRuleSaving((prev) => ({ ...prev, [planId]: false }));
    }
  };

  const runCashoutAction = async (row, action) => {
    if (!row?.id) return;
    setCashoutActionLoading((prev) => ({ ...prev, [row.id]: true }));
    try {
      let endpoint = '';
      let payload = {};
      if (action === 'approve') {
        endpoint = `/api/finance/referrals/cashouts/${row.id}/approve`;
        const notes = window.prompt('Approval note (optional):', '') || '';
        payload = { notes: notes.trim() || null };
      } else if (action === 'reject') {
        endpoint = `/api/finance/referrals/cashouts/${row.id}/reject`;
        const reason = window.prompt('Rejection reason:', '') || '';
        if (!reason.trim()) throw new Error('Rejection reason is required');
        payload = { rejection_reason: reason.trim() };
      } else if (action === 'paid') {
        endpoint = `/api/finance/referrals/cashouts/${row.id}/mark-paid`;
        const utr = window.prompt('UTR Number:', '') || '';
        if (!utr.trim()) throw new Error('UTR number is required');
        const receiptUrl = window.prompt('Receipt URL (optional):', '') || '';
        payload = { utr_number: utr.trim(), receipt_url: receiptUrl.trim() || null };
      } else {
        throw new Error('Invalid action');
      }

      const res = await fetchWithCsrf(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed');

      toast({ title: 'Updated', description: `Cashout ${action} successful` });
      fetchData(cashoutStatus, false);
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setCashoutActionLoading((prev) => ({ ...prev, [row.id]: false }));
    }
  };

  const exportCsv = () => {
    const header = [
      'vendor',
      'plan',
      'amount',
      'discount',
      'net',
      'coupon',
      'offer_type',
      'offer_code',
      'payment_date',
      'transaction',
    ];
    const rows = payments.map((p) =>
      [
        p.vendor?.company_name || p.vendor_id,
        p.plan?.name || p.plan_id,
        number(p.amount),
        number(p.discount_amount || 0),
        number(p.net_amount ?? p.amount),
        p.coupon_code || '',
        p.offer_type || '',
        p.offer_code || '',
        p.payment_date || '',
        p.transaction_id || '',
      ].join(',')
    );
    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'payments.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Finance</h1>
          <p className="text-sm text-neutral-500">Payments, coupons, referral controls, and cashout workflow</p>
        </div>
        <Button
          variant="outline"
          onClick={() => fetchData(cashoutStatus, false)}
          disabled={loading || refreshing}
        >
          {refreshing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Gross</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold flex items-center gap-2">
            <IndianRupee className="h-5 w-5" />
            {kpis.gross.toLocaleString('en-IN')}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total Net</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold flex items-center gap-2">
            <IndianRupee className="h-5 w-5" />
            {kpis.net.toLocaleString('en-IN')}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pending Cashout</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold flex items-center gap-2">
            <IndianRupee className="h-5 w-5" />
            {kpis.pendingCashouts.toLocaleString('en-IN')}
          </CardContent>
        </Card>
      </div>

      <Card id="payments">
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Payments</CardTitle>
          <div className="space-x-2">
            <Button size="sm" variant="outline" onClick={exportCsv}>
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Net</TableHead>
                <TableHead>Coupon</TableHead>
                <TableHead>Offer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Txn</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.vendor?.company_name || p.vendor_id}</TableCell>
                  <TableCell>{p.plan?.name || p.plan_id}</TableCell>
                  <TableCell>₹ {number(p.amount).toLocaleString('en-IN')}</TableCell>
                  <TableCell>{number(p.discount_amount || 0) > 0 ? `₹ ${number(p.discount_amount).toLocaleString('en-IN')}` : '-'}</TableCell>
                  <TableCell>₹ {number(p.net_amount ?? p.amount).toLocaleString('en-IN')}</TableCell>
                  <TableCell>{p.coupon_code || '-'}</TableCell>
                  <TableCell className="text-xs">
                    {p.offer_type || '-'}{p.offer_code ? ` (${p.offer_code})` : ''}
                  </TableCell>
                  <TableCell>{fmt(p.payment_date)}</TableCell>
                  <TableCell className="text-xs break-all">{p.transaction_id || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── PENDING COUPON APPROVALS ─────────────────────────── */}
      {pendingCoupons.length > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-600 text-white text-xs font-bold">
                {pendingCoupons.length}
              </span>
              Coupon Approvals Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Max Uses</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingCoupons.map((c) => (
                  <TableRow key={c.id} className="bg-white">
                    <TableCell className="font-mono font-semibold">{c.code}</TableCell>
                    <TableCell>{c.discount_type}</TableCell>
                    <TableCell>
                      {c.discount_type === 'PERCENT' ? `${c.value}%` : `₹${c.value}`}
                    </TableCell>
                    <TableCell>{c.max_uses || '∞'}</TableCell>
                    <TableCell>{c.expires_at ? fmtDateTime(c.expires_at) : '—'}</TableCell>
                    <TableCell className="text-xs text-neutral-500">{fmtDateTime(c.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 h-8"
                          disabled={decisionLoading[c.id]}
                          onClick={() => decideCoupon(c.id, 'APPROVE')}
                        >
                          {decisionLoading[c.id] ? '...' : 'Approve'}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-8"
                          disabled={decisionLoading[c.id]}
                          onClick={() => { setRejectModal({ id: c.id, code: c.code }); setRejectReason(''); }}
                        >
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Reject reason modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm space-y-4">
            <h3 className="font-semibold text-lg">Reject Coupon: {rejectModal.code}</h3>
            <div className="space-y-1">
              <label className="text-sm font-medium">Reason (required)</label>
              <textarea
                className="w-full border rounded-md px-3 py-2 text-sm resize-none"
                rows={3}
                placeholder="Explain why this coupon is rejected..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRejectModal(null)}>Cancel</Button>
              <Button
                variant="destructive"
                disabled={!rejectReason.trim() || decisionLoading[rejectModal.id]}
                onClick={() => decideCoupon(rejectModal.id, 'REJECT', rejectReason)}
              >
                {decisionLoading[rejectModal.id] ? 'Rejecting...' : 'Confirm Reject'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Create Coupon</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Code</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: normalizeCouponCode(e.target.value) })}
                placeholder="NEWYEAR50"
                disableAutoSanitize
              />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={form.discount_type} onValueChange={(v) => setForm({ ...form, discount_type: v })}>
                <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERCENT">Percent</SelectItem>
                  <SelectItem value="FLAT">Flat</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Value</Label>
              <div className="flex items-center gap-2">
                {form.discount_type === 'PERCENT' ? <Percent className="h-4 w-4 text-neutral-500" /> : <IndianRupee className="h-4 w-4 text-neutral-500" />}
                <Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Plan (optional)</Label>
              <Select value={form.plan_id} onValueChange={(v) => setForm({ ...form, plan_id: v })}>
                <SelectTrigger><SelectValue placeholder="Any plan" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ANY">Any</SelectItem>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Vendor (optional)</Label>
              <Input
                value={form.vendor_id}
                onChange={(e) => setForm({ ...form, vendor_id: e.target.value })}
                placeholder="Vendor UUID or vendor code"
                disableAutoSanitize
              />
            </div>
            <div>
              <Label>Max Uses (0 = unlimited)</Label>
              <Input type="number" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} />
            </div>
            <div>
              <Label>Expires At</Label>
              <Input type="datetime-local" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} />
            </div>
          </div>
          <p className="text-xs text-neutral-500">
            Tip: Keep <span className="font-medium">Plan = Any</span> and <span className="font-medium">Vendor blank</span> to make this coupon usable for all vendors and all plans.
          </p>
          <Button onClick={createCoupon}>Create Coupon</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Coupons</CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.map((c) => {
                const statusMeta = resolveCouponStatusMeta(c, couponStatusNow);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-semibold">{c.code}</TableCell>
                    <TableCell>{c.discount_type === 'PERCENT' ? `${c.value}%` : `₹ ${c.value}`}</TableCell>
                    <TableCell>
                      {c.plan_id ? (c.plan?.name || planNameById[c.plan_id] || c.plan_id) : 'Any'}
                    </TableCell>
                    <TableCell>
                      {c.vendor_id
                        ? (c.vendor?.company_name || c.vendor?.owner_name || c.vendor?.vendor_id || c.vendor_id)
                        : 'Any'}
                    </TableCell>
                    <TableCell>{c.used_count || 0}/{c.max_uses || '∞'}</TableCell>
                    <TableCell>
                      {String(c.approval_status || 'APPROVED').toUpperCase() === 'PENDING_APPROVAL' ? (
                        <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                          Pending Approval
                        </Badge>
                      ) : String(c.approval_status || '').toUpperCase() === 'REJECTED' ? (
                        <Badge variant="destructive">Rejected</Badge>
                      ) : (
                        <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="destructive" onClick={() => deleteCoupon(c.id)}>
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Referral Program Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={referralSettings.is_enabled}
                onChange={(e) => setReferralSettings((prev) => ({ ...prev, is_enabled: e.target.checked }))}
              />
              Program Enabled
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={referralSettings.first_paid_plan_only}
                onChange={(e) =>
                  setReferralSettings((prev) => ({ ...prev, first_paid_plan_only: e.target.checked }))
                }
              />
              First Paid Plan Only
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={referralSettings.allow_coupon_stack}
                onChange={(e) => setReferralSettings((prev) => ({ ...prev, allow_coupon_stack: e.target.checked }))}
              />
              Allow Stack With Coupon
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Minimum Plan Amount (₹)</Label>
              <Input
                type="number"
                min="0"
                value={referralSettings.min_plan_amount}
                onChange={(e) => setReferralSettings((prev) => ({ ...prev, min_plan_amount: e.target.value }))}
              />
            </div>
            <div>
              <Label>Minimum Cashout Amount (₹)</Label>
              <Input
                type="number"
                min="0"
                value={referralSettings.min_cashout_amount}
                onChange={(e) => setReferralSettings((prev) => ({ ...prev, min_cashout_amount: e.target.value }))}
              />
            </div>
            <div>
              <Label>Reward Hold Days</Label>
              <Input
                type="number"
                min="0"
                value={referralSettings.reward_hold_days}
                onChange={(e) => setReferralSettings((prev) => ({ ...prev, reward_hold_days: e.target.value }))}
              />
            </div>
          </div>

          <Button onClick={saveReferralSettings} disabled={settingsSaving}>
            {settingsSaving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
            Save Referral Settings
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Referral Rules By Plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {referralPlans.map((plan) => {
            const rule = ruleDrafts[plan.id] || defaultRuleDraft;
            const saving = Boolean(ruleSaving[plan.id]);
            return (
              <div key={plan.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold">{plan.name}</div>
                    <div className="text-xs text-neutral-500">Plan price: ₹{number(plan.price).toLocaleString('en-IN')}</div>
                  </div>
                  <label className="text-sm flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={rule.is_enabled}
                      onChange={(e) => setRuleValue(plan.id, 'is_enabled', e.target.checked)}
                    />
                    Rule Enabled
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Referred Vendor Discount</div>
                    <div className="grid grid-cols-3 gap-2">
                      <Select value={rule.discount_type} onValueChange={(v) => setRuleValue(plan.id, 'discount_type', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PERCENT">Percent</SelectItem>
                          <SelectItem value="FLAT">Flat</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min="0"
                        value={rule.discount_value}
                        onChange={(e) => setRuleValue(plan.id, 'discount_value', e.target.value)}
                        placeholder="Value"
                      />
                      <Input
                        type="number"
                        min="0"
                        value={rule.discount_cap}
                        onChange={(e) => setRuleValue(plan.id, 'discount_cap', e.target.value)}
                        placeholder="Cap"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-medium">Referrer Reward</div>
                    <div className="grid grid-cols-3 gap-2">
                      <Select value={rule.reward_type} onValueChange={(v) => setRuleValue(plan.id, 'reward_type', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PERCENT">Percent</SelectItem>
                          <SelectItem value="FLAT">Flat</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min="0"
                        value={rule.reward_value}
                        onChange={(e) => setRuleValue(plan.id, 'reward_value', e.target.value)}
                        placeholder="Value"
                      />
                      <Input
                        type="number"
                        min="0"
                        value={rule.reward_cap}
                        onChange={(e) => setRuleValue(plan.id, 'reward_cap', e.target.value)}
                        placeholder="Cap"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>Valid From</Label>
                    <Input
                      type="datetime-local"
                      value={rule.valid_from}
                      onChange={(e) => setRuleValue(plan.id, 'valid_from', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Valid To</Label>
                    <Input
                      type="datetime-local"
                      value={rule.valid_to}
                      onChange={(e) => setRuleValue(plan.id, 'valid_to', e.target.value)}
                    />
                  </div>
                </div>

                <Button onClick={() => savePlanRule(plan.id)} disabled={saving}>
                  {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Save {plan.name} Rule
                </Button>
              </div>
            );
          })}
          {referralPlans.length === 0 ? (
            <div className="text-sm text-neutral-500">No plans found for referral rules.</div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Referral Cashout Queue</CardTitle>
          <div className="w-[200px]">
            <Select
              value={cashoutStatus}
              onValueChange={(value) => {
                setCashoutStatus(value);
                fetchData(value, false);
              }}
            >
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem value="REQUESTED">Requested</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="PAID">Paid</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Approved</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>UTR</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cashouts.map((row) => {
                const status = String(row.status || '').toUpperCase();
                const busy = Boolean(cashoutActionLoading[row.id]);
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div>{row.vendor?.company_name || row.vendor?.owner_name || row.vendor_id}</div>
                      <div className="text-xs text-neutral-500">{row.vendor?.vendor_id || row.vendor?.email || '-'}</div>
                    </TableCell>
                    <TableCell>₹ {number(row.requested_amount).toLocaleString('en-IN')}</TableCell>
                    <TableCell>
                      <Badge variant={status === 'PAID' ? 'default' : 'secondary'}>{status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{fmtDateTime(row.created_at)}</TableCell>
                    <TableCell className="text-xs">{fmtDateTime(row.approved_at)}</TableCell>
                    <TableCell className="text-xs">{fmtDateTime(row.paid_at)}</TableCell>
                    <TableCell className="text-xs">{row.utr_number || '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {(status === 'REQUESTED' || status === 'APPROVED') ? (
                          <Button size="sm" variant="outline" onClick={() => runCashoutAction(row, 'approve')} disabled={busy}>
                            {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Approve'}
                          </Button>
                        ) : null}
                        {(status === 'REQUESTED' || status === 'APPROVED') ? (
                          <Button size="sm" variant="destructive" onClick={() => runCashoutAction(row, 'reject')} disabled={busy}>
                            {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Reject'}
                          </Button>
                        ) : null}
                        {status === 'APPROVED' ? (
                          <Button size="sm" onClick={() => runCashoutAction(row, 'paid')} disabled={busy}>
                            {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Mark Paid'}
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {cashouts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-neutral-500">
                    No cashout requests found
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminFinance;
