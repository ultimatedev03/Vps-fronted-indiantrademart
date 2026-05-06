import React, { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import { Plus, Search, Trash2, Loader2, KeyRound, Eye, EyeOff } from "lucide-react";
import { filterRecordsBySearch } from "@/modules/admin/lib/search";
import { Label } from "@/components/ui/label";
import { fetchWithCsrf } from "@/lib/fetchWithCsrf";
import { PASSWORD_POLICY_MESSAGE, validateStrongPassword } from "@/lib/passwordPolicy";

// ✅ Local vs Netlify API base (same pattern as Vendors.jsx)
const isLocalHost = () => {
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1";
};

const getAdminBase = () => {
  const override = import.meta.env.VITE_ADMIN_API_BASE;
  if (override && String(override).trim()) return String(override).trim();
  return isLocalHost() ? "/api/admin" : "/.netlify/functions/admin";
};

async function safeReadJson(res) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return await res.json();
  const text = await res.text();
  throw new Error(`API returned non-JSON (${res.status}). Got: ${text.slice(0, 120)}...`);
}

const buildApiError = (data, fallback) => {
  if (!data) return fallback;
  const err = data?.error || fallback;
  const details = data?.details ? String(data.details) : "";
  const variant = data?.variant ? ` (variant=${data.variant})` : "";
  return details ? `${err}: ${details}${variant}` : `${err}${variant}`;
};

const isActiveStatus = (status) => {
  const s = String(status || "").trim().toUpperCase();
  return s === "ACTIVE" || s === "ACTIVATED" || s === "ENABLED";
};

const normalizeRole = (value) => String(value || "").trim().toUpperCase();

const roleToDepartment = (role) => {
  switch (normalizeRole(role)) {
    case "ADMIN":
      return "Administration";
    case "HR":
      return "Human Resources";
    case "FINANCE":
      return "Finance";
    case "SUPPORT":
      return "Support";
    case "SALES":
      return "Sales";
    case "DATA_ENTRY":
    case "DATAENTRY":
      return "Operations";
    default:
      return "";
  }
};

const getDepartmentLabel = (employee) =>
  employee?.department || employee?.dept || roleToDepartment(employee?.role) || "-";

const Staff = () => {
  const ADMIN_API_BASE = getAdminBase();

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [pwDialogOpen, setPwDialogOpen] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwEmployee, setPwEmployee] = useState(null);
  const [pwForm, setPwForm] = useState({ password: "", confirm: "" });
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showPwPassword, setShowPwPassword] = useState(false);
  const [showPwConfirm, setShowPwConfirm] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState("");

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    role: "HR",
    department: "Human Resources",
    password: "",
  });

  const loadEmployees = async () => {
    setLoading(true);
    try {
      const res = await fetchWithCsrf(`${ADMIN_API_BASE}/staff`);
      const data = await safeReadJson(res);
      if (!data?.success) throw new Error(buildApiError(data, "Failed to fetch staff"));
      setEmployees(data.employees || []);
    } catch (error) {
      toast({
        title: "Failed to load staff",
        description: error?.message || "Something went wrong",
        variant: "destructive",
      });
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredEmployees = useMemo(() => {
    if (!searchTerm.trim()) return employees;
    return filterRecordsBySearch(employees, searchTerm, {
      exactIdKeys: ["id", "user_id"],
      exactEmailKeys: ["email"],
      broadKeys: ["id", "user_id", "full_name", "name", "email", "role", "department"],
    });
  }, [employees, searchTerm]);

  const handleCreate = async () => {
    if (!formData.email || !formData.password || !formData.full_name) {
      toast({ title: "Please fill required fields", variant: "destructive" });
      return;
    }

    const passwordValidation = validateStrongPassword(formData.password);
    if (!passwordValidation.ok) {
      toast({
        title: "Invalid password",
        description: passwordValidation.error,
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetchWithCsrf(`${ADMIN_API_BASE}/staff`, {
        method: "POST",
        body: JSON.stringify({
          full_name: formData.full_name,
          email: formData.email,
          phone: formData.phone,
          role: formData.role,
          department: formData.department,
          password: formData.password,
        }),
      });

      const data = await safeReadJson(res);
      if (!data?.success) throw new Error(buildApiError(data, "Failed to create employee"));

      toast({
        title: "Employee created successfully",
        description: data?.variant ? `Saved using schema: ${data.variant}` : undefined,
      });

      setIsDialogOpen(false);
      setFormData({
        full_name: "",
        email: "",
        phone: "",
        role: "HR",
        department: "Human Resources",
        password: "",
      });
      setShowCreatePassword(false);
      await loadEmployees();
    } catch (error) {
      toast({
        title: "Error creating employee",
        description: error?.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this employee? This cannot be undone.")) return;
    try {
      const res = await fetchWithCsrf(`${ADMIN_API_BASE}/staff/${id}`, { method: "DELETE" });
      const data = await safeReadJson(res);
      if (!data?.success) throw new Error(buildApiError(data, "Delete failed"));
      setEmployees((prev) => (prev || []).filter((e) => e.id !== id));
      toast({ title: "Employee removed" });
    } catch (error) {
      toast({
        title: "Delete failed",
        description: error?.message || "Something went wrong",
        variant: "destructive",
      });
    }
  };

  const handleToggleStatus = async (employee) => {
    const employeeId = String(employee?.id || "").trim();
    if (!employeeId) return;

    const nextStatus = isActiveStatus(employee?.status) ? "INACTIVE" : "ACTIVE";
    setStatusUpdatingId(employeeId);

    try {
      const res = await fetchWithCsrf(`${ADMIN_API_BASE}/staff/${employeeId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await safeReadJson(res);
      if (!data?.success) throw new Error(buildApiError(data, "Failed to update employee status"));

      setEmployees((prev) =>
        (prev || []).map((entry) =>
          entry.id === employeeId ? { ...entry, ...(data.employee || {}), status: nextStatus } : entry
        )
      );
      toast({
        title: `Employee ${nextStatus === "ACTIVE" ? "activated" : "deactivated"}`,
        description: `${employee.full_name || employee.name || "Employee"} is now ${nextStatus}.`,
      });
    } catch (error) {
      toast({
        title: "Status update failed",
        description: error?.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setStatusUpdatingId("");
    }
  };

  const openChangePassword = (employee) => {
    setPwEmployee(employee);
    setPwForm({ password: "", confirm: "" });
    setShowPwPassword(false);
    setShowPwConfirm(false);
    setPwDialogOpen(true);
  };

  const handleChangePassword = async () => {
    if (!pwEmployee?.id) return;
    const passwordValidation = validateStrongPassword(pwForm.password);
    if (!passwordValidation.ok) {
      toast({
        title: "Invalid password",
        description: passwordValidation.error,
        variant: "destructive",
      });
      return;
    }
    if (pwForm.password !== pwForm.confirm) {
      toast({
        title: "Passwords do not match",
        description: "Please confirm the same password",
        variant: "destructive",
      });
      return;
    }

    setPwSaving(true);
    try {
      const res = await fetchWithCsrf(`${ADMIN_API_BASE}/staff/${pwEmployee.id}/password`, {
        method: "PUT",
        body: JSON.stringify({ password: pwForm.password }),
      });

      const data = await safeReadJson(res);
      if (!data?.success) throw new Error(buildApiError(data, "Failed to update password"));

      toast({
        title: "Password updated",
        description: `${pwEmployee.full_name || pwEmployee.name || "Employee"} can login with the new password now.`,
      });
      setPwDialogOpen(false);
    } catch (error) {
      toast({
        title: "Password update failed",
        description: error?.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Staff Management</h1>
          <p className="text-muted-foreground">Manage employees and their access roles.</p>
        </div>

        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setShowCreatePassword(false);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button className="bg-[#003D82]">
              <Plus className="mr-2 h-4 w-4" /> Add Employee
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Employee</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="john@company.com"
                />
              </div>

              <div className="space-y-2">
                <Label>Password</Label>
                <div className="relative">
                  <Input
                    type={showCreatePassword ? "text" : "password"}
                    id="staff-create-password"
                    name="staff-create-password"
                    autoComplete="new-password"
                    data-1p-ignore="true"
                    data-lpignore="true"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="********"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreatePassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-700"
                    aria-label={showCreatePassword ? "Hide password" : "Show password"}
                  >
                    {showCreatePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">{PASSWORD_POLICY_MESSAGE}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(v) =>
                      setFormData({
                        ...formData,
                        role: v,
                        department: roleToDepartment(v) || formData.department,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    {/* ADMIN can only create HR and FINANCE.
                        SUPERADMIN creates ADMIN. HR creates SALES/SUPPORT/DATA_ENTRY/MANAGER/VP. */}
                    <SelectContent>
                      <SelectItem value="HR">HR</SelectItem>
                      <SelectItem value="FINANCE">Finance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select value={formData.department} onValueChange={(v) => setFormData({ ...formData, department: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Operations">Operations</SelectItem>
                      <SelectItem value="Finance">Finance</SelectItem>
                      <SelectItem value="Sales">Sales</SelectItem>
                      <SelectItem value="Customer Success">Customer Success</SelectItem>
                      <SelectItem value="IT">IT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  setShowCreatePassword(false);
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create Account
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center space-x-2 bg-white p-4 rounded-lg border">
        <Search className="h-5 w-5 text-gray-400" />
        <Input
          id="staff-directory-search"
          type="search"
          name="staff-directory-search"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          inputMode="search"
          spellCheck={false}
          data-form-type="other"
          data-1p-ignore="true"
          data-lpignore="true"
          placeholder="Search by ID, name, email or role..."
          className="border-0 focus-visible:ring-0"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="border rounded-lg bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name / Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24">
                  Loading...
                </TableCell>
              </TableRow>
            ) : filteredEmployees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24 text-gray-500">
                  No employees found
                </TableCell>
              </TableRow>
            ) : (
              filteredEmployees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{employee.full_name || employee.name}</span>
                      <span className="text-xs text-muted-foreground">{employee.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      {employee.role}
                    </Badge>
                  </TableCell>
                  <TableCell>{getDepartmentLabel(employee)}</TableCell>
                  <TableCell>
                    <Badge variant={isActiveStatus(employee.status) ? "success" : "secondary"}>
                      {employee.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {employee.created_at
                      ? new Date(employee.created_at).toLocaleDateString()
                      : employee.joined || "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className={isActiveStatus(employee.status) ? "text-amber-700" : "text-emerald-700"}
                        title={isActiveStatus(employee.status) ? "Deactivate employee" : "Activate employee"}
                        onClick={() => handleToggleStatus(employee)}
                        disabled={statusUpdatingId === employee.id}
                      >
                        {statusUpdatingId === employee.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : isActiveStatus(employee.status) ? (
                          "Deactivate"
                        ) : (
                          "Activate"
                        )}
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-blue-700 hover:text-blue-800 hover:bg-blue-50"
                        title="Change Password"
                        onClick={() => openChangePassword(employee)}
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                        title="Delete Employee"
                        onClick={() => handleDelete(employee.id)}
                        disabled={statusUpdatingId === employee.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Change Password Dialog */}
      <Dialog
        open={pwDialogOpen}
        onOpenChange={(open) => {
          setPwDialogOpen(open);
          if (!open) {
            setShowPwPassword(false);
            setShowPwConfirm(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <input
              type="text"
              name="staff-password-username"
              autoComplete="username"
              value={pwEmployee?.email || ""}
              readOnly
              tabIndex={-1}
              aria-hidden="true"
              className="sr-only"
            />
            <div className="text-sm text-muted-foreground">
              Employee: <span className="font-semibold text-slate-900">{pwEmployee?.full_name || pwEmployee?.name || "-"}</span>
              {pwEmployee?.email ? <span className="ml-2">({pwEmployee.email})</span> : null}
            </div>

            <div className="space-y-2">
              <Label>New Password</Label>
              <div className="relative">
                <Input
                  type={showPwPassword ? "text" : "password"}
                  id="staff-new-password"
                  name="staff-new-password"
                  autoComplete="new-password"
                  data-1p-ignore="true"
                  data-lpignore="true"
                  value={pwForm.password}
                  onChange={(e) => setPwForm((p) => ({ ...p, password: e.target.value }))}
                  placeholder="********"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPwPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-700"
                  aria-label={showPwPassword ? "Hide password" : "Show password"}
                >
                  {showPwPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">{PASSWORD_POLICY_MESSAGE}</p>
            </div>

            <div className="space-y-2">
              <Label>Confirm Password</Label>
              <div className="relative">
                <Input
                  type={showPwConfirm ? "text" : "password"}
                  id="staff-confirm-password"
                  name="staff-confirm-password"
                  autoComplete="new-password"
                  data-1p-ignore="true"
                  data-lpignore="true"
                  value={pwForm.confirm}
                  onChange={(e) => setPwForm((p) => ({ ...p, confirm: e.target.value }))}
                  placeholder="********"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPwConfirm((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-700"
                  aria-label={showPwConfirm ? "Hide password" : "Show password"}
                >
                  {showPwConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPwDialogOpen(false);
                setShowPwPassword(false);
                setShowPwConfirm(false);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleChangePassword} disabled={pwSaving}>
              {pwSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Update Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Staff;
