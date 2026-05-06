import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CalendarClock, Loader2, UserCheck, UserMinus } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { hrApi } from '@/modules/hr/services/hrApi';

const normalizeStatus = (v = '') => String(v || 'ACTIVE').trim().toUpperCase();
const isOnLeave = (emp) => normalizeStatus(emp?.status).includes('LEAVE');
const isInactive = (emp) => {
  const s = normalizeStatus(emp?.status);
  return s === 'INACTIVE' || s === 'SUSPENDED' || s === 'TERMINATED';
};

const statusBadge = (emp) => {
  if (isOnLeave(emp)) return { label: 'ON LEAVE', cls: 'bg-amber-100 text-amber-800' };
  if (isInactive(emp)) return { label: normalizeStatus(emp?.status), cls: 'bg-neutral-100 text-neutral-600' };
  return { label: 'ACTIVE', cls: 'bg-green-100 text-green-800' };
};

const pickName = (emp) => emp?.full_name || emp?.name || emp?.email || 'Employee';
const pickDept = (emp) => emp?.department || emp?.dept || 'Unassigned';
const pickRole = (emp) => emp?.role || '-';

const HrLeave = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'on_leave' | 'active'

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const list = await hrApi.getEmployees();
      setEmployees(list || []);
    } catch (err) {
      toast({ title: 'Failed to load employees', description: err?.message, variant: 'destructive' });
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSetLeave = async (emp) => {
    if (!emp?.id) return;
    const leaving = !isOnLeave(emp);
    const nextStatus = leaving ? 'ON_LEAVE' : 'ACTIVE';
    setBusyId(emp.id);
    try {
      await hrApi.updateEmployeeStatus(emp.id, nextStatus);
      await load({ silent: true });
      toast({
        title: leaving ? 'Marked as On Leave' : 'Returned from Leave',
        description: `${pickName(emp)} is now ${leaving ? 'on leave' : 'active'}.`,
      });
    } catch (err) {
      toast({ title: 'Update failed', description: err?.message, variant: 'destructive' });
    } finally {
      setBusyId('');
    }
  };

  const handleDeactivate = async (emp) => {
    if (!emp?.id) return;
    const nextStatus = isInactive(emp) ? 'ACTIVE' : 'INACTIVE';
    if (!window.confirm(`${isInactive(emp) ? 'Reactivate' : 'Deactivate'} ${pickName(emp)}?`)) return;
    setBusyId(emp.id);
    try {
      await hrApi.updateEmployeeStatus(emp.id, nextStatus);
      await load({ silent: true });
      toast({ title: isInactive(emp) ? 'Reactivated' : 'Deactivated', description: `${pickName(emp)} updated.` });
    } catch (err) {
      toast({ title: 'Update failed', description: err?.message, variant: 'destructive' });
    } finally {
      setBusyId('');
    }
  };

  const filtered = useMemo(() => {
    let list = employees;
    if (filter === 'on_leave') list = list.filter(isOnLeave);
    else if (filter === 'active') list = list.filter((e) => !isOnLeave(e) && !isInactive(e));
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((e) => pickName(e).toLowerCase().includes(q) || pickDept(e).toLowerCase().includes(q) || pickRole(e).toLowerCase().includes(q));
    return list;
  }, [employees, filter, search]);

  const summary = useMemo(() => ({
    total: employees.length,
    onLeave: employees.filter(isOnLeave).length,
    active: employees.filter((e) => !isOnLeave(e) && !isInactive(e)).length,
    inactive: employees.filter(isInactive).length,
  }), [employees]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-neutral-800">Leave Management</h2>
          <p className="text-sm text-neutral-500 mt-0.5">Track and update employee leave status across the team.</p>
        </div>
        <Button variant="outline" onClick={() => load()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Staff', value: summary.total, cls: 'bg-slate-50 border-slate-200' },
          { label: 'Active', value: summary.active, cls: 'bg-green-50 border-green-200 text-green-800' },
          { label: 'On Leave', value: summary.onLeave, cls: 'bg-amber-50 border-amber-200 text-amber-800' },
          { label: 'Inactive', value: summary.inactive, cls: 'bg-neutral-100 border-neutral-200 text-neutral-600' },
        ].map(({ label, value, cls }) => (
          <div key={label} className={`rounded-lg border p-4 ${cls}`}>
            <p className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</p>
            <p className="text-2xl font-bold mt-1">{loading ? '—' : value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Search by name, role, department..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <div className="flex gap-2">
          {[
            { key: 'all', label: 'All' },
            { key: 'active', label: 'Active' },
            { key: 'on_leave', label: 'On Leave' },
          ].map(({ key, label }) => (
            <Button
              key={key}
              size="sm"
              variant={filter === key ? 'default' : 'outline'}
              onClick={() => setFilter(key)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-neutral-200 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-neutral-500">
                  <div className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading employees...
                  </div>
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-neutral-500">
                  No employees match the current filter.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((emp) => {
                const badge = statusBadge(emp);
                const busy = busyId === emp.id;
                return (
                  <TableRow key={emp.id}>
                    <TableCell className="font-medium">{pickName(emp)}</TableCell>
                    <TableCell>{pickRole(emp)}</TableCell>
                    <TableCell>{pickDept(emp)}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy || isInactive(emp)}
                          onClick={() => handleSetLeave(emp)}
                          title={isOnLeave(emp) ? 'Return from leave' : 'Mark as on leave'}
                        >
                          {busy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CalendarClock className={`h-4 w-4 mr-1 ${isOnLeave(emp) ? 'text-amber-600' : 'text-slate-400'}`} />
                          )}
                          {isOnLeave(emp) ? 'Return' : 'On Leave'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => handleDeactivate(emp)}
                          title={isInactive(emp) ? 'Reactivate' : 'Deactivate'}
                        >
                          {isInactive(emp) ? (
                            <UserCheck className="h-4 w-4 mr-1 text-emerald-600" />
                          ) : (
                            <UserMinus className="h-4 w-4 mr-1 text-red-500" />
                          )}
                          {isInactive(emp) ? 'Reactivate' : 'Deactivate'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default HrLeave;
