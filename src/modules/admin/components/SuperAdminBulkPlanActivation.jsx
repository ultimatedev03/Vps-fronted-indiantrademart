import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Eye,
  RefreshCw,
  ShieldCheck,
  Users,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { superAdminServerApi } from '@/modules/admin/services/superAdminServerApi';

const BULK_SCOPES = [
  {
    value: 'EXPIRED_LATEST_PLAN',
    label: 'Expired latest plan only',
    description:
      'Only vendors whose latest plan is the source plan, its end date has passed, and no plan is currently active.',
  },
  {
    value: 'ACTIVE_PLAN',
    label: 'Currently active source plan',
    description:
      'Only vendors whose current valid plan is the selected source plan. Other active plans remain untouched.',
  },
];

const isEnabledPlan = (plan) =>
  plan?.is_active === true ||
  plan?.is_active === 1 ||
  String(plan?.is_active || '').toLowerCase() === 'true';

const formatDate = (value) => {
  if (!value) return 'No end date';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Invalid date';
  return parsed.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const vendorLabel = (vendor) =>
  vendor?.company_name || vendor?.owner_name || vendor?.email || vendor?.vendor_code || 'Vendor';

const SuperAdminBulkPlanActivation = ({ plans = [], onApplied }) => {
  const [scope, setScope] = useState('EXPIRED_LATEST_PLAN');
  const [sourcePlanId, setSourcePlanId] = useState('');
  const [targetPlanId, setTargetPlanId] = useState('');
  const [durationDays, setDurationDays] = useState('365');
  const [notes, setNotes] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [lastResult, setLastResult] = useState(null);

  const sourcePlan = useMemo(
    () => plans.find((plan) => String(plan?.id) === String(sourcePlanId)) || null,
    [plans, sourcePlanId]
  );
  const targetPlan = useMemo(
    () => plans.find((plan) => String(plan?.id) === String(targetPlanId)) || null,
    [plans, targetPlanId]
  );
  const selectedScope = BULK_SCOPES.find((item) => item.value === scope) || BULK_SCOPES[0];
  const confirmationPhrase = preview ? `APPLY ${preview.eligible_count}` : '';

  useEffect(() => {
    if (!plans.length) return;
    const trialPlan =
      plans.find((plan) => String(plan?.name || '').trim().toLowerCase() === 'trial') ||
      plans.find(isEnabledPlan) ||
      plans[0];

    if (!plans.some((plan) => String(plan.id) === String(sourcePlanId))) {
      setSourcePlanId(String(trialPlan?.id || ''));
    }
    if (!plans.some((plan) => String(plan.id) === String(targetPlanId))) {
      setTargetPlanId(String(trialPlan?.id || ''));
      setDurationDays(String(Math.max(1, Number(trialPlan?.duration_days || 365))));
    }
  }, [plans, sourcePlanId, targetPlanId]);

  const invalidatePreview = () => {
    setPreview(null);
    setLastResult(null);
    setConfirmationText('');
    setError('');
  };

  const changeScope = (value) => {
    setScope(value);
    invalidatePreview();
  };

  const changeSourcePlan = (value) => {
    setSourcePlanId(value);
    invalidatePreview();
  };

  const changeTargetPlan = (value) => {
    const nextPlan = plans.find((plan) => String(plan.id) === String(value));
    setTargetPlanId(value);
    setDurationDays(String(Math.max(1, Number(nextPlan?.duration_days || 365))));
    invalidatePreview();
  };

  const changeDuration = (value) => {
    setDurationDays(value);
    invalidatePreview();
  };

  const buildPayload = () => ({
    scope,
    source_plan_id: sourcePlanId,
    target_plan_id: targetPlanId,
    duration_days: Number(durationDays),
  });

  const previewBulkChange = async () => {
    const parsedDuration = Number(durationDays);
    if (!sourcePlanId || !targetPlanId) {
      setError('Select both source and target plans.');
      return;
    }
    if (!Number.isFinite(parsedDuration) || parsedDuration < 1 || parsedDuration > 3660) {
      setError('Duration must be between 1 and 3660 days.');
      return;
    }

    setPreviewing(true);
    setError('');
    setLastResult(null);
    try {
      const response = await superAdminServerApi.plans.previewBulkActivation(buildPayload());
      setPreview(response?.preview || null);
    } catch (previewError) {
      setPreview(null);
      setError(previewError?.message || 'Bulk plan preview failed.');
    } finally {
      setPreviewing(false);
    }
  };

  const applyBulkChange = async (event) => {
    event?.preventDefault?.();
    if (!preview || confirmationText !== confirmationPhrase) return;

    setApplying(true);
    setError('');
    try {
      const response = await superAdminServerApi.plans.applyBulkActivation({
        ...buildPayload(),
        preview_hash: preview.selection_hash,
        confirmation: 'APPLY_BULK_PLAN',
        notes: notes.trim(),
      });
      const result = response?.result || null;
      setLastResult(result);
      setPreview(null);
      setConfirmOpen(false);
      setConfirmationText('');
      setNotes('');
      toast({
        title: 'Bulk plan activation complete',
        description: `${Number(result?.activated_count || 0).toLocaleString('en-IN')} matching vendors updated. Non-matching vendors were untouched.`,
      });
      await onApplied?.(result);
    } catch (applyError) {
      setError(applyError?.message || 'Bulk plan activation failed.');
      setConfirmOpen(false);
    } finally {
      setApplying(false);
    }
  };

  return (
    <>
      <Card className="border-neutral-800 bg-neutral-900">
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-white">
                <Users className="h-5 w-5 text-cyan-300" />
                Bulk vendor plan assignment
              </CardTitle>
              <CardDescription className="mt-1 max-w-3xl text-neutral-400">
                Preview a tightly scoped vendor group, then assign its plan in one audited
                operation. Vendors outside the selected scope are never modified.
              </CardDescription>
            </div>
            <Badge
              variant="outline"
              className="w-fit border-emerald-800 bg-emerald-950/40 text-emerald-300"
            >
              Preview required
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="bulk-plan-scope" className="text-neutral-200">
                Vendor scope
              </Label>
              <Select value={scope} onValueChange={changeScope}>
                <SelectTrigger
                  id="bulk-plan-scope"
                  className="border-neutral-700 bg-neutral-950 text-neutral-100"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BULK_SCOPES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bulk-source-plan" className="text-neutral-200">
                Source plan
              </Label>
              <Select value={sourcePlanId} onValueChange={changeSourcePlan}>
                <SelectTrigger
                  id="bulk-source-plan"
                  className="border-neutral-700 bg-neutral-950 text-neutral-100"
                >
                  <SelectValue placeholder="Select source plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={String(plan.id)}>
                      {plan.name || 'Unnamed plan'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bulk-target-plan" className="text-neutral-200">
                Assign plan
              </Label>
              <Select value={targetPlanId} onValueChange={changeTargetPlan}>
                <SelectTrigger
                  id="bulk-target-plan"
                  className="border-neutral-700 bg-neutral-950 text-neutral-100"
                >
                  <SelectValue placeholder="Select target plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={String(plan.id)}>
                      {plan.name || 'Unnamed plan'}
                      {!isEnabledPlan(plan) ? ' · inactive' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bulk-plan-duration" className="text-neutral-200">
                New duration
              </Label>
              <div className="relative">
                <CalendarClock className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-neutral-500" />
                <Input
                  id="bulk-plan-duration"
                  type="number"
                  min="1"
                  max="3660"
                  step="1"
                  value={durationDays}
                  onChange={(event) => changeDuration(event.target.value)}
                  className="border-neutral-700 bg-neutral-950 pl-9 text-neutral-100"
                />
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 border-l-2 border-cyan-700 bg-neutral-950/60 px-3 py-2 text-xs leading-5 text-neutral-400">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
            <span>
              {selectedScope.description} Changing {sourcePlan?.name || 'the source plan'} to{' '}
              {targetPlan?.name || 'the target plan'} resets only matching vendors&apos; lead
              quotas.
            </span>
          </div>

          {!isEnabledPlan(targetPlan) && targetPlan ? (
            <div className="flex items-start gap-2 border border-amber-900 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              The target plan is hidden from the public catalog. Superadmin assignment is still
              allowed and will be audited.
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div className="space-y-2">
              <Label htmlFor="bulk-plan-notes" className="text-neutral-200">
                Internal note
              </Label>
              <Textarea
                id="bulk-plan-notes"
                value={notes}
                maxLength={2000}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Reason or approval reference for this bulk assignment..."
                className="min-h-20 border-neutral-700 bg-neutral-950 text-neutral-100 placeholder:text-neutral-600"
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                onClick={previewBulkChange}
                disabled={previewing || applying || !plans.length}
                className="w-full bg-cyan-700 text-white hover:bg-cyan-600"
              >
                {previewing ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Eye className="mr-2 h-4 w-4" />
                )}
                {previewing ? 'Checking vendors...' : 'Preview affected vendors'}
              </Button>
            </div>
          </div>

          {error ? (
            <div className="border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          ) : null}

          {lastResult ? (
            <div className="flex flex-col gap-3 border border-emerald-900 bg-emerald-950/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-400" />
                <div>
                  <p className="font-semibold text-emerald-200">
                    {Number(lastResult.activated_count || 0).toLocaleString('en-IN')} vendors
                    updated
                  </p>
                  <p className="text-xs text-emerald-300/70">
                    {lastResult.target_plan?.name || 'Plan'} active until{' '}
                    {formatDate(lastResult.ends_at)}.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={previewBulkChange}
                className="border-emerald-800 bg-transparent text-emerald-200 hover:bg-emerald-950"
              >
                Check remaining scope
              </Button>
            </div>
          ) : null}

          {preview ? (
            <div className="space-y-4 border-t border-neutral-800 pt-5">
              <div className="grid gap-px overflow-hidden border border-neutral-800 bg-neutral-800 sm:grid-cols-3">
                <div className="bg-neutral-950 px-4 py-3">
                  <p className="text-xs uppercase text-neutral-500">Eligible vendors</p>
                  <p className="mt-1 text-2xl font-semibold text-cyan-300">
                    {Number(preview.eligible_count || 0).toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="bg-neutral-950 px-4 py-3">
                  <p className="text-xs uppercase text-neutral-500">Source plan history</p>
                  <p className="mt-1 text-2xl font-semibold text-white">
                    {Number(preview.source_history_count || 0).toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="bg-neutral-950 px-4 py-3">
                  <p className="text-xs uppercase text-neutral-500">Left unchanged</p>
                  <p className="mt-1 text-2xl font-semibold text-emerald-300">
                    {Number(preview.unchanged_source_history_count || 0).toLocaleString('en-IN')}
                  </p>
                </div>
              </div>

              {preview.sample?.length ? (
                <div className="overflow-x-auto border border-neutral-800">
                  <table className="w-full min-w-[620px] text-left text-sm">
                    <thead className="bg-neutral-950 text-xs uppercase text-neutral-500">
                      <tr>
                        <th className="px-3 py-2 font-medium">Vendor</th>
                        <th className="px-3 py-2 font-medium">Code</th>
                        <th className="px-3 py-2 font-medium">Source status</th>
                        <th className="px-3 py-2 font-medium">Source end</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800">
                      {preview.sample.map((vendor) => (
                        <tr key={vendor.vendor_record_id} className="bg-neutral-900 text-neutral-200">
                          <td className="px-3 py-2">
                            <p className="font-medium">{vendorLabel(vendor)}</p>
                            <p className="text-xs text-neutral-500">{vendor.email || 'No email'}</p>
                          </td>
                          <td className="px-3 py-2 text-neutral-400">
                            {vendor.vendor_code || vendor.vendor_record_id}
                          </td>
                          <td className="px-3 py-2">
                            <Badge
                              variant="outline"
                              className="border-neutral-700 text-neutral-300"
                            >
                              {vendor.source_status || 'UNKNOWN'}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-neutral-400">
                            {formatDate(vendor.source_end_date)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="border border-neutral-800 bg-neutral-950 px-4 py-6 text-center text-sm text-neutral-400">
                  No vendors currently match this scope. No records will be changed.
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-2xl text-xs leading-5 text-neutral-500">
                  Apply rechecks this exact vendor set inside the database transaction. If
                  eligibility changes after preview, the operation stops without changing any
                  plans.
                </p>
                <Button
                  type="button"
                  disabled={!preview.eligible_count || applying}
                  onClick={() => {
                    setConfirmationText('');
                    setConfirmOpen(true);
                  }}
                  className="bg-emerald-700 text-white hover:bg-emerald-600"
                >
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Apply to {Number(preview.eligible_count || 0).toLocaleString('en-IN')} vendors
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!applying) setConfirmOpen(open);
        }}
      >
        <AlertDialogContent className="max-w-lg border-neutral-800 bg-neutral-950 text-neutral-100">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm bulk plan assignment</AlertDialogTitle>
            <AlertDialogDescription className="text-neutral-400">
              This will assign {targetPlan?.name || 'the target plan'} for {durationDays} days to{' '}
              {Number(preview?.eligible_count || 0).toLocaleString('en-IN')} matching vendors and
              reset their lead quotas. All other vendors remain unchanged.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <Label htmlFor="bulk-plan-confirmation" className="text-neutral-200">
              Type <span className="font-mono text-amber-300">{confirmationPhrase}</span> to
              continue
            </Label>
            <Input
              id="bulk-plan-confirmation"
              value={confirmationText}
              autoComplete="off"
              onChange={(event) => setConfirmationText(event.target.value.toUpperCase())}
              className="border-neutral-700 bg-neutral-900 font-mono text-neutral-100"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={applying}
              className="border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={applying || confirmationText !== confirmationPhrase}
              onClick={applyBulkChange}
              className="bg-emerald-700 text-white hover:bg-emerald-600"
            >
              {applying ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="mr-2 h-4 w-4" />
              )}
              {applying ? 'Applying...' : 'Confirm assignment'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default SuperAdminBulkPlanActivation;
