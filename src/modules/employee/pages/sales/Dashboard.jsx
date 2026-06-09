import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlarmClock,
  Building2,
  CheckCircle2,
  Copy,
  Eye,
  IndianRupee,
  Loader2,
  RefreshCw,
  Send,
  UserRound,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { salesApi } from '@/modules/employee/services/salesApi';

const fmtDateTime = (value) => {
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

const fmtMoney = (value) => {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return 'Rs. 0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

const getLeadTitle = (lead) =>
  lead?.title || lead?.product_name || lead?.requirement_title || lead?.name || 'Requirement';

const getRegion = (row) =>
  [row?.city, row?.state].filter(Boolean).join(', ') || row?.location || row?.vendor?.city || row?.vendor?.state || '-';

const statusClass = (status) => {
  const value = String(status || '').toUpperCase();
  if (['CLOSED', 'COMPLETED', 'CONVERTED'].includes(value)) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (['SENT', 'IN_PROGRESS', 'PENDING'].includes(value)) return 'border-blue-200 bg-blue-50 text-blue-700';
  if (['OVERDUE', 'OPEN'].includes(value)) return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-slate-200 bg-slate-50 text-slate-700';
};

const copyText = async (value, label = 'Copied') => {
  const text = String(value || '').trim();
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    toast({ title: label });
  } catch {
    toast({ title: 'Copy failed', description: text, variant: 'destructive' });
  }
};

const Kpi = ({ title, value, icon: Icon, tone = 'slate', hint }) => {
  const tones = {
    slate: 'bg-slate-50 text-slate-700 border-slate-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };

  return (
    <Card className="rounded-lg border-slate-200 shadow-sm">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`grid h-10 w-10 place-items-center rounded-lg border ${tones[tone] || tones.slate}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p>
          <p className="mt-1 text-2xl font-bold text-slate-950">{value}</p>
          {hint ? <p className="mt-1 truncate text-xs text-slate-500">{hint}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
};

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [dashboard, setDashboard] = useState(null);
  const [plans, setPlans] = useState([]);
  const [leads, setLeads] = useState([]);
  const [vendorSearch, setVendorSearch] = useState('');
  const [noPlanVendors, setNoPlanVendors] = useState([]);
  const [shareVendor, setShareVendor] = useState(null);
  const [reminderVendor, setReminderVendor] = useState(null);
  const [shareForm, setShareForm] = useState({ plan_id: '', channel: 'WHATSAPP', next_follow_up_at: '', notes: '' });
  const [reminderForm, setReminderForm] = useState({ channel: 'CALL', next_follow_up_at: '', notes: '' });
  const [lastShareLink, setLastShareLink] = useState('');

  const visitorLeads = useMemo(
    () =>
      (leads || [])
        .filter((lead) => lead?.visitor_id || lead?.visitor_session_id || lead?.lead_origin)
        .slice(0, 6),
    [leads]
  );

  const salesProfile = dashboard?.profile || {};
  const stats = dashboard?.stats || {};
  const reminders = dashboard?.reminders || [];
  const payments = dashboard?.attributed_payments || [];

  const load = async () => {
    try {
      setLoading(true);
      const [dashboardData, planRows, leadRows] = await Promise.all([
        salesApi.getDashboard(),
        salesApi.getSalesPlans(),
        salesApi.getAllLeads(),
      ]);
      setDashboard(dashboardData);
      setPlans(planRows || []);
      setLeads(leadRows || []);
      setNoPlanVendors(dashboardData?.no_plan_vendors || []);
    } catch (error) {
      toast({
        title: 'Sales dashboard load failed',
        description: error?.message || 'Unable to load Sales workspace',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const loadNoPlanVendors = async () => {
    try {
      setActionLoading('vendor-search');
      const data = await salesApi.getNoPlanVendors({ search: vendorSearch, limit: 80 });
      setNoPlanVendors(data.vendors || []);
    } catch (error) {
      toast({ title: 'Vendor queue failed', description: error?.message, variant: 'destructive' });
    } finally {
      setActionLoading('');
    }
  };

  const openShare = (vendor) => {
    const defaultPlan = (plans || []).find((plan) => Number(plan?.price || 0) > 0) || plans?.[0] || null;
    setShareVendor(vendor);
    setShareForm({ plan_id: defaultPlan?.id || '', channel: 'WHATSAPP', next_follow_up_at: '', notes: '' });
    setLastShareLink('');
  };

  const handleSharePlan = async () => {
    if (!shareVendor?.id || !shareForm.plan_id) {
      toast({ title: 'Vendor and plan are required', variant: 'destructive' });
      return;
    }
    try {
      setActionLoading('share-plan');
      const result = await salesApi.sharePlan({
        vendor_id: shareVendor.id,
        plan_id: shareForm.plan_id,
        channel: shareForm.channel,
        next_follow_up_at: shareForm.next_follow_up_at || undefined,
        notes: shareForm.notes,
      });
      setLastShareLink(result.link || '');
      toast({ title: 'Plan link ready', description: 'Share link created with your sales code.' });
      await load();
    } catch (error) {
      toast({ title: 'Plan share failed', description: error?.message, variant: 'destructive' });
    } finally {
      setActionLoading('');
    }
  };

  const handleCreateReminder = async () => {
    if (!reminderVendor?.id || !reminderForm.next_follow_up_at) {
      toast({ title: 'Vendor and follow-up time are required', variant: 'destructive' });
      return;
    }
    try {
      setActionLoading('create-reminder');
      await salesApi.createReminder({
        vendor_id: reminderVendor.id,
        channel: reminderForm.channel,
        next_follow_up_at: reminderForm.next_follow_up_at,
        notes: reminderForm.notes,
      });
      setReminderVendor(null);
      toast({ title: 'Reminder scheduled' });
      await load();
    } catch (error) {
      toast({ title: 'Reminder failed', description: error?.message, variant: 'destructive' });
    } finally {
      setActionLoading('');
    }
  };

  const completeReminder = async (reminder) => {
    try {
      setActionLoading(`reminder:${reminder.id}`);
      await salesApi.updateReminderStatus(reminder.id, 'COMPLETED');
      toast({ title: 'Follow-up completed' });
      await load();
    } catch (error) {
      toast({ title: 'Update failed', description: error?.message, variant: 'destructive' });
    } finally {
      setActionLoading('');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Sales Workspace</h1>
          <p className="mt-1 text-sm text-slate-600">Lead follow-ups, vendor plan conversion, and attribution in one place.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
          <Link to="/employee/sales/leads">
            <Button>
              <Eye className="mr-2 h-4 w-4" />
              Lead Management
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Kpi title="New Leads" value={loading ? '-' : stats.new_leads_7d || 0} icon={Users} tone="blue" hint="last 7 days" />
        <Kpi title="Visitor Leads" value={loading ? '-' : stats.visitor_leads || 0} icon={UserRound} tone="slate" hint="with visitor/session context" />
        <Kpi title="No Active Plan" value={loading ? '-' : noPlanVendors.length || 0} icon={Building2} tone="amber" hint="current queue sample" />
        <Kpi title="Due Follow-ups" value={loading ? '-' : stats.due_reminders || 0} icon={AlarmClock} tone="amber" hint="open reminders" />
        <Kpi title="Sales Revenue" value={loading ? '-' : stats.attributed_revenue_7d_fmt || fmtMoney(0)} icon={IndianRupee} tone="emerald" hint="attributed 7 days" />
      </div>

      <Card className="rounded-lg border-slate-200 shadow-sm">
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">My Sales Code</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="font-mono text-xl font-bold text-slate-950">{salesProfile.sales_code || '-'}</span>
              <Button size="sm" variant="outline" onClick={() => copyText(salesProfile.sales_code, 'Sales code copied')}>
                <Copy className="mr-2 h-4 w-4" />
                Copy Code
              </Button>
              <Button size="sm" variant="outline" onClick={() => copyText(salesProfile.plan_link_base, 'Plan link copied')}>
                <Send className="mr-2 h-4 w-4" />
                Copy Link
              </Button>
            </div>
          </div>
          <div className="max-w-xl rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">
            Plan links created from this dashboard include your code, so paid vendor subscriptions are visible in your attribution list.
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <Card className="rounded-lg border-slate-200 shadow-sm">
          <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Vendors Without Active Plan</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Prioritize onboarding calls and send tracked plan links.</p>
            </div>
            <div className="flex gap-2">
              <Input
                className="w-56"
                value={vendorSearch}
                onChange={(e) => setVendorSearch(e.target.value)}
                placeholder="Search vendor, city..."
              />
              <Button variant="outline" onClick={loadNoPlanVendors} disabled={actionLoading === 'vendor-search'}>
                {actionLoading === 'vendor-search' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="grid h-56 place-items-center text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : noPlanVendors.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-slate-500">No vendors found in this queue.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-3">Vendor</th>
                      <th className="py-2 pr-3">Contact</th>
                      <th className="py-2 pr-3">Region</th>
                      <th className="py-2 pr-3">Last Action</th>
                      <th className="py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {noPlanVendors.map((vendor) => (
                      <tr key={vendor.id} className="border-b last:border-0">
                        <td className="py-3 pr-3">
                          <div className="font-semibold text-slate-950">{vendor.company_name || vendor.vendor_id}</div>
                          <div className="text-xs text-slate-500">{vendor.owner_name || 'Owner not set'}</div>
                        </td>
                        <td className="py-3 pr-3">
                          <div className="text-slate-700">{vendor.phone || '-'}</div>
                          <div className="max-w-[180px] truncate text-xs text-slate-500">{vendor.email || '-'}</div>
                        </td>
                        <td className="py-3 pr-3">{getRegion(vendor)}</td>
                        <td className="py-3 pr-3">
                          {vendor.latest_engagement ? (
                            <div>
                              <Badge variant="outline" className={statusClass(vendor.latest_engagement.status)}>
                                {String(vendor.latest_engagement.engagement_type || '').replaceAll('_', ' ')}
                              </Badge>
                              <div className="mt-1 text-xs text-slate-500">{fmtDateTime(vendor.latest_engagement.created_at)}</div>
                            </div>
                          ) : (
                            <span className="text-slate-400">No action</span>
                          )}
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => setReminderVendor(vendor)}>
                              <AlarmClock className="mr-2 h-4 w-4" />
                              Follow-up
                            </Button>
                            <Button size="sm" onClick={() => openShare(vendor)}>
                              <Send className="mr-2 h-4 w-4" />
                              Send Plan
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card className="rounded-lg border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Follow-up Queue</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {reminders.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-slate-500">No scheduled follow-ups.</div>
              ) : (
                reminders.map((reminder) => (
                  <div key={reminder.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-950">{reminder.vendor?.company_name || reminder.vendor_id || 'Lead follow-up'}</div>
                        <div className="text-xs text-slate-500">{fmtDateTime(reminder.next_follow_up_at)}</div>
                      </div>
                      <Badge variant="outline" className={statusClass(reminder.status)}>{reminder.status}</Badge>
                    </div>
                    {reminder.notes ? <p className="mt-2 text-sm text-slate-600">{reminder.notes}</p> : null}
                    <Button
                      className="mt-3 w-full"
                      size="sm"
                      variant="outline"
                      onClick={() => completeReminder(reminder)}
                      disabled={actionLoading === `reminder:${reminder.id}`}
                    >
                      {actionLoading === `reminder:${reminder.id}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                      Mark Done
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="rounded-lg border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Attributed Sales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {payments.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-slate-500">No attributed plan sales yet.</div>
              ) : (
                payments.map((payment) => (
                  <div key={payment.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-950">{payment.vendor?.company_name || payment.vendor_id}</div>
                        <div className="text-xs text-slate-500">{payment.plan?.name || payment.plan_id}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-emerald-700">{fmtMoney(payment.net_amount ?? payment.amount)}</div>
                        <div className="text-xs text-slate-500">{fmtDateTime(payment.payment_date)}</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="rounded-lg border-slate-200 shadow-sm">
        <CardHeader className="sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Visitor Requirement Leads</CardTitle>
            <p className="mt-1 text-sm text-slate-500">Anonymous visitor/session context attached when a requirement form is submitted.</p>
          </div>
          <Link to="/employee/sales/leads">
            <Button variant="outline" size="sm">Open all leads</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {visitorLeads.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-slate-500">No visitor-context leads found.</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {visitorLeads.map((lead) => (
                <div key={lead.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-slate-950">{getLeadTitle(lead)}</div>
                      <div className="text-xs text-slate-500">{lead.buyer_name || 'Buyer'} • {lead.buyer_phone || lead.buyer_email || '-'}</div>
                    </div>
                    <Badge variant="outline" className={statusClass(lead.status)}>{lead.status || 'OPEN'}</Badge>
                  </div>
                  <div className="mt-3 space-y-1 text-xs text-slate-500">
                    <div>Region: {getRegion(lead)}</div>
                    <div>Visitor: {lead.visitor_id || '-'}</div>
                    <div className="truncate">Page: {lead.page_url || lead.landing_page || '-'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(shareVendor)} onOpenChange={(open) => !open && setShareVendor(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Send Plan Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border bg-slate-50 p-3 text-sm">
              <div className="font-semibold text-slate-950">{shareVendor?.company_name || '-'}</div>
              <div className="text-slate-500">{shareVendor?.phone || '-'} • {shareVendor?.email || '-'}</div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Plan</Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={shareForm.plan_id}
                  onChange={(e) => setShareForm((prev) => ({ ...prev, plan_id: e.target.value }))}
                >
                  <option value="">Select plan</option>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} - {fmtMoney(plan.price)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Channel</Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={shareForm.channel}
                  onChange={(e) => setShareForm((prev) => ({ ...prev, channel: e.target.value }))}
                >
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="CALL">Call</option>
                  <option value="EMAIL">Email</option>
                  <option value="SMS">SMS</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Follow-up Time</Label>
              <Input
                type="datetime-local"
                value={shareForm.next_follow_up_at}
                onChange={(e) => setShareForm((prev) => ({ ...prev, next_follow_up_at: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Note</Label>
              <Textarea
                rows={3}
                value={shareForm.notes}
                onChange={(e) => setShareForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Call context, buyer category, objection, or plan pitch note"
              />
            </div>
            {lastShareLink ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <div className="mb-2 text-sm font-semibold text-emerald-800">Tracked link ready</div>
                <div className="break-all rounded-md bg-white p-2 font-mono text-xs text-slate-700">{lastShareLink}</div>
                <Button className="mt-3" size="sm" variant="outline" onClick={() => copyText(lastShareLink, 'Tracked link copied')}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Link
                </Button>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShareVendor(null)}>Close</Button>
            <Button onClick={handleSharePlan} disabled={actionLoading === 'share-plan'}>
              {actionLoading === 'share-plan' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Create Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(reminderVendor)} onOpenChange={(open) => !open && setReminderVendor(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Schedule Follow-up</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border bg-slate-50 p-3 text-sm">
              <div className="font-semibold text-slate-950">{reminderVendor?.company_name || '-'}</div>
              <div className="text-slate-500">{reminderVendor?.phone || '-'} • {getRegion(reminderVendor)}</div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Channel</Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={reminderForm.channel}
                  onChange={(e) => setReminderForm((prev) => ({ ...prev, channel: e.target.value }))}
                >
                  <option value="CALL">Call</option>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="EMAIL">Email</option>
                  <option value="VISIT">Visit</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>When</Label>
                <Input
                  type="datetime-local"
                  value={reminderForm.next_follow_up_at}
                  onChange={(e) => setReminderForm((prev) => ({ ...prev, next_follow_up_at: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Note</Label>
              <Textarea
                rows={3}
                value={reminderForm.notes}
                onChange={(e) => setReminderForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="What should be discussed in the next follow-up?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReminderVendor(null)}>Cancel</Button>
            <Button onClick={handleCreateReminder} disabled={actionLoading === 'create-reminder'}>
              {actionLoading === 'create-reminder' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <AlarmClock className="mr-2 h-4 w-4" />}
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
