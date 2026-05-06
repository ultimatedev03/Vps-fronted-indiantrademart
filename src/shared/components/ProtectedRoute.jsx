import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useInternalAuth } from '@/modules/admin/context/InternalAuthContext';
import { useAuth as useVendorAuth } from '@/modules/vendor/context/AuthContext';

// ✅ Generic route-guard for Buyer/Vendor/Admin/Employee
// Fix: Buyer dashboard refresh redirecting to Vendor login.
const ProtectedRoute = ({ allowedRoles = [], redirectTo, children }) => {
  const location = useLocation();
  const supa = useAuth();
  const internal = useInternalAuth();
  const vendor = useVendorAuth();

  const normalizeRole = (value) => {
    const raw = String(value || '').trim().toUpperCase();
    if (!raw) return '';
    if (raw === 'DATAENTRY') return 'DATA_ENTRY';
    if (raw === 'FINACE') return 'FINANCE';
    return raw;
  };

  // ✅ Admin/HR portal uses InternalAuthContext (JWT cookie + RPC)
  const wantsInternal =
    (location.pathname || '').startsWith('/admin') ||
    (location.pathname || '').startsWith('/hr') ||
    (location.pathname || '').startsWith('/finance-portal') ||
    allowedRoles.some(r => ['ADMIN', 'HR', 'FINANCE'].includes(normalizeRole(r)));
  const wantsVendor =
    !wantsInternal &&
    (
      (location.pathname || '').startsWith('/vendor') ||
      allowedRoles.some((r) => normalizeRole(r) === 'VENDOR')
    );

  const loading = wantsInternal
    ? (internal?.isLoading ?? false)
    : wantsVendor
      ? (vendor?.loading ?? false)
      : (supa?.loading ?? false);
  const internalUser = internal?.user;
  const supaUser = supa?.user;
  const vendorUser = vendor?.user;
  const fallbackRole = supa?.userRole || supaUser?.role;
  const user = wantsInternal ? internalUser : (wantsVendor ? vendorUser : supaUser);
  const role = wantsInternal
    ? internalUser?.role
    : (wantsVendor ? (vendorUser?.role || (vendorUser ? 'VENDOR' : '')) : fallbackRole);
  const isAuthenticated = wantsInternal
    ? !!internal?.isAuthenticated
    : (wantsVendor ? !!vendor?.isAuthenticated : !!supaUser);
  const normalizedRole = normalizeRole(role);
  const allowedSet = new Set((allowedRoles || []).map((r) => normalizeRole(r)));

  const internalHome = (r) => {
    switch (r) {
      case 'ADMIN':
        return '/admin/dashboard';
      case 'FINANCE':
        return '/finance-portal/dashboard';
      case 'HR':
        return '/hr/dashboard';
      case 'DATA_ENTRY':
      case 'DATAENTRY':
        return '/employee/dataentry/dashboard';
      case 'SUPPORT':
        return '/employee/support/dashboard';
      case 'SALES':
        return '/employee/sales/dashboard';
      default:
        return null;
    }
  };

  const getDefaultRedirect = () => {
    const host =
      (typeof window !== 'undefined' && window.location?.hostname)
        ? window.location.hostname
        : '';
    const isBuyerSubdomain = host.startsWith('buyer.');
    const isVendorSubdomain = host.startsWith('vendor.');

    // 1) If caller explicitly passed redirectTo, use it
    if (redirectTo) return redirectTo;

    // 2) Infer from current URL prefix
    const p = location.pathname || '';
    if (p.startsWith('/buyer')) return '/buyer/login';
    if (p.startsWith('/vendor')) return '/vendor/login';
    if (p.startsWith('/finance-portal')) return '/finance-portal/login';
    if (p.startsWith('/hr')) return '/hr/login';
    if (p.startsWith('/employee')) return '/employee/login';
    if (p.startsWith('/admin')) return '/admin/login';

    // 3) Infer from allowedRoles (subdomain-safe)
    if (allowedRoles.includes('BUYER')) return isBuyerSubdomain ? '/login' : '/buyer/login';
    if (allowedRoles.includes('VENDOR')) return isVendorSubdomain ? '/login' : '/vendor/login';
    if (allowedRoles.includes('FINANCE')) return '/finance-portal/login';
    if (allowedRoles.includes('HR')) return '/hr/login';
    if (allowedRoles.some((role) => ['DATA_ENTRY', 'DATAENTRY', 'SUPPORT', 'SALES', 'MANAGER', 'VP'].includes(normalizeRole(role)))) {
      return '/employee/login';
    }

    // Default fallback
    return '/buyer/login';
  };

  if (loading) {
    return null;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to={getDefaultRedirect()} state={{ from: location }} replace />;
  }

  if (allowedRoles.length > 0) {
    const hasRole = normalizedRole ? allowedSet.has(normalizedRole) : false;
    if (!hasRole) {
      const buyerVendorMismatch =
        (allowedSet.has('BUYER') && normalizedRole === 'VENDOR') ||
        (allowedSet.has('VENDOR') && normalizedRole === 'BUYER');

      if (buyerVendorMismatch) {
        return <Navigate to={getDefaultRedirect()} state={{ from: location }} replace />;
      }

      if (wantsInternal) {
        return <Navigate to={getDefaultRedirect()} state={{ from: location }} replace />;
      }

      const fallback = internalHome(normalizedRole);
      if (fallback && location.pathname !== fallback) {
        return <Navigate to={fallback} replace />;
      }
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return children ? children : <Outlet />;
};

export default ProtectedRoute;
