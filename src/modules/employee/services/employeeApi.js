import { supabase } from '@/lib/customSupabaseClient';
import { fetchWithCsrf } from '@/lib/fetchWithCsrf';
import { apiUrl } from '@/lib/apiBase';

const INTERNAL_ROLES = new Set([
  'ADMIN',
  'HR',
  'FINANCE',
  'DATA_ENTRY',
  'DATAENTRY',
  'SUPPORT',
  'SALES',
  'MANAGER',
  'VP',
  'SUPERADMIN',
]);

const canonicalizeRole = (value) => {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return undefined;
  if (raw === 'DATAENTRY') return 'DATA_ENTRY';
  if (raw === 'FINACE') return 'FINANCE';
  return raw;
};

const isInternalRole = (role) => INTERNAL_ROLES.has(String(role || '').trim().toUpperCase());
const formatRoleLabel = (role) => String(canonicalizeRole(role) || role || 'Employee').replaceAll('_', ' ');
const getAuthHintedRole = (authUser) =>
  canonicalizeRole(authUser?.role || authUser?.user_metadata?.role || authUser?.app_metadata?.role);

const buildEmployeeUser = (authUser, empRow) => {
  const name = empRow?.full_name || empRow?.name || authUser?.user_metadata?.full_name || authUser?.email || 'Employee';
  const firstLetter = String(name || 'E').trim().charAt(0).toUpperCase() || 'E';
  return {
    // keep both for safety
    id: authUser?.id,
    user_id: authUser?.id,
    name,
    email: empRow?.email || authUser?.email,
    phone: empRow?.phone || null,
    role: canonicalizeRole(empRow?.role) || 'UNKNOWN',
    department: empRow?.department || null,
    status: empRow?.status || null,
    avatar_url: empRow?.avatar_url || authUser?.user_metadata?.avatar_url || null,
    avatar: firstLetter
  };
};

const fetchEmployeeRow = async (authUserId) => {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('user_id', authUserId)
    .maybeSingle();

  if (error) {
    // If RLS blocks, return null and let caller decide
    console.error('[employeeApi] employees fetch error:', error);
    return null;
  }
  return data || null;
};

const fetchEmployeeRowByEmail = async (email) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return null;

  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (error) {
    console.error('[employeeApi] employees email fetch error:', error);
    return null;
  }

  return data || null;
};

const resolveEmployeeViaApi = async () => {
  try {
    const res = await fetchWithCsrf(apiUrl('/api/employee/me'));
    if (!res.ok) return null;
    const data = await res.json();
    return data?.employee || null;
  } catch {
    return null;
  }
};

const matchesAuthIdentity = (employee, authUser) => {
  const employeeUserId = String(employee?.user_id || '').trim();
  const authUserId = String(authUser?.id || '').trim();
  const employeeEmail = String(employee?.email || '').trim().toLowerCase();
  const authEmail = String(authUser?.email || '').trim().toLowerCase();

  return (
    (employeeUserId && authUserId && employeeUserId === authUserId) ||
    (employeeEmail && authEmail && employeeEmail === authEmail)
  );
};

export const employeeApi = {
  auth: {
    /**
     * Auth via backend JWT + cookies.
     */
    login: async (email, password, captcha = {}, expectedRole = '') => {
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore stale session cleanup errors before fresh login
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
        ...(captcha?.captcha_token ? { captcha_token: captcha.captcha_token } : {}),
        ...(captcha?.captcha_action ? { captcha_action: captcha.captcha_action } : {}),
      });

      if (error) throw new Error(error.message);
      if (!data?.user) throw new Error('Login failed: user not returned');

      const normalizedExpectedRole = canonicalizeRole(expectedRole);
      const hintedRole = getAuthHintedRole(data.user);

      if (normalizedExpectedRole && hintedRole && hintedRole !== normalizedExpectedRole) {
        await supabase.auth.signOut();
        throw new Error(
          `${formatRoleLabel(hintedRole)} accounts must use the ${formatRoleLabel(normalizedExpectedRole)} Login.`
        );
      }

      let empRow = await fetchEmployeeRow(data.user.id);
      if (!empRow) {
        empRow = await fetchEmployeeRowByEmail(data.user.email);
      }
      if (!empRow) {
        const resolvedEmployee = await resolveEmployeeViaApi();
        if (matchesAuthIdentity(resolvedEmployee, data.user)) {
          empRow = resolvedEmployee;
        }
      }

      if (!empRow) {
        await supabase.auth.signOut();
        // If you want to allow auth-only login, you can remove this throw.
        throw new Error('No employee profile found. Please ask admin to create your employee account.');
      }

      const resolvedRole = canonicalizeRole(empRow?.role) || hintedRole || 'UNKNOWN';
      const user = buildEmployeeUser(data.user, { ...empRow, role: resolvedRole });

      if (normalizedExpectedRole && resolvedRole !== normalizedExpectedRole) {
        await supabase.auth.signOut();
        throw new Error(
          `${formatRoleLabel(resolvedRole)} accounts must use the ${formatRoleLabel(normalizedExpectedRole)} Login.`
        );
      }

      return { user };
    },

    logout: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw new Error(error.message);
      return true;
    },

    /**
     * Restore session and return employee profile (if available).
     */
    getCurrentUser: async () => {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error('[employeeApi] getSession error:', sessionError);
        return null;
      }

      const authUser = sessionData?.session?.user;
      if (!authUser?.id) return null;

      const hintedRole = canonicalizeRole(
        authUser?.role ||
        authUser?.user_metadata?.role ||
        authUser?.app_metadata?.role
      );

      if (hintedRole && !isInternalRole(hintedRole)) {
        return null;
      }

      const empRow = (await resolveEmployeeViaApi()) || (await fetchEmployeeRow(authUser.id));
      if (!empRow) return null;

      return buildEmployeeUser(authUser, empRow);
    }
  },

  // Placeholder for other employee functions
  profile: {
    get: () => Promise.resolve({}),
    update: (data) => Promise.resolve(data)
  }
};
