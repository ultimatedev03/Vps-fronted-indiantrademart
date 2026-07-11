import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const GTAG_ID = String(import.meta.env.VITE_GTAG_ID || 'G-P0C7N2ZTP5').trim();

const inferPageRole = (pathname = '') => {
  const path = String(pathname || '').toLowerCase();
  if (path === '/buyer' || path.startsWith('/buyer/')) return 'buyer';
  if (path === '/vendor' || path.startsWith('/vendor/')) return 'vendor';
  if (path.startsWith('/admin/') || path.startsWith('/superadmin/')) return 'admin';
  if (path.startsWith('/employee/') || path.startsWith('/hr/') || path.startsWith('/finance-portal/')) {
    return 'staff';
  }
  return 'public';
};

const AnalyticsLoader = () => {
  const location = useLocation();

  useEffect(() => {
    if (!import.meta.env.PROD) return;
    if (typeof window.gtag !== 'function') return;

    window.gtag('event', 'page_view', {
      send_to: GTAG_ID,
      page_location: window.location.href,
      page_path: `${location.pathname}${location.search}`,
      page_title: document.title,
      itm_user_role: inferPageRole(location.pathname),
    });
  }, [location.pathname, location.search]);

  return null;
};

export default AnalyticsLoader;
