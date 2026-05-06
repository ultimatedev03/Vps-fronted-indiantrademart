import React, { useEffect, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { Plus, Loader2 } from 'lucide-react';
import { salesApi } from '@/modules/employee/services/salesApi';

const RULE_TYPE_OPTIONS = [
  { value: 'MANUAL', label: 'Manual' },
  { value: 'DISCOUNT', label: 'Discount' },
  { value: 'MARKUP', label: 'Markup' },
  { value: 'SURCHARGE', label: 'Surcharge' },
  { value: 'SPECIAL_RATE', label: 'Special Rate' },
];

const createDefaultNewRule = () => ({
  name: '',
  type: RULE_TYPE_OPTIONS[0].value,
  value: '',
});

const getRuleStatus = (rule) => {
  if (rule?.status) return String(rule.status).toUpperCase();
  if (rule?.is_active === true) return 'ACTIVE';
  if (rule?.is_active === false) return 'INACTIVE';
  return 'DRAFT';
};

const getRuleName = (rule) =>
  rule?.rule_name ||
  rule?.name ||
  rule?.plan_name ||
  'Untitled Rule';

const getRuleType = (rule) =>
  String(rule?.type || rule?.plan_type || rule?.billing_cycle || '-')
    .replaceAll('_', ' ')
    .trim() || '-';

const getRuleValue = (rule) => {
  const numeric = Number(rule?.value ?? rule?.price ?? rule?.amount);
  if (Number.isFinite(numeric)) {
    return `Rs ${numeric.toLocaleString('en-IN')}`;
  }
  return rule?.value ?? rule?.price ?? '-';
};

const statusClassName = (status) => {
  if (status === 'ACTIVE' || status === 'APPROVED') {
    return 'bg-green-50 border-green-200 text-green-700';
  }
  if (status === 'PENDING_APPROVAL') {
    return 'bg-orange-50 border-orange-200 text-orange-700';
  }
  if (status === 'REJECTED') {
    return 'bg-red-50 border-red-200 text-red-700';
  }
  return 'bg-gray-50 border-gray-200 text-gray-700';
};

const PricingRules = () => {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newRule, setNewRule] = useState(createDefaultNewRule);

  useEffect(() => {
    const fetchRules = async () => {
      try {
        const data = await salesApi.getPricingRules();
        setRules(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to fetch pricing rules:', error);
        toast({
          title: 'Pricing rules load failed',
          description: error?.message || 'Unable to load pricing rules',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchRules();
  }, []);

  const handleCreateRule = async () => {
    const name = String(newRule.name || '').trim();
    const value = Number(newRule.value);

    if (!name) {
      toast({
        title: 'Rule name required',
        description: 'Please enter a rule name.',
        variant: 'destructive',
      });
      return;
    }

    if (!RULE_TYPE_OPTIONS.some((option) => option.value === newRule.type)) {
      toast({
        title: 'Rule type required',
        description: 'Please select a valid rule type.',
        variant: 'destructive',
      });
      return;
    }

    if (!Number.isFinite(value) || value < 0) {
      toast({
        title: 'Invalid rule value',
        description: 'Please enter a valid non-negative value.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);
      const createdRule = await salesApi.createPricingRule({
        name,
        type: newRule.type,
        value,
      });

      setRules((prev) => [createdRule, ...prev.filter((rule) => rule?.id !== createdRule?.id)]);
      setNewRule(createDefaultNewRule());
      setCreateOpen(false);
      toast({
        title: 'Rule submitted',
        description: 'Pricing rule sent to the Manager for approval.',
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-neutral-800">Pricing Rules Engine</h2>
          <p className="text-sm text-neutral-500">New rules are submitted directly to the Manager approval queue.</p>
        </div>
        <Button
          type="button"
          className="bg-[#003D82]"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          New Rule
        </Button>
      </div>

      <div className="bg-white rounded-lg border border-neutral-200 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rule Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Requested By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-neutral-500">
                  Loading pricing rules...
                </TableCell>
              </TableRow>
            ) : rules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-neutral-500">
                  No pricing rules found.
                </TableCell>
              </TableRow>
            ) : (
              rules.map((rule) => {
                const status = getRuleStatus(rule);
                return (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">{getRuleName(rule)}</TableCell>
                    <TableCell>{getRuleType(rule)}</TableCell>
                    <TableCell>{getRuleValue(rule)}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs border ${statusClassName(status)}`}>
                        {status.replaceAll('_', ' ')}
                      </span>
                    </TableCell>
                    <TableCell>{rule?.requested_by_name || rule?.requested_by_email || '-'}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (submitting) return;
          setCreateOpen(open);
          if (!open) {
            setNewRule(createDefaultNewRule());
          }
        }}
      >
        <DialogContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              handleCreateRule();
            }}
          >
            <DialogHeader>
              <DialogTitle>Create Pricing Rule</DialogTitle>
            </DialogHeader>

            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-700">Rule Name</label>
              <Input
                autoFocus
                value={newRule.name}
                onChange={(event) => setNewRule((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="e.g. North Region Premium"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-700">Rule Type</label>
              <Select
                value={newRule.type}
                onValueChange={(value) => setNewRule((prev) => ({ ...prev, type: value }))}
              >
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
              <label className="text-sm font-medium text-neutral-700">Value</label>
              <Input
                type="number"
                min="0"
                value={newRule.value}
                onChange={(event) => setNewRule((prev) => ({ ...prev, value: event.target.value }))}
                placeholder="0"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCreateOpen(false);
                  setNewRule(createDefaultNewRule());
                }}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" className="bg-[#003D82]" disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create And Send
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PricingRules;
