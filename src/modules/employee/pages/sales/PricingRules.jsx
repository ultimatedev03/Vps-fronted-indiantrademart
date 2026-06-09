import React, { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import {
  BadgeIndianRupee,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Tag,
} from 'lucide-react';
import { salesApi } from '@/modules/employee/services/salesApi';

const ALL_VALUE = 'ALL';
const RULE_TYPE_OPTIONS = [
  { value: 'MANUAL', label: 'Manual' },
  { value: 'DISCOUNT', label: 'Discount' },
  { value: 'MARKUP', label: 'Markup' },
  { value: 'SURCHARGE', label: 'Surcharge' },
  { value: 'SPECIAL_RATE', label: 'Special Rate' },
];

const STATUS_OPTIONS = [
  { value: ALL_VALUE, label: 'All statuses' },
  { value: 'PENDING_APPROVAL', label: 'Pending approval' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'DRAFT', label: 'Draft plan' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

const createDefaultNewRule = () => ({
  name: '',
  type: 'SPECIAL_RATE',
  value: '',
  target_segment: '',
  business_reason: '',
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

const getRuleStatus = (rule) => {
  if (rule?.status) return String(rule.status).toUpperCase();
  if (rule?.is_active === true) return 'ACTIVE';
  if (rule?.is_active === false) return 'INACTIVE';
  return 'DRAFT';
};

const getRuleName = (rule) => rule?.rule_name || rule?.name || rule?.plan_name || 'Untitled Rule';

const getRuleType = (rule) =>
  String(rule?.type || rule?.plan_type || rule?.billing_cycle || '-')
    .replaceAll('_', ' ')
    .trim() || '-';

const getRuleValue = (rule) => {
  const numeric = Number(rule?.value ?? rule?.price ?? rule?.amount);
  if (!Number.isFinite(numeric)) return rule?.value ?? rule?.price ?? '-';
  const type = String(rule?.type || '').toUpperCase();
  if (type === 'DISCOUNT' || type === 'MARKUP' || type === 'SURCHARGE') {
    return `${numeric.toLocaleString('en-IN')}%`;
  }
  return `Rs ${numeric.toLocaleString('en-IN')}`;
};

const statusClassName = (status) => {
  if (status === 'ACTIVE' || status === 'APPROVED') return 'bg-emerald-50 border-emerald-200 text-emerald-700';
  if (status === 'PENDING_APPROVAL') return 'bg-amber-50 border-amber-200 text-amber-700';
  if (status === 'REJECTED' || status === 'INACTIVE') return 'bg-red-50 border-red-200 text-red-700';
  return 'bg-slate-50 border-slate-200 text-slate-700';
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

const PricingRules = () => {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newRule, setNewRule] = useState(createDefaultNewRule);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(ALL_VALUE);
  const [type, setType] = useState(ALL_VALUE);

  const loadRules = async () => {
    try {
      setLoading(true);
      const data = await salesApi.getPricingRules();
      setRules(Array.isArray(data) ? data : []);
    } catch (error) {
      toast({
        title: 'Pricing rules load failed',
        description: error?.message || 'Unable to load pricing rules',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  const stats = useMemo(() => {
    const pending = rules.filter((rule) => getRuleStatus(rule) === 'PENDING_APPROVAL').length;
    const approved = rules.filter((rule) => ['APPROVED', 'ACTIVE'].includes(getRuleStatus(rule))).length;
    const rejected = rules.filter((rule) => getRuleStatus(rule) === 'REJECTED').length;
    const drafts = rules.filter((rule) => ['DRAFT', 'INACTIVE'].includes(getRuleStatus(rule))).length;
    return { pending, approved, rejected, drafts };
  }, [rules]);

  const filteredRules = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rules.filter((rule) => {
      const ruleStatus = getRuleStatus(rule);
      const ruleType = String(rule?.type || '').toUpperCase();
      if (status !== ALL_VALUE && ruleStatus !== status) return false;
      if (type !== ALL_VALUE && ruleType !== type) return false;
      if (!term) return true;
      return [
        getRuleName(rule),
        getRuleType(rule),
        getRuleValue(rule),
        ruleStatus,
        rule?.requested_by_name,
        rule?.requested_by_email,
        rule?.business_reason,
        rule?.target_segment,
        rule?.description,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term);
    });
  }, [rules, search, status, type]);

  const handleCreateRule = async () => {
    const name = String(newRule.name || '').trim();
    const value = Number(newRule.value);
    const businessReason = String(newRule.business_reason || '').trim();

    if (!name) return toast({ title: 'Rule name required', description: 'Please enter a rule name.', variant: 'destructive' });
    if (!RULE_TYPE_OPTIONS.some((option) => option.value === newRule.type)) {
      return toast({ title: 'Rule type required', description: 'Please select a valid rule type.', variant: 'destructive' });
    }
    if (!Number.isFinite(value) || value < 0) {
      return toast({ title: 'Invalid rule value', description: 'Please enter a valid non-negative value.', variant: 'destructive' });
    }
    if (newRule.type === 'DISCOUNT' && value > 100) {
      return toast({ title: 'Invalid discount', description: 'Discount cannot be more than 100%.', variant: 'destructive' });
    }
    if (!businessReason) {
      return toast({ title: 'Business reason required', description: 'Add why this pricing exception should be approved.', variant: 'destructive' });
    }

    try {
      setSubmitting(true);
      const createdRule = await salesApi.createPricingRule({
        name,
        type: newRule.type,
        value,
        target_segment: String(newRule.target_segment || '').trim() || undefined,
        business_reason: businessReason,
      });

      if (createdRule) {
        setRules((prev) => [createdRule, ...prev.filter((rule) => rule?.id !== createdRule?.id)]);
      }
      setNewRule(createDefaultNewRule());
      setCreateOpen(false);
      toast({
        title: 'Rule submitted',
        description: 'Pricing request sent to the Manager approval queue.',
      });
    } catch (error) {
      toast({
        title: 'Rule creation failed',
        description: error?.message || 'Unable to create pricing rule',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <SlidersHorizontal className="h-4 w-4" />
            Revenue governance
          </div>
          <h1 className="mt-2 text-2xl font-bold text-slate-950">Pricing Rules Engine</h1>
          <p className="mt-1 text-sm text-slate-600">
            Submit rate exceptions with business context and track manager approval before quoting vendors.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={loadRules} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Rule
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Clock3} label="Pending approval" value={stats.pending} subtext="Manager action required" />
        <StatCard icon={CheckCircle2} label="Approved or active" value={stats.approved} subtext="Usable in sales motion" />
        <StatCard icon={ShieldAlert} label="Rejected" value={stats.rejected} subtext="Needs revised case" />
        <StatCard icon={BadgeIndianRupee} label="Draft catalog" value={stats.drafts} subtext={`${rules.length} total records`} />
      </div>

      <Card className="border-slate-200">
        <CardContent className="grid grid-cols-1 gap-3 p-4 lg:grid-cols-[1fr_220px_220px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search rule, requester, segment, reason"
              className="pl-9"
            />
          </div>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger>
              <SelectValue placeholder="Rule type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All types</SelectItem>
              {RULE_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
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
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="text-base">Pricing Queue</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="grid h-56 place-items-center text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : filteredRules.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-md border border-dashed border-slate-300 bg-slate-50">
                <Tag className="h-5 w-5 text-slate-500" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-950">No pricing records match this view</h3>
              <p className="mx-auto mt-1 max-w-xl text-sm text-slate-500">
                Create a rule when a vendor quote needs discounting, special rate handling, or a commercially approved adjustment.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1040px] text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Rule</th>
                    <th className="px-4 py-3 text-left">Value</th>
                    <th className="px-4 py-3 text-left">Approval</th>
                    <th className="px-4 py-3 text-left">Business Context</th>
                    <th className="px-4 py-3 text-left">Requested By</th>
                    <th className="px-4 py-3 text-left">Timeline</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRules.map((rule) => {
                    const ruleStatus = getRuleStatus(rule);
                    return (
                      <tr key={rule.id} className="align-top hover:bg-slate-50/70">
                        <td className="px-4 py-4">
                          <p className="font-semibold text-slate-950">{getRuleName(rule)}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Badge variant="outline">{getRuleType(rule)}</Badge>
                            {rule?.source === 'pricing_rule_request' ? <Badge variant="outline">Sales request</Badge> : <Badge variant="outline">Plan catalog</Badge>}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-semibold text-slate-950">{getRuleValue(rule)}</p>
                          {rule?.price ? <p className="mt-1 text-xs text-slate-500">Base catalog price</p> : null}
                        </td>
                        <td className="px-4 py-4">
                          <Badge className={statusClassName(ruleStatus)} variant="outline">
                            {ruleStatus.replaceAll('_', ' ')}
                          </Badge>
                          {rule?.manager_remarks ? <p className="mt-2 max-w-[220px] text-xs text-slate-500">{rule.manager_remarks}</p> : null}
                        </td>
                        <td className="px-4 py-4">
                          <p className="max-w-[320px] text-sm text-slate-700">{rule?.business_reason || rule?.description || '-'}</p>
                          {rule?.target_segment ? <p className="mt-2 text-xs text-slate-500">Segment: {rule.target_segment}</p> : null}
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-medium text-slate-900">{rule?.requested_by_name || rule?.requested_by_email || '-'}</p>
                          <p className="mt-1 text-xs text-slate-500">{rule?.requested_by_role || '-'}</p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-xs text-slate-500">Submitted: {formatDate(rule?.submitted_at || rule?.created_at)}</p>
                          {rule?.decided_at ? <p className="mt-1 text-xs text-slate-500">Decision: {formatDate(rule.decided_at)}</p> : null}
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

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (submitting) return;
          setCreateOpen(open);
          if (!open) setNewRule(createDefaultNewRule());
        }}
      >
        <DialogContent className="max-w-2xl">
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              handleCreateRule();
            }}
          >
            <DialogHeader>
              <DialogTitle>Create Pricing Rule</DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-slate-700">Rule Name</label>
                <Input
                  autoFocus
                  value={newRule.name}
                  onChange={(event) => setNewRule((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="e.g. Strategic account recovery rate"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Rule Type</label>
                <Select value={newRule.type} onValueChange={(value) => setNewRule((prev) => ({ ...prev, type: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select rule type" />
                  </SelectTrigger>
                  <SelectContent>
                    {RULE_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Value</label>
                <Input
                  type="number"
                  min="0"
                  value={newRule.value}
                  onChange={(event) => setNewRule((prev) => ({ ...prev, value: event.target.value }))}
                  placeholder={newRule.type === 'DISCOUNT' ? 'Percent discount' : 'Amount or percent'}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-slate-700">Target Segment</label>
                <Input
                  value={newRule.target_segment}
                  onChange={(event) => setNewRule((prev) => ({ ...prev, target_segment: event.target.value }))}
                  placeholder="e.g. Delhi machinery vendors, renewal save desk, enterprise buyer"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-slate-700">Business Reason</label>
                <Textarea
                  rows={4}
                  value={newRule.business_reason}
                  onChange={(event) => setNewRule((prev) => ({ ...prev, business_reason: event.target.value }))}
                  placeholder="Explain commercial impact, competitor pressure, account value, or retention risk."
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileCheck2 className="mr-2 h-4 w-4" />}
                Submit For Approval
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PricingRules;
