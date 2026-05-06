import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { Check, Loader2, X } from 'lucide-react';
import { salesApi } from '@/modules/employee/services/salesApi';

const formatAmount = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '-';
  return `Rs ${numeric.toLocaleString('en-IN')}`;
};

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-GB');
};

const getRuleTypeLabel = (value) =>
  String(value || '-')
    .replaceAll('_', ' ')
    .trim() || '-';

const PricingApprovals = () => {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRule, setSelectedRule] = useState(null);
  const [decision, setDecision] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchApprovals = async () => {
      try {
        const data = await salesApi.getManagerPricingApprovals();
        setApprovals(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to fetch pricing approvals:', error);
        toast({
          title: 'Approvals load failed',
          description: error?.message || 'Unable to load pricing approvals',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchApprovals();
  }, []);

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
        description: 'The sales request has been updated successfully.',
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
      <div>
        <h2 className="text-2xl font-bold text-neutral-800">Pricing Approvals</h2>
        <p className="text-sm text-neutral-500">Review pending pricing-rule requests submitted from the Sales portal.</p>
      </div>

      <div className="bg-white rounded-lg border border-neutral-200 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rule Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Requested By</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-neutral-500">
                  Loading pricing approvals...
                </TableCell>
              </TableRow>
            ) : approvals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-neutral-500">
                  No pending pricing approvals.
                </TableCell>
              </TableRow>
            ) : (
              approvals.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{rule.rule_name || '-'}</TableCell>
                  <TableCell>{getRuleTypeLabel(rule.type)}</TableCell>
                  <TableCell>{formatAmount(rule.value)}</TableCell>
                  <TableCell>{rule.requested_by_name || rule.requested_by_email || '-'}</TableCell>
                  <TableCell>{formatDate(rule.submitted_at || rule.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => openDecisionDialog(rule, 'APPROVE')}
                      >
                        <Check className="mr-1 h-4 w-4" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => openDecisionDialog(rule, 'REJECT')}
                      >
                        <X className="mr-1 h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

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
            <p className="text-sm text-neutral-600">
              {decision === 'APPROVE' ? 'Approve' : 'Reject'}{' '}
              <span className="font-semibold">{selectedRule?.rule_name || 'this pricing rule'}</span>
              {' '}submitted by {selectedRule?.requested_by_name || selectedRule?.requested_by_email || 'Sales'}.
            </p>

            <div className="space-y-2">
              <label htmlFor="pricing-approval-remarks" className="text-sm font-medium text-neutral-700">
                Remarks
              </label>
              <Textarea
                id="pricing-approval-remarks"
                rows={4}
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
                placeholder="Add an internal note for this decision..."
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
              className={decision === 'APPROVE' ? 'bg-green-600 hover:bg-green-700' : ''}
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
