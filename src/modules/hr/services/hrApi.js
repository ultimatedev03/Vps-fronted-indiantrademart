import { fetchWithCsrf } from '@/lib/fetchWithCsrf';
import { apiUrl } from '@/lib/apiBase';

const safeReadJson = async (response) => {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return await response.json();
  }

  const text = await response.text();
  throw new Error(text || `Request failed with status ${response.status}`);
};

export const hrApi = {
  getEmployees: async () => {
    const response = await fetchWithCsrf(apiUrl('/api/employee/staff'));
    const payload = await safeReadJson(response);
    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.error || 'Failed to fetch employees');
    }
    return Array.isArray(payload?.employees) ? payload.employees : [];
  },

  createEmployee: async (employeeData) => {
    const response = await fetchWithCsrf(apiUrl('/api/employee/staff'), {
      method: 'POST',
      body: JSON.stringify(employeeData),
    });
    const payload = await safeReadJson(response);
    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.error || 'Failed to create employee');
    }
    return payload;
  },

  updateEmployee: async (employeeId, employeeData) => {
    const response = await fetchWithCsrf(apiUrl(`/api/employee/staff/${employeeId}`), {
      method: 'PATCH',
      body: JSON.stringify(employeeData),
    });
    const payload = await safeReadJson(response);
    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.error || 'Failed to update employee');
    }
    return payload?.employee || payload;
  },

  updateEmployeeStatus: async (employeeId, status) => {
    return hrApi.updateEmployee(employeeId, { status });
  },

  getStats: async () => {
    const employees = await hrApi.getEmployees();
    const totalEmployees = employees.length;
    const onLeave = employees.filter((emp) =>
      String(emp?.status || '').toUpperCase().includes('LEAVE')
    ).length;
    const inactive = employees.filter((emp) => {
      const s = String(emp?.status || 'ACTIVE').toUpperCase();
      return s === 'INACTIVE' || s === 'SUSPENDED' || s === 'TERMINATED';
    }).length;
    const active = Math.max(totalEmployees - onLeave - inactive, 0);

    return {
      totalEmployees,
      active,
      onLeave,
    };
  },
};
