import React, { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import {
  AlertTriangle,
  Check,
  Clock3,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Tag,
  X,
} from 'lucide-react';
import { salesApi } from '@/modules/employee/services/salesApi';

const formatAmount = (rule) => {
  const numeric = Number(rule?.value);
  if (!Number.isFinite(numeric)) return '-';
  const type = String(rule?.type || '').toUpperCase();
  if (['DISCOUNT', 'MARKUP', 'SURCHARGE'].includes(type)) return `${numeric.toLocaleString('en-IN')}%`;
  return `Rs ${numeric.toLocaleString('en-IN')}`;
};

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const getRuleTypeLabel = (value) =>
  String(value || '-')
    .replaceAll('_', ' ')
    .trim() || '-';

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

const PricingApprovals = () => {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRule, setSelectedRule] = useState(null);
  const [decision, setDecision] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');

  const loadApprovals = async () => {
    try {
      setLoading(true);
      const data = await salesApi.getManagerPricingApprovals();
      setApprovals(Array.isArray(data) ? data : []);
    } catch (error) {
      toast({
        title: 'Approvals load failed',
        description: error?.message || 'Unable to load pricing approvals',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApprovals();
  }, []);

  const filteredApprovals = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return approvals;
    return approvals.filter((rule) =>
      [
        rule.rule_name,
        rule.type,
        rule.value,
        rule.requested_by_name,
        rule.requested_by_email,
        rule.business_reason,
        rule.target_segment,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [approvals, search]);

  const totalValue = useMemo(
    () => approvals.reduce((sum, rule) => sum + (Number.isFinite(Number(rule?.value)) ? Number(rule.value) : 0), 0),
    [approvals]
  );

  const openDecisionDialog = (rule, nextDecision) => {
    setSelectedRule(rule);
    setDecision(nextDecision);
    setRemarks('');
  };

  const handleDecision = async () => {
    const ruleId = String(selectedRule?.id || '').trim();
    if (!ruleId || !decision) return;

    try {
      setSubmitting(true);
      await salesApi.decidePricingRule(ruleId, decision, remarks);
      setApprovals((prev) => prev.filter((rule) => rule.id !== ruleId));
      setSelectedRule(null);
      setDecision('');
      setRemarks('');
      toast({
        title: decision === 'APPROVE' ? 'Pricing rule approved' : 'Pricing rule rejected',
        description: 'Sales pricing queue has been updated.',
      });
    } catch (error) {
      toast({
        title: 'Approval action failed',
        description: error?.message || 'Unable to update pricing rule',
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
            <ShieldCheck className="h-4 w-4" />
            Manager approval desk
          </div>
          <h1 className="mt-2 text-2xl font-bold text-slate-950">Pricing Approvals</h1>
          <p className="mt-1 text-sm text-slate-600">
            Review sales pricing exceptions with commercial reason, segment, requester, and approval notes.
          </p>
        </div>
        <Button variant="outline" onClick={loadApprovals} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard icon={Clock3} label="Pending review" value={approvals.length} subtext="Open approval items" />
        <StatCard icon={AlertTriangle} label="Value under review" value={totalValue.toLocaleString('en-IN')} subtext="Amount or percent basis" />
        <StatCard icon={Tag} label="Filtered queue" value={filteredApprovals.length} subtext="Current working set" />
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-4">
          <div className="relative max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search requester, rule, segment, reason"
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="text-base">Approval Queue</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="grid h-56 place-items-center text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : filteredApprovals.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-md border border-dashed border-slate-300 bg-slate-50">
                <ShieldCheck className="h-5 w-5 text-slate-500" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-950">No pending pricing approvals</h3>
              <p className="mx-auto mt-1 max-w-xl text-sm text-slate-500">
                New sales pricing exceptions will appear here with business context before they can be used in vendor conversations.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1040px] text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Rule</th>
                    <th className="px-4 py-3 text-left">Commercial Case</th>
                    <th className="px-4 py-3 text-left">Requester</th>
                    <th className="px-4 py-3 text-left">Submitted</th>
                    <th className="px-4 py-3 text-right">Decision</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredApprovals.map((rule) => (
                    <tr key={rule.id} className="align-top hover:bg-slate-50/70">
                      <td className="px-4 py-4">
                        <p className="font-semibold text-slate-950">{rule.rule_name || '-'}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge variant="outline">{getRuleTypeLabel(rule.type)}</Badge>
                          <Badge variant="outline">{formatAmount(rule)}</Badge>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <p className="max-w-[360px] text-sm text-slate-700">{rule.business_reason || '-'}</p>
                        {rule.target_segment ? <p className="mt-2 text-xs text-slate-500">Segment: {rule.target_segment}</p> : null}
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-medium text-slate-900">{rule.requested_by_name || rule.requested_by_email || '-'}</p>
                        <p className="mt-1 text-xs text-slate-500">{rule.requested_by_role || '-'}</p>
                      </td>
                      <td className="px-4 py-4 text-xs text-slate-500">{formatDate(rule.submitted_at || rule.created_at)}</td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => openDecisionDialog(rule, 'APPROVE')}>
                            <Check className="mr-1 h-4 w-4" />
                            Approve
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => openDecisionDialog(rule, 'REJECT')}>
                            <X className="mr-1 h-4 w-4" />
                            Reject
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

      <Dialog
        open={Boolean(selectedRule)}
        onOpenChange={(open) => {
          if (submitting) return;
          if (!open) {
            setSelectedRule(null);
            setDecision('');
            setRemarks('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{decision === 'APPROVE' ? 'Approve Pricing Rule' : 'Reject Pricing Rule'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="font-semibold text-slate-950">{selectedRule?.rule_name || 'Pricing rule'}</p>
              <p className="mt-1 text-sm text-slate-600">
                {getRuleTypeLabel(selectedRule?.type)} - {formatAmount(selectedRule)}
              </p>
              {selectedRule?.business_reason ? (
                <p className="mt-2 text-sm text-slate-600">{selectedRule.business_reason}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label htmlFor="pricing-approval-remarks" className="text-sm font-medium text-slate-700">
                Manager Remarks
              </label>
              <Textarea
                id="pricing-approval-remarks"
                rows={4}
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
                placeholder="Add decision context for Sales and audit history."
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSelectedRule(null);
                setDecision('');
                setRemarks('');
              }}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className={decision === 'APPROVE' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
              variant={decision === 'APPROVE' ? 'default' : 'destructive'}
              onClick={handleDecision}
              disabled={submitting}
            >
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirm {decision === 'APPROVE' ? 'Approval' : 'Rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PricingApprovals;
