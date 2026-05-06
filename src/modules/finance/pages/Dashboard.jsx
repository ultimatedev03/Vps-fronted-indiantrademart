import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Clock, IndianRupee, Loader2, Plus, Tag, X } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { fetchWithCsrf } from '@/lib/fetchWithCsrf';
import { useInternalAuth } from '@/modules/admin/context/InternalAuthContext';

const number = (v) => Number(v || 0);
const currencyFormatter = new Intl.NumberFormat('en-IN');
const formatCurrency = (value) => currencyFormatter.format(number(value));

const safeReadJson = async (res) => {
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return await res.json();
  const text = await res.text();
  throw new Error(`API returned non-JSON (${res.status}). Got: ${text.slice(0, 120)}...`);
};

const formatDate = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return format(d, 'dd MMM yyyy');
};

const csvEscape = (value) => {
  const text = String(value ?? '');
  if (text.includes('"') || text.includes(',') || text.includes('\n')) return `"${text.replace(/"/g, '""')}"`;
  return text;
};

const approvalBadge = (status) => {
  switch (String(status || '').toUpperCase()) {
    case 'APPROVED':     return { label: 'Approved', cls: 'bg-green-100 text-green-800' };
    case 'REJECTED':     return { label: 'Rejected', cls: 'bg-red-100 text-red-800' };
    case 'PENDING_APPROVAL': return { label: 'Pending Approval', cls: 'bg-amber-100 text-amber-800' };
    default:             return { label: status || 'Unknown', cls: 'bg-neutral-100 text-neutral-600' };
  }
};

const DEFAULT_COUPON_FORM = {
  code: '',
  discount_type: 'PERCENT',
  value: '',
  max_uses: '',
  expires_at: '',
};

const FinanceDashboard = () => {
  const location = useLocation();
  const { user: internalUser, isLoading: internalLoading } = useInternalAuth();

  const [summary, setSummary] = useState({ totalGross: 0, totalNet: 0, last30: 0 });
  const [payments, setPayments] = useState([]);
  const [pendingCoupons, setPendingCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [couponLoading, setCouponLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [showCouponForm, setShowCouponForm] = useState(false);
  const [couponForm, setCouponForm] = useState(DEFAULT_COUPON_FORM);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, p] = await Promise.all([
        fetchWithCsrf('/api/finance/summary'),
        fetchWithCsrf('/api/finance/payments'),
      ]);
      const sj = await safeReadJson(s);
      const pj = await safeReadJson(p);
      if (!sj?.success) throw new Error(sj?.error || 'Failed to load finance summary');
      if (!pj?.success) throw new Error(pj?.error || 'Failed to load finance payments');
      setSummary(sj?.data || { totalGross: 0, totalNet: 0, last30: 0 });
      setPayments(Array.isArray(pj?.data) ? pj.data : []);
      setLastUpdated(new Date());
    } catch (e) {
      toast({ title: 'Error', description: e?.message || 'Failed to load finance data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPendingCoupons = useCallback(async () => {
    setCouponLoading(true);
    try {
      const res = await fetchWithCsrf('/api/finance/coupons/pending');
      const json = await safeReadJson(res);
      if (json?.success) setPendingCoupons(json.data || []);
    } catch (e) {
      // non-critical — don't block page
    } finally {
      setCouponLoading(false);
    }
  }, []);

  useEffect(() => {
    if (internalLoading) return;
    const role = String(internalUser?.role || '').toUpperCase();
    if (role !== 'FINANCE' && role !== 'ADMIN') { setLoading(false); return; }
    load();
    loadPendingCoupons();
  }, [internalLoading, internalUser?.role, load, loadPendingCoupons]);

  useEffect(() => {
    if (location.hash !== '#payments') return;
    const scrollToPayments = () => document.getElementById('payments')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const frameId = window.requestAnimationFrame(scrollToPayments);
    const timeoutId = window.setTimeout(scrollToPayments, 180);
    return () => { window.cancelAnimationFrame(frameId); window.clearTimeout(timeoutId); };
  }, [location.hash, loading]);

  const exportCsv = () => {
    const header = ['vendor', 'plan', 'net', 'payment_date', 'coupon'];
    const rows = (payments || []).map((p) =>
      [p.vendor?.company_name || p.vendor_id || '', p.plan?.name || p.plan_id || '', number(p.net_amount ?? p.amount), p.payment_date || '', p.coupon_code || ''].map(csvEscape).join(',')
    );
    const csv = [header.map(csvEscape).join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'finance-payments.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleCouponSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const body = {
        code: String(couponForm.code || '').toUpperCase().trim(),
        discount_type: couponForm.discount_type,
        value: Number(couponForm.value),
        max_uses: couponForm.max_uses ? Number(couponForm.max_uses) : 0,
        expires_at: couponForm.expires_at || null,
      };
      const res = await fetchWithCsrf('/api/finance/coupons', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const json = await safeReadJson(res);
      if (!json?.success) throw new Error(json?.error || 'Failed to submit coupon');
      toast({
        title: 'Coupon submitted',
        description: json.message || 'Sent to Admin for approval.',
      });
      setCouponForm(DEFAULT_COUPON_FORM);
      setShowCouponForm(false);
      loadPendingCoupons();
    } catch (err) {
      toast({ title: 'Submission failed', description: err?.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const cards = useMemo(() => [
    { title: 'Total Gross', value: summary.totalGross },
    { title: 'Total Net', value: summary.totalNet },
    { title: 'Last 30 days', value: summary.last30 },
  ], [summary]);

  const paymentRows = useMemo(() =>
    [...(payments || [])].sort((a, b) => {
      const da = new Date(a.payment_date || 0).getTime();
      const db = new Date(b.payment_date || 0).getTime();
      return (Number.isNaN(db) ? 0 : db) - (Number.isNaN(da) ? 0 : da);
    }), [payments]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Finance Dashboard</h1>
          <p className="text-sm text-neutral-500">Payments overview and coupon submissions</p>
          {lastUpdated && (
            <p className="text-xs text-neutral-400 mt-1">
              Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((c) => (
          <Card key={c.title}>
            <CardHeader><CardTitle>{c.title}</CardTitle></CardHeader>
            <CardContent className="text-3xl font-semibold flex items-center gap-2">
              <IndianRupee className="h-5 w-5" />
              {formatCurrency(c.value)}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── COUPON SECTION ─────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-amber-600" />
            <CardTitle>Coupons</CardTitle>
          </div>
          <Button
            size="sm"
            onClick={() => setShowCouponForm((v) => !v)}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {showCouponForm ? <X className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
            {showCouponForm ? 'Cancel' : 'New Coupon'}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Create form */}
          {showCouponForm && (
            <form onSubmit={handleCouponSubmit} className="border rounded-lg p-4 bg-amber-50 space-y-4">
              <p className="text-sm text-amber-800 font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Coupon will be sent to Admin for approval before becoming active.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Coupon Code *</Label>
                  <Input
                    required
                    placeholder="e.g. SAVE20"
                    value={couponForm.code}
                    onChange={(e) => setCouponForm((p) => ({ ...p, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Discount Type *</Label>
                  <Select value={couponForm.discount_type} onValueChange={(v) => setCouponForm((p) => ({ ...p, discount_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERCENT">Percent (%)</SelectItem>
                      <SelectItem value="FLAT">Flat (₹)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Value *</Label>
                  <Input
                    required
                    type="number"
                    min={1}
                    max={couponForm.discount_type === 'PERCENT' ? 100 : undefined}
                    placeholder={couponForm.discount_type === 'PERCENT' ? '0–100' : 'Amount in ₹'}
                    value={couponForm.value}
                    onChange={(e) => setCouponForm((p) => ({ ...p, value: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Max Uses <span className="text-neutral-400 text-xs">(0 = unlimited)</span></Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="0"
                    value={couponForm.max_uses}
                    onChange={(e) => setCouponForm((p) => ({ ...p, max_uses: e.target.value }))}
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label>Expires At <span className="text-neutral-400 text-xs">(optional)</span></Label>
                  <Input
                    type="datetime-local"
                    value={couponForm.expires_at}
                    onChange={(e) => setCouponForm((p) => ({ ...p, expires_at: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={submitting} className="bg-amber-600 hover:bg-amber-700">
                  {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Submit for Approval
                </Button>
              </div>
            </form>
          )}

          {/* Pending coupons table */}
          <div>
            <p className="text-sm font-medium text-neutral-600 mb-2">My Coupon Submissions</p>
            {couponLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
              </div>
            ) : pendingCoupons.length === 0 ? (
              <div className="text-center py-6 text-neutral-400 text-sm">No coupon submissions yet.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Max Uses</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingCoupons.map((c) => {
                    const badge = approvalBadge(c.approval_status);
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono font-medium">{c.code}</TableCell>
                        <TableCell>{c.discount_type}</TableCell>
                        <TableCell>{c.discount_type === 'PERCENT' ? `${c.value}%` : `₹${c.value}`}</TableCell>
                        <TableCell>{c.max_uses || '∞'}</TableCell>
                        <TableCell>{formatDate(c.expires_at)}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-red-600">{c.rejection_reason || '-'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── PAYMENTS ────────────────────────────────────────────── */}
      <Card id="payments">
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Payments</CardTitle>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={payments.length === 0}>
            Export CSV
          </Button>
        </CardHeader>
        <CardContent className="overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
            </div>
          ) : paymentRows.length === 0 ? (
            <div className="text-center py-8 text-neutral-500">No payments found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Net</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Coupon</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentRows.slice(0, 200).map((p) => (
                  <TableRow key={p.id || `${p.vendor_id}-${p.payment_date}`}>
                    <TableCell>{p.vendor?.company_name || p.vendor_id || '-'}</TableCell>
                    <TableCell>{p.plan?.name || p.plan_id || '-'}</TableCell>
                    <TableCell>₹ {formatCurrency(p.net_amount ?? p.amount)}</TableCell>
                    <TableCell>{formatDate(p.payment_date)}</TableCell>
                    <TableCell>{p.coupon_code || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FinanceDashboard;
