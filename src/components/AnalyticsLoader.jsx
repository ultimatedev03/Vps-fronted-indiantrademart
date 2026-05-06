import { useEffect } from 'react';

const GTAG_ID = String(import.meta.env.VITE_GTAG_ID || '').trim();

const loadGtag = () => {
  if (!GTAG_ID) return;
  if (document.querySelector(`script[data-gtag="${GTAG_ID}"]`)) return;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GTAG_ID}`;
  script.dataset.gtag = GTAG_ID;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = window.gtag || gtag;
  window.gtag('js', new Date());
  window.gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    functionality_storage: 'denied',
    personalization_storage: 'denied',
    security_storage: 'granted',
  });
  window.gtag('config', GTAG_ID, {
    anonymize_ip: true,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    client_storage: 'none',
    send_page_view: false,
    transport_type: 'beacon',
  });
};

const scheduleLoad = () => {
  if (typeof window === 'undefined') return;

  const runWhenIdle = () => {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(loadGtag, { timeout: 4000 });
      return;
    }
    window.setTimeout(loadGtag, 3000);
  };

  if (document.readyState === 'complete') {
    runWhenIdle();
    return;
  }

  const onLoad = () => {
    window.removeEventListener('load', onLoad);
    runWhenIdle();
  };

  window.addEventListener('load', onLoad, { once: true });
};

const AnalyticsLoader = () => {
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    scheduleLoad();
  }, []);

  return null;
};

export default AnalyticsLoader;
