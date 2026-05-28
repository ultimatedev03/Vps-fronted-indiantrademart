import { useState, useEffect } from 'react';
import { dbClient } from '@/lib/dbClient';
import { apiUrl } from '@/lib/apiBase';

const DEBUG = Boolean(import.meta?.env?.VITE_DEBUG_PAGE_STATUS === 'true');
const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

/**
 * Hook to check if a page is offline (blanked)
 * No caching - always fetches fresh from database
 */
export const usePageStatus = (pageRoute) => {
  const [isOffline, setIsOffline] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkPageStatus = async () => {
      try {
        if (isOffline()) {
          setIsOffline(false);
          setErrorMessage('');
          setIsLoading(false);
          return;
        }

        if (DEBUG) console.log('[PageStatus] Checking page status for:', pageRoute);

        const res = await fetch(apiUrl(`/api/public/page-status?route=${encodeURIComponent(pageRoute)}`), {
          method: 'GET',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });
        const payload = await res.json().catch(() => null);

        if (!res.ok || payload?.success === false) {
          if (DEBUG) console.warn('[PageStatus] Query error:', payload || res.status);
          setIsOffline(false);
          setErrorMessage('');
          setIsLoading(false);
          return;
        }

        const data = Array.isArray(payload?.statuses) ? payload.statuses[0] : null;
        if (data) {
          if (DEBUG) console.log('[PageStatus] Found page status:', {
            route: pageRoute, 
            is_blanked: data.is_blanked, 
            error_message: data.error_message 
          });
          setIsOffline(data.is_blanked === true);
          setErrorMessage(data.error_message || '');
        } else {
          if (DEBUG) console.log('[PageStatus] No status record found for route:', pageRoute, '- page is ONLINE');
          setIsOffline(false);
          setErrorMessage('');
        }

        setIsLoading(false);
      } catch (err) {
        if (DEBUG) console.warn('[PageStatus] Unexpected error:', err);
        setIsOffline(false);
        setIsLoading(false);
      }
    };

    checkPageStatus();

    // Subscribe to realtime changes
    const subscription = dbClient
      .channel('page_status_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'page_status',
          filter: `page_route=eq.${pageRoute}`
        },
        (payload) => {
          if (DEBUG) console.log('[PageStatus] Realtime update received:', payload);
          if (payload.new) {
            const isBlanked = payload.new.is_blanked === true;
            if (DEBUG) console.log('[PageStatus] Realtime update - setting offline to:', isBlanked);
            setIsOffline(isBlanked);
            setErrorMessage(payload.new.error_message || '');
          }
        }
      )
      .subscribe();

    // Poll for updates every 5 seconds (faster response)
    const interval = setInterval(checkPageStatus, 5000);

    return () => {
      clearInterval(interval);
      subscription.unsubscribe();
    };
  }, [pageRoute]);

  return { isOffline, errorMessage, isLoading };
};
