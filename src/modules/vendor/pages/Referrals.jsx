import React, { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/components/ui/use-toast';
import { Copy, IndianRupee, Loader2, RefreshCw, Share2, Wallet } from 'lucide-react';
import { referralApi } from '@/modules/vendor/services/referralApi';

const inr = (value) => {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
};

const fmtDateTime = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('en-IN');
};

const statusVariant = (status) => {
  const s = String(status || '').toUpperCase();
  if (s === 'REWARDED' || s === 'PAID' || s === 'COMPLETED') return 'default';
  if (s === 'REJECTED' || s === 'FAILED') return 'destructive';
  return 'secondary';
};

const Referrals = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [linking, setLinking] = useState(false);
  const [cashoutLoading, setCashoutLoading] = useState(false);

  const [overview, setOverview] = useState({});
  const [cashouts, setCashouts] = useState([]);

  const [referralCodeInput, setReferralCodeInput] = useState('');
  const [cashoutAmount, setCashoutAmount] = useState('');
  const [cashoutNote, setCashoutNote] = useState('');

  const loadData = async (initial = false) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    try {
      const [overviewData, cashoutRows] = await Promise.all([
        referralApi.getOverview(),
        referralApi.getCashouts(),
      ]);
      setOverview(overviewData || {});
      setCashouts(cashoutRows || []);
    } catch (error) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to load referral data',
        variant: 'destructive',
      });
    } finally {
      if (initial) setLoading(false);
      else setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData(true);
  }, []);

  const referralProfile = overview?.referral_profile || {};
  const wallet = overview?.wallet || {};
  const settings = overview?.settings || {};
  const linkedReferral = overview?.linked_referral || null;
  const hasLinkedReferral = Boolean(linkedReferral?.id);
  const referrals = Array.isArray(overview?.referrals) ? overview.referrals : [];
  const ledger = Array.isArray(overview?.ledger) ? overview.ledger : [];
  const referralCode = String(referralProfile?.referral_code || '').trim();

  const inviteLink = useMemo(() => {
    if (!referralCode) return '';
    const origin =
      typeof window !== 'undefined' && window?.location?.origin
        ? window.location.origin
        : '';
    const base = origin || '';
    return `${base}/vendor/register?ref=${encodeURIComponent(referralCode)}`;
  }, [referralCode]);

  const handleCopy = async (value, label = 'Copied') => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: label });
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  };

  const handleLinkCode = async () => {
    if (hasLinkedReferral) {
      toast({ title: 'Referral already linked', variant: 'destructive' });
      return;
    }
    const code = String(referralCodeInput || '').trim().toUpperCase();
    if (!code) {
      toast({ title: 'Enter referral code', variant: 'destructive' });
      return;
    }
    setLinking(true);
    try {
      await referralApi.linkCode(code);
      toast({ title: 'Referral code linked successfully' });
      setReferralCodeInput('');
      await loadData(false);
    } catch (error) {
      toast({
        title: 'Unable to link',
        description: error?.message || 'Failed to link referral code',
        variant: 'destructive',
      });
    } finally {
      setLinking(false);
    }
  };

  const handleCashout = async () => {
    const amount = Number(cashoutAmount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({ title: 'Enter valid amount', variant: 'destructive' });
      return;
    }

    setCashoutLoading(true);
    try {
      await referralApi.requestCashout({
        amount,
        note: cashoutNote,
      });
      toast({ title: 'Cashout request submitted' });
      setCashoutAmount('');
      setCashoutNote('');
      await loadData(false);
    } catch (error) {
      toast({
        title: 'Cashout failed',
        description: error?.message || 'Unable to create cashout request',
        variant: 'destructive',
      });
    } finally {
      setCashoutLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Referrals & Wallet</h1>
          <p className="text-sm text-slate-500">
            Refer vendors, earn rewards, and request cashout.
          </p>
        </div>
        <Button variant="outline" onClick={() => loadData(false)} disabled={refreshing}>
          {refreshing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
          Refresh
        </Button>
      </div>

      {settings?.is_enabled === false ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6 text-sm text-amber-800">
            Referral program is currently disabled by admin.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>My Referral Code</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <code className="rounded-md bg-slate-100 px-3 py-2 text-lg font-semibold">
                {referralCode || 'N/A'}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCopy(referralCode, 'Referral code copied')}
                disabled={!referralCode}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Code
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCopy(inviteLink, 'Invite link copied')}
                disabled={!inviteLink}
              >
                <Share2 className="h-4 w-4 mr-2" />
                Copy Invite Link
              </Button>
            </div>
            {inviteLink ? (
              <p className="text-xs text-slate-500 break-all">{inviteLink}</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Available Balance</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold flex items-center gap-2">
            <Wallet className="h-5 w-5 text-emerald-600" />
            ₹{inr(wallet?.available_balance)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lifetime Earned</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold flex items-center gap-2">
            <IndianRupee className="h-5 w-5 text-blue-600" />
            {inr(wallet?.lifetime_earned)}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {hasLinkedReferral ? (
          <Card>
            <CardHeader>
              <CardTitle>Applied Referral</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-slate-600">
                Your account is already linked with a referral code.
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <code className="rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold">
                  {String(linkedReferral?.referral_code || '').trim() || 'N/A'}
                </code>
                <Badge variant={statusVariant(linkedReferral?.status)}>
                  {String(linkedReferral?.status || 'PENDING').toUpperCase()}
                </Badge>
              </div>
              <div className="text-xs text-slate-500">
                Referrer: {linkedReferral?.referrer_vendor?.company_name || linkedReferral?.referrer_vendor?.vendor_id || '-'}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Apply Referral Code</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Label>Have a referral code? Link it before first paid plan.</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter referral code"
                  value={referralCodeInput}
                  onChange={(e) => setReferralCodeInput(String(e.target.value || '').toUpperCase())}
                />
                <Button onClick={handleLinkCode} disabled={linking}>
                  {linking ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Link
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Request Cashout</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Amount (₹)</Label>
              <Input
                type="number"
                min="1"
                value={cashoutAmount}
                onChange={(e) => setCashoutAmount(e.target.value)}
                placeholder={`Min ₹${inr(settings?.min_cashout_amount || 0)}`}
              />
            </div>
            <div>
              <Label>Note (optional)</Label>
              <Input
                value={cashoutNote}
                onChange={(e) => setCashoutNote(e.target.value)}
                placeholder="Add note for accounts team"
              />
            </div>
            <p className="text-xs text-slate-500">
              Cashout is processed manually by accounts team to your primary bank account.
            </p>
            <Button onClick={handleCashout} disabled={cashoutLoading}>
              {cashoutLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Submit Cashout
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My Referrals</CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Qualified</TableHead>
                <TableHead>Rewarded</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {referrals.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="font-medium">
                      {row?.referred_vendor?.company_name || row?.referred_vendor?.vendor_id || 'Vendor'}
                    </div>
                    <div className="text-xs text-slate-500">
                      {row?.referred_vendor?.email || '-'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(row.status)}>
                      {String(row.status || 'PENDING').toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>{fmtDateTime(row.created_at)}</TableCell>
                  <TableCell>{fmtDateTime(row.qualified_at)}</TableCell>
                  <TableCell>{fmtDateTime(row.rewarded_at)}</TableCell>
                </TableRow>
              ))}
              {referrals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-slate-500">
                    No referrals yet
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Wallet Ledger</CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledger.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-xs font-medium">{row.entry_type || '-'}</TableCell>
                  <TableCell>₹{inr(row.amount)}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(row.status)}>
                      {String(row.status || '').toUpperCase() || '-'}
                    </Badge>
                  </TableCell>
                  <TableCell>{fmtDateTime(row.created_at)}</TableCell>
                </TableRow>
              ))}
              {ledger.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-slate-500">
                    No ledger entries
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cashout History</CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>UTR</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Paid</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cashouts.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>₹{inr(row.requested_amount)}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(row.status)}>
                      {String(row.status || '').toUpperCase() || '-'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{row.utr_number || '-'}</TableCell>
                  <TableCell>{fmtDateTime(row.created_at)}</TableCell>
                  <TableCell>{fmtDateTime(row.paid_at)}</TableCell>
                </TableRow>
              ))}
              {cashouts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-slate-500">
                    No cashout requests
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

export default Referrals;
