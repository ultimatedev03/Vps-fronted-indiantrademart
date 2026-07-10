import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const GTAG_ID = String(import.meta.env.VITE_GTAG_ID || 'G-POC7N2ZTP5').trim();

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
    });
  }, [location.pathname, location.search]);

  return null;
};

export default AnalyticsLoader;
