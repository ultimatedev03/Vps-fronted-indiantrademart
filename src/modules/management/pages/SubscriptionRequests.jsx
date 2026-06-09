import React, { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import {
  ArrowUpRight,
  Building2,
  CalendarClock,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  TimerReset,
} from 'lucide-react';
import { salesApi } from '@/modules/employee/services/salesApi';

const statusBadgeClass = (status) => {
  if (status === 'RESOLVED') return 'bg-emerald-50 border-emerald-200 text-emerald-700';
  if (status === 'REJECTED') return 'bg-red-50 border-red-200 text-red-700';
  if (status === 'FORWARDED') return 'bg-blue-50 border-blue-200 text-blue-700';
  return 'bg-amber-50 border-amber-200 text-amber-700';
};

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const safeNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const getAgeDays = (value) => {
  const date = value ? new Date(value).getTime() : 0;
  if (!date) return 0;
  return Math.max(0, Math.floor((Date.now() - date) / (24 * 60 * 60 * 1000)));
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

export default function SubscriptionRequests({ role: propRole }) {
  const role = String(propRole || '').toUpperCase();
  const isManager = role === 'MANAGER';
  const isVp = role === 'VP';

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [noteModal, setNoteModal] = useState(null);
  const [forwarding, setForwarding] = useState(false);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      let data = [];
      if (isManager) data = await salesApi.getManagerExtensionRequests();
      if (isVp) data = await salesApi.getVpExtensionRequests();
      setRequests(Array.isArray(data) ? data : []);
    } catch (error) {
      toast({ title: 'Load failed', description: error?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [role]);

  const stats = useMemo(() => {
    const totalDays = requests.reduce((sum, row) => sum + safeNumber(row.extension_days), 0);
    const aging = requests.filter((row) => getAgeDays(row.created_at) >= 2).length;
    const uniqueStates = new Set(requests.map((row) => String(row.vendor_state || '').trim()).filter(Boolean)).size;
    return { totalDays, aging, uniqueStates };
  }, [requests]);

  const filteredRequests = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return requests;
    return requests.filter((row) =>
      [
        row.vendor_name,
        row.vendor_state,
        row.reason,
        row.sales_note,
        row.manager_note,
        row.vp_note,
        row.created_by_email,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [requests, search]);

  const handleForward = async () => {
    if (!noteModal) return;
    setForwarding(true);
    try {
      if (isManager) {
        await salesApi.forwardToVp(noteModal.id, noteModal.note);
        toast({ title: 'Forwarded to VP', description: 'Request escalated for regional review.' });
      } else if (isVp) {
        await salesApi.forwardToAdmin(noteModal.id, noteModal.note);
        toast({ title: 'Forwarded to Admin', description: 'Request escalated for final resolution.' });
      }
      setNoteModal(null);
      load();
    } catch (error) {
      toast({ title: 'Forward failed', description: error?.message, variant: 'destructive' });
    } finally {
      setForwarding(false);
    }
  };

  const forwardLabel = isManager ? 'Forward to VP' : 'Forward to Admin';
  const pageTitle = isManager ? 'Manager Extension Review' : 'VP Extension Review';
  const pageDesc = isManager
    ? 'Validate subscription-extension requests from Sales before regional escalation.'
    : 'Review manager-escalated extension requests before Admin applies the decision.';
  const nextOwner = isManager ? 'VP' : 'Admin';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <ShieldCheck className="h-4 w-4" />
            Subscription exception governance
          </div>
          <h1 className="mt-2 text-2xl font-bold text-slate-950">{pageTitle}</h1>
          <p className="mt-1 text-sm text-slate-600">{pageDesc}</p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard icon={FileText} label="Pending review" value={requests.length} subtext={`Waiting for ${nextOwner}`} />
        <StatCard icon={CalendarClock} label="Days requested" value={stats.totalDays} subtext="Total extension exposure" />
        <StatCard icon={TimerReset} label="Aging cases" value={stats.aging} subtext="Older than 2 days" />
        <StatCard icon={Building2} label="Regions touched" value={stats.uniqueStates} subtext="State-level spread" />
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-4">
          <div className="relative max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search vendor, state, reason, requester"
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="text-base">Review Queue</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="grid h-56 place-items-center text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-md border border-dashed border-slate-300 bg-slate-50">
                <ShieldCheck className="h-5 w-5 text-slate-500" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-950">No pending requests at this level</h3>
              <p className="mx-auto mt-1 max-w-xl text-sm text-slate-500">
                When Sales escalates an extension exception, it will appear here with reason, notes, requester, and age.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Vendor</th>
                    <th className="px-4 py-3 text-left">Request</th>
                    <th className="px-4 py-3 text-left">Sales Context</th>
                    <th className="px-4 py-3 text-left">Escalation Notes</th>
                    <th className="px-4 py-3 text-left">Age</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRequests.map((row) => (
                    <tr key={row.id} className="align-top hover:bg-slate-50/70">
                      <td className="px-4 py-4">
                        <p className="font-semibold text-slate-950">{row.vendor_name || '-'}</p>
                        <p className="mt-1 text-xs text-slate-500">{row.vendor_state || 'State not set'}</p>
                        <p className="mt-1 text-xs text-slate-500">{row.created_by_email || '-'}</p>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">{safeNumber(row.extension_days)} days</Badge>
                          <Badge className={statusBadgeClass(row.status)} variant="outline">
                            {row.status || 'OPEN'}
                          </Badge>
                        </div>
                        <p className="mt-2 max-w-[320px] text-sm text-slate-700">{row.reason || '-'}</p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="max-w-[280px] text-sm text-slate-600">{row.sales_note || 'No sales note added'}</p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="max-w-[280px] text-xs text-slate-600">
                          {row.manager_note ? `Manager: ${row.manager_note}` : 'Manager note pending'}
                        </p>
                        <p className="mt-1 max-w-[280px] text-xs text-slate-600">
                          {row.vp_note ? `VP: ${row.vp_note}` : 'VP note pending'}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-medium text-slate-900">{getAgeDays(row.created_at)} day(s)</p>
                        <p className="mt-1 text-xs text-slate-500">{formatDate(row.created_at)}</p>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-blue-200 text-blue-700 hover:bg-blue-50"
                          onClick={() => setNoteModal({ id: row.id, note: '', vendor_name: row.vendor_name })}
                        >
                          <ArrowUpRight className="mr-1 h-4 w-4" />
                          {forwardLabel}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(noteModal)}
        onOpenChange={(open) => {
          if (forwarding) return;
          if (!open) setNoteModal(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {forwardLabel} - {noteModal?.vendor_name || 'Vendor request'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">{isManager ? 'Manager Note' : 'VP Note'}</label>
            <Textarea
              rows={4}
              placeholder="Add context for the next reviewer."
              value={noteModal?.note || ''}
              onChange={(event) => setNoteModal((current) => ({ ...(current || {}), note: event.target.value }))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteModal(null)} disabled={forwarding}>
              Cancel
            </Button>
            <Button onClick={handleForward} disabled={forwarding}>
              {forwarding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {forwardLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
