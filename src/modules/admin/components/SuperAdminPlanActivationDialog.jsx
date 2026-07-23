import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Info, RefreshCw, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

const isEnabledPlan = (plan) =>
  plan?.is_active === true ||
  plan?.is_active === 1 ||
  String(plan?.is_active || '').toLowerCase() === 'true';

const vendorName = (vendor) =>
  vendor?.company_name ||
  vendor?.profile?.company_name ||
  vendor?.owner_name ||
  vendor?.profile?.owner_name ||
  vendor?.email ||
  vendor?.profile?.email ||
  'Selected vendor';

const currentPlan = (vendor) => vendor?.current_plan || vendor?.plan || null;

const formatMoney = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const SuperAdminPlanActivationDialog = ({
  open,
  onOpenChange,
  vendor,
  plans = [],
  onActivate,
  dark = true,
}) => {
  const [planId, setPlanId] = useState('');
  const [durationDays, setDurationDays] = useState('365');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedPlan = useMemo(
    () => (plans || []).find((plan) => String(plan?.id) === String(planId)) || null,
    [planId, plans]
  );
  const existingPlan = currentPlan(vendor);

  useEffect(() => {
    if (!open) return;
    const existingPlanId = String(existingPlan?.plan_id || existingPlan?.id || '');
    const initialPlan =
      (plans || []).find((plan) => String(plan?.id) === existingPlanId) ||
      (plans || []).find(isEnabledPlan) ||
      plans?.[0] ||
      null;
    setPlanId(String(initialPlan?.id || ''));
    setDurationDays(String(Math.max(1, Number(initialPlan?.duration_days || 365))));
    setNotes('');
    setError('');
  }, [existingPlan?.id, existingPlan?.plan_id, open, plans]);

  const selectPlan = (nextPlanId) => {
    const nextPlan = (plans || []).find((plan) => String(plan?.id) === String(nextPlanId));
    setPlanId(nextPlanId);
    setDurationDays(String(Math.max(1, Number(nextPlan?.duration_days || 365))));
    setError('');
  };

  const submit = async () => {
    const parsedDuration = Number(durationDays);
    if (!planId) {
      setError('Select a subscription plan.');
      return;
    }
    if (!Number.isFinite(parsedDuration) || parsedDuration < 1 || parsedDuration > 3660) {
      setError('Duration must be between 1 and 3660 days.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await onActivate?.({
        plan_id: planId,
        duration_days: Math.floor(parsedDuration),
        notes: notes.trim(),
      });
      onOpenChange?.(false);
    } catch (activationError) {
      setError(activationError?.message || 'Plan activation failed.');
    } finally {
      setSaving(false);
    }
  };

  const surfaceClass = dark
    ? 'border-neutral-800 bg-neutral-950 text-neutral-100'
    : 'border-slate-200 bg-white text-slate-950';
  const inputClass = dark
    ? 'border-neutral-700 bg-neutral-900 text-neutral-100 placeholder:text-neutral-500'
    : 'border-slate-200 bg-white';

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !saving && onOpenChange?.(nextOpen)}>
      <DialogContent className={`w-[94vw] max-w-xl ${surfaceClass}`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
            Activate vendor plan
          </DialogTitle>
          <DialogDescription className={dark ? 'text-neutral-400' : 'text-slate-500'}>
            Assign a plan to {vendorName(vendor)}. The previous active plan will be closed and lead
            limits will reset atomically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div
            className={`flex flex-wrap items-center justify-between gap-3 border px-3 py-3 ${
              dark ? 'border-neutral-800 bg-neutral-900' : 'border-slate-200 bg-slate-50'
            }`}
          >
            <div>
              <p className={`text-xs ${dark ? 'text-neutral-500' : 'text-slate-500'}`}>Current plan</p>
              <p className="mt-1 text-sm font-semibold">
                {existingPlan?.plan_name || existingPlan?.name || 'No active plan'}
              </p>
            </div>
            <Badge
              variant="outline"
              className={
                existingPlan
                  ? 'border-emerald-800 bg-emerald-950/40 text-emerald-300'
                  : dark
                    ? 'border-neutral-700 text-neutral-400'
                    : 'border-slate-300 text-slate-500'
              }
            >
              {existingPlan?.status || 'UNASSIGNED'}
            </Badge>
          </div>

          <div className="space-y-2">
            <Label htmlFor="superadmin-plan-select">New plan</Label>
            <Select value={planId} onValueChange={selectPlan}>
              <SelectTrigger id="superadmin-plan-select" className={inputClass}>
                <SelectValue placeholder="Select a plan" />
              </SelectTrigger>
              <SelectContent>
                {(plans || []).map((plan) => (
                  <SelectItem key={plan.id} value={String(plan.id)}>
                    {plan.name || 'Unnamed plan'} · {formatMoney(plan.price)}
                    {!isEnabledPlan(plan) ? ' · inactive catalog plan' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)]">
            <div className="space-y-2">
              <Label htmlFor="superadmin-plan-duration">Duration (days)</Label>
              <div className="relative">
                <CalendarClock className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-neutral-500" />
                <Input
                  id="superadmin-plan-duration"
                  type="number"
                  min="1"
                  max="3660"
                  step="1"
                  value={durationDays}
                  onChange={(event) => setDurationDays(event.target.value)}
                  className={`pl-9 ${inputClass}`}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="superadmin-plan-note">Internal note</Label>
              <Textarea
                id="superadmin-plan-note"
                value={notes}
                maxLength={2000}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Reason, approval reference, or customer context..."
                className={`min-h-20 ${inputClass}`}
              />
            </div>
          </div>

          {selectedPlan && !isEnabledPlan(selectedPlan) ? (
            <div className="flex gap-2 border border-amber-800 bg-amber-950/40 px-3 py-2 text-xs text-amber-200">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              This plan is hidden from the public catalog. Superadmin activation is still allowed
              and will be recorded in the audit log.
            </div>
          ) : null}

          <div className={`flex gap-2 text-xs ${dark ? 'text-neutral-400' : 'text-slate-500'}`}>
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            Manual activation does not create a payment record. Use this only after an approved
            complimentary, offline, or support-led assignment.
          </div>

          {error ? (
            <p className="border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">{error}</p>
          ) : null}
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => onOpenChange?.(false)}
            className={dark ? 'border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800' : ''}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={saving || !planId}
            onClick={submit}
            className="bg-emerald-700 text-white hover:bg-emerald-600"
          >
            {saving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
            {saving ? 'Activating...' : 'Activate plan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SuperAdminPlanActivationDialog;
