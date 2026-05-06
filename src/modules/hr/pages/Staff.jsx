import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Modal from '@/shared/components/Modal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CalendarClock, Eye, EyeOff, Loader2, Plus, UserCheck, UserCog, UserMinus } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { hrApi } from '@/modules/hr/services/hrApi';
import { PASSWORD_POLICY_MESSAGE } from '@/lib/passwordPolicy';

const ROLE_OPTIONS = [
  { value: 'DATA_ENTRY', label: 'Data Entry', department: 'Operations' },
  { value: 'SUPPORT', label: 'Support', department: 'Support' },
  { value: 'SALES', label: 'Sales', department: 'Sales' },
  { value: 'MANAGER', label: 'Manager', department: 'Territory' },
  { value: 'VP', label: 'VP', department: 'Leadership' },
];
const DEPARTMENT_OPTIONS = Array.from(new Set(ROLE_OPTIONS.map((option) => option.department)));

const DEFAULT_FORM = {
  full_name: '',
  email: '',
  phone: '',
  role: 'DATA_ENTRY',
  department: 'Operations',
  password: '',
};

const normalizeRole = (value = '') => String(value || '').trim().toUpperCase();
const isActiveStatus = (value = '') => String(value || 'ACTIVE').trim().toUpperCase() === 'ACTIVE';
const isOnLeaveStatus = (value = '') => String(value || '').trim().toUpperCase().includes('LEAVE');
const defaultDepartmentForRole = (role) =>
  ROLE_OPTIONS.find((option) => option.value === normalizeRole(role))?.department || 'Operations';

const normalizeEmployee = (employee = {}) => {
  const joinedDate = employee?.created_at || employee?.joined || employee?.createdAt || null;
  const joined = joinedDate ? new Date(joinedDate) : null;
  const status = String(employee?.status || 'ACTIVE').trim().toUpperCase();

  return {
    ...employee,
    displayName: employee?.full_name || employee?.name || employee?.employee_name || 'Unnamed Employee',
    displayRole: employee?.role || employee?.designation || '-',
    displayEmail: employee?.email || '-',
    status,
    joinedLabel: joined && !Number.isNaN(joined.getTime()) ? joined.toLocaleDateString('en-GB') : '-',
  };
};

const HrStaff = () => {
  const [staff, setStaff] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(DEFAULT_FORM);
  const [busyEmployeeId, setBusyEmployeeId] = useState('');
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [roleForm, setRoleForm] = useState({ role: 'DATA_ENTRY', department: 'Operations' });
  const [showCreatePassword, setShowCreatePassword] = useState(false);

  const fetchStaff = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const employees = await hrApi.getEmployees();
      setStaff((employees || []).map(normalizeEmployee));
    } catch (error) {
      console.error('Failed to fetch staff:', error);
      toast({
        title: 'Failed to load staff',
        description: error?.message || 'Could not load employee directory.',
        variant: 'destructive',
      });
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStaff();

    const channel = supabase
      .channel('hr-staff-directory')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, () => {
        void fetchStaff({ silent: true });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchStaff]);

  const resetForm = () => {
    setFormData(DEFAULT_FORM);
    setShowCreatePassword(false);
  };

  const handleChange = (field, value) => {
    if (field === 'role') {
      const selected = ROLE_OPTIONS.find((option) => option.value === value);
      setFormData((prev) => ({
        ...prev,
        role: value,
        department: selected?.department || prev.department,
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [field]: field === 'phone' ? String(value || '').replace(/\D/g, '').slice(0, 10) : value,
    }));
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await hrApi.createEmployee({
        ...formData,
        full_name: String(formData.full_name || '').trim(),
        email: String(formData.email || '').trim(),
        department: String(formData.department || '').trim(),
      });

      await fetchStaff({ silent: true });
      setIsModalOpen(false);
      resetForm();

      toast({
        title: result?.reused_existing ? 'Employee updated' : 'Employee created',
        description: result?.reused_existing
          ? 'Existing employee profile was relinked and updated successfully.'
          : 'New employee has been onboarded successfully.',
      });
    } catch (error) {
      toast({
        title: 'Employee creation failed',
        description: error?.message || 'Could not create employee.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const openRoleModal = (employee) => {
    setSelectedEmployee(employee);
    setRoleForm({
      role: normalizeRole(employee?.role || 'DATA_ENTRY') || 'DATA_ENTRY',
      department: employee?.department || defaultDepartmentForRole(employee?.role || 'DATA_ENTRY'),
    });
    setIsRoleModalOpen(true);
  };

  const handleUpdateRole = async (event) => {
    event.preventDefault();
    if (!selectedEmployee?.id) return;

    setBusyEmployeeId(selectedEmployee.id);
    try {
      await hrApi.updateEmployee(selectedEmployee.id, {
        role: roleForm.role,
        department: roleForm.department,
      });
      await fetchStaff({ silent: true });
      setIsRoleModalOpen(false);
      setSelectedEmployee(null);
      toast({
        title: 'Employee updated',
        description: 'Role and department updated successfully.',
      });
    } catch (error) {
      toast({
        title: 'Update failed',
        description: error?.message || 'Could not update employee role.',
        variant: 'destructive',
      });
    } finally {
      setBusyEmployeeId('');
    }
  };

  const handleToggleStatus = async (employee) => {
    if (!employee?.id) return;

    const currentlyActive = isActiveStatus(employee.status);
    const nextStatus = currentlyActive ? 'INACTIVE' : 'ACTIVE';
    const confirmed = window.confirm(
      currentlyActive
        ? `Deactivate ${employee.displayName}?`
        : `Reactivate ${employee.displayName}?`
    );

    if (!confirmed) return;

    setBusyEmployeeId(employee.id);
    try {
      await hrApi.updateEmployeeStatus(employee.id, nextStatus);
      await fetchStaff({ silent: true });
      toast({
        title: currentlyActive ? 'Employee deactivated' : 'Employee reactivated',
        description: `${employee.displayName} is now ${nextStatus}.`,
      });
    } catch (error) {
      toast({
        title: 'Status update failed',
        description: error?.message || 'Could not update employee status.',
        variant: 'destructive',
      });
    } finally {
      setBusyEmployeeId('');
    }
  };

  const handleToggleLeave = async (employee) => {
    if (!employee?.id) return;

    const onLeave = isOnLeaveStatus(employee.status);
    const nextStatus = onLeave ? 'ACTIVE' : 'ON_LEAVE';
    const confirmed = window.confirm(
      onLeave
        ? `Mark ${employee.displayName} as Active (return from leave)?`
        : `Mark ${employee.displayName} as On Leave?`
    );

    if (!confirmed) return;

    setBusyEmployeeId(employee.id);
    try {
      await hrApi.updateEmployeeStatus(employee.id, nextStatus);
      await fetchStaff({ silent: true });
      toast({
        title: onLeave ? 'Returned from leave' : 'Marked as On Leave',
        description: `${employee.displayName} is now ${nextStatus === 'ON_LEAVE' ? 'on leave' : 'active'}.`,
      });
    } catch (error) {
      toast({
        title: 'Status update failed',
        description: error?.message || 'Could not update leave status.',
        variant: 'destructive',
      });
    } finally {
      setBusyEmployeeId('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-neutral-800">Employee Directory</h2>
        <Button onClick={() => setIsModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="h-4 w-4 mr-2" /> Add Employee
        </Button>
      </div>

      <div className="bg-white rounded-lg border border-neutral-200 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Join Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-neutral-500">
                  <div className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading employee directory...
                  </div>
                </TableCell>
              </TableRow>
            ) : staff.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-neutral-500">
                  No employees found in the directory.
                </TableCell>
              </TableRow>
            ) : (
              staff.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell className="font-medium">{employee.displayName}</TableCell>
                  <TableCell>{employee.displayRole}</TableCell>
                  <TableCell>{employee.displayEmail}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        employee.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-800'
                          : isOnLeaveStatus(employee.status)
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-neutral-100 text-neutral-800'
                      }`}
                    >
                      {isOnLeaveStatus(employee.status) ? 'ON LEAVE' : employee.status}
                    </span>
                  </TableCell>
                  <TableCell>{employee.joinedLabel}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Manage Role"
                        onClick={() => openRoleModal(employee)}
                        disabled={busyEmployeeId === employee.id}
                      >
                        <UserCog className="h-4 w-4 text-blue-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title={isOnLeaveStatus(employee.status) ? 'Return from Leave' : 'Mark On Leave'}
                        onClick={() => handleToggleLeave(employee)}
                        disabled={busyEmployeeId === employee.id}
                      >
                        <CalendarClock className={`h-4 w-4 ${isOnLeaveStatus(employee.status) ? 'text-amber-600' : 'text-slate-400'}`} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title={isActiveStatus(employee.status) ? 'Deactivate' : 'Reactivate'}
                        onClick={() => handleToggleStatus(employee)}
                        disabled={busyEmployeeId === employee.id}
                      >
                        {busyEmployeeId === employee.id ? (
                          <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                        ) : isActiveStatus(employee.status) ? (
                          <UserMinus className="h-4 w-4 text-red-500" />
                        ) : (
                          <UserCheck className="h-4 w-4 text-emerald-600" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          resetForm();
        }}
        title="Onboard New Employee"
      >
        <form className="space-y-4" onSubmit={handleCreate}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Full Name</Label>
              <Input
                className="mt-1"
                placeholder="Jane Doe"
                required
                value={formData.full_name}
                onChange={(event) => handleChange('full_name', event.target.value)}
              />
            </div>
            <div>
              <Label>Email Address</Label>
              <Input
                type="email"
                className="mt-1"
                placeholder="jane@company.com"
                required
                value={formData.email}
                onChange={(event) => handleChange('email', event.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Phone Number</Label>
              <Input
                className="mt-1"
                placeholder="9876543210"
                value={formData.phone}
                onChange={(event) => handleChange('phone', event.target.value)}
              />
            </div>
            <div>
              <Label>Role</Label>
              <select
                className="flex h-10 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 disabled:cursor-not-allowed disabled:opacity-50 mt-1"
                value={formData.role}
                onChange={(event) => handleChange('role', event.target.value)}
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <Label>Department</Label>
            <select
              className="mt-1 flex h-10 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 disabled:cursor-not-allowed disabled:opacity-50"
              value={formData.department}
              onChange={(event) => handleChange('department', event.target.value)}
            >
              {DEPARTMENT_OPTIONS.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Password</Label>
            <div className="relative mt-1">
              <Input
                type={showCreatePassword ? 'text' : 'password'}
                className="pr-10"
                placeholder="Strong password"
                required
                autoComplete="new-password"
                value={formData.password}
                onChange={(event) => handleChange('password', event.target.value)}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex items-center px-3 text-neutral-500 hover:text-neutral-700"
                onClick={() => setShowCreatePassword((prev) => !prev)}
                aria-label={showCreatePassword ? 'Hide password' : 'Show password'}
              >
                {showCreatePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-2 text-xs text-neutral-500">{PASSWORD_POLICY_MESSAGE}</p>
          </div>
          <div className="flex justify-end pt-4">
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={saving}>
              {saving ? 'Saving...' : 'Add Employee'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isRoleModalOpen}
        onClose={() => {
          setIsRoleModalOpen(false);
          setSelectedEmployee(null);
        }}
        title={`Manage Access${selectedEmployee?.displayName ? `: ${selectedEmployee.displayName}` : ''}`}
      >
        <form className="space-y-4" onSubmit={handleUpdateRole}>
          <div>
            <Label>Role</Label>
            <select
              className="mt-1 flex h-10 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 disabled:cursor-not-allowed disabled:opacity-50"
              value={roleForm.role}
              onChange={(event) => {
                const nextRole = event.target.value;
                const selected = ROLE_OPTIONS.find((option) => option.value === nextRole);
                setRoleForm((prev) => ({
                  ...prev,
                  role: nextRole,
                  department: selected?.department || prev.department,
                }));
              }}
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label>Department</Label>
            <select
              className="mt-1 flex h-10 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 disabled:cursor-not-allowed disabled:opacity-50"
              value={roleForm.department}
              onChange={(event) =>
                setRoleForm((prev) => ({ ...prev, department: event.target.value }))
              }
            >
              {DEPARTMENT_OPTIONS.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsRoleModalOpen(false);
                setSelectedEmployee(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!selectedEmployee?.id || busyEmployeeId === selectedEmployee?.id}>
              {busyEmployeeId === selectedEmployee?.id ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default HrStaff;
