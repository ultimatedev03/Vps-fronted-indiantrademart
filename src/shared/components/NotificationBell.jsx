
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Bell, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/lib/customSupabaseClient';
import { fetchWithCsrf } from '@/lib/fetchWithCsrf';
import { apiUrl } from '@/lib/apiBase';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSubdomain } from '@/contexts/SubdomainContext';

const BUYER_NOTIF_PREFIX = 'buyer_notif:';
const FALLBACK_POLL_INTERVAL_MS = 30000;
const APP_ROUTE_PREFIX = {
  vendor: '/vendor',
  buyer: '/buyer',
  admin: '/admin',
  management: '/admin',
};
const TYPE_SCOPE_HINTS = {
  KYC_APPROVAL_REQUESTED: '/admin',
  KYC_VENDOR_FOLLOWUP: '/employee/support',
  KYC_VENDOR_APPROVED: '/employee',
  KYC_VENDOR_REJECTED: '/employee',
  KYC_DOCUMENT_UPLOADED: '/admin',
  KYC_SUBMITTED: '/admin',
  VENDOR_STATUS_UPDATED: '/employee',
  BUYER_STATUS_UPDATED: '/employee/support',
  SUPPORT_TICKET_CREATED: '/employee/support',
  SUPPORT_TICKET_UPDATED: '/employee/support',
  SUPPORT_ALERT: '/employee/support',
  CATEGORY_REQUEST: '/employee/dataentry',
};
const toBuyerNotifId = (id) => `${BUYER_NOTIF_PREFIX}${id}`;
const isBuyerNotifId = (id) => String(id || '').startsWith(BUYER_NOTIF_PREFIX);
const fromBuyerNotifId = (id) => String(id || '').replace(BUYER_NOTIF_PREFIX, '');

const stripCurrentAppPrefix = (pathname = '', appType = 'main') => {
  const p = String(pathname || '');
  const prefix = APP_ROUTE_PREFIX[appType];
  if (!prefix) return p;
  if (p === prefix) return '/';
  if (p.startsWith(`${prefix}/`)) return p.slice(prefix.length) || '/';
  return p;
};

const resolveDashboardScope = (pathname = '', appType = 'main') => {
  const p = stripCurrentAppPrefix(pathname, appType);
  if (p.startsWith('/employee/dataentry')) return '/employee/dataentry';
  if (p.startsWith('/employee/support')) return '/employee/support';
  if (p.startsWith('/employee/sales')) return '/employee/sales';
  if (p.startsWith('/employee')) return '/employee';
  if (p.startsWith('/admin')) return '/admin';
  if (p.startsWith('/vendor')) return '/vendor';
  if (p.startsWith('/buyer')) return '/buyer';
  if (p.startsWith('/hr')) return '/hr';
  if (p.startsWith('/finance-portal')) return '/finance-portal';
  if (appType === 'admin' || appType === 'management') return '/admin';
  if (appType === 'vendor') return '/vendor';
  if (appType === 'buyer') return '/buyer';
  return '';
};

const notificationLinkPath = (notif) => {
  const raw = String(notif?.link || '').trim();
  if (!raw) return '';
  if (raw.startsWith('/')) return raw;
  try {
    const url = new URL(raw);
    return url.pathname || '';
  } catch {
    return '';
  }
};

const notificationLinkQuery = (notif) => {
  const raw = String(notif?.link || '').trim();
  if (!raw) return null;
  try {
    const url = raw.startsWith('/') ? new URL(raw, window.location.origin) : new URL(raw);
    return url.searchParams;
  } catch {
    return null;
  }
};

const resolveBuyerNotificationLink = (row = {}) => {
  const type = String(row?.type || '').trim().toUpperCase();
  const referenceId = String(row?.reference_id || '').trim();

  if (type === 'PROPOSAL_MESSAGE') {
    return referenceId ? `/buyer/messages?proposal=${referenceId}` : '/buyer/messages';
  }

  if (type === 'SUPPORT_MESSAGE' || type.startsWith('SUPPORT_')) {
    return '/buyer/tickets';
  }

  if (referenceId) {
    return `/buyer/proposals/${referenceId}`;
  }

  return '/buyer/proposals';
};

const mapBuyerNotificationRow = (row = {}) => ({
  ...row,
  id: toBuyerNotifId(row.id),
  link: resolveBuyerNotificationLink(row),
});

const resolveNotificationPathForCurrentApp = (notif = {}, appType = 'main') => {
  const linkPath = notificationLinkPath(notif);
  if (!linkPath) return '';

  if (appType === 'vendor' && (linkPath === '/vendor' || linkPath.startsWith('/vendor/'))) {
    return stripCurrentAppPrefix(linkPath, appType) || '/';
  }

  if (appType === 'buyer' && (linkPath === '/buyer' || linkPath.startsWith('/buyer/'))) {
    return stripCurrentAppPrefix(linkPath, appType) || '/';
  }

  if ((appType === 'admin' || appType === 'management') && (linkPath === '/admin' || linkPath.startsWith('/admin/'))) {
    return stripCurrentAppPrefix(linkPath, appType) || '/';
  }

  return linkPath;
};

const resolveNotificationTarget = (notif = {}, appType = 'main') => {
  const targetPath = resolveNotificationPathForCurrentApp(notif, appType);
  if (!targetPath) return '';
  const query = notificationLinkQuery(notif)?.toString();
  return query ? `${targetPath}?${query}` : targetPath;
};

const isChatNotification = (notif = {}) => {
  const type = String(notif?.type || '').trim().toUpperCase();
  if (type === 'PROPOSAL_MESSAGE') return true;
  const linkPath = notificationLinkPath(notif);
  return linkPath.includes('/messages');
};

const isNotificationInScope = (notif, scope) => {
  if (!scope) return true;
  const linkPath = notificationLinkPath(notif);
  if (!linkPath) {
    const hintedScope = TYPE_SCOPE_HINTS[String(notif?.type || '').toUpperCase()];
    if (!hintedScope) return true;
    return hintedScope === scope || hintedScope.startsWith(scope) || scope.startsWith(hintedScope);
  }
  return linkPath.startsWith(scope);
};

const isFreshNotification = (notif) => {
  const createdAt = notif?.created_at ? new Date(notif.created_at).getTime() : 0;
  if (!createdAt) return false;
  const ageMs = Date.now() - createdAt;
  return Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= 5 * 60 * 1000;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const collectUserIds = (...values) => {
  const ids = values
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  const uuidIds = ids.filter((id) => UUID_PATTERN.test(id));
  return Array.from(new Set(uuidIds.length ? uuidIds : ids));
};

const NotificationBell = ({ userId: userIdProp = null, userEmail: userEmailProp = null }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { appType } = useSubdomain();
  const dashboardScope = useMemo(
    () => resolveDashboardScope(location?.pathname || '', appType),
    [appType, location?.pathname]
  );

  const [userId, setUserId] = useState(userIdProp || null);
  const [userIds, setUserIds] = useState(() => collectUserIds(userIdProp));
  const [userRole, setUserRole] = useState('');
  const [buyerId, setBuyerId] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [taskUpdatingId, setTaskUpdatingId] = useState(null);
  const [bellBlinking, setBellBlinking] = useState(false);
  const pollingRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    const resolveNotificationUserId = async ({ id, email }) => {
      const safeUserId = String(id || '').trim();
      const safeEmail = String(email || '').trim().toLowerCase();

      if (safeUserId) {
        try {
          const { data: byId } = await supabase
            .from('users')
            .select('id')
            .eq('id', safeUserId)
            .maybeSingle();
          if (byId?.id) {
            return String(byId.id);
          }
        } catch {
          // ignore and continue to email fallback
        }
      }

      if (safeEmail) {
        try {
          const { data: byEmailRows } = await supabase
            .from('users')
            .select('id')
            .ilike('email', safeEmail)
            .order('updated_at', { ascending: false })
            .limit(1);
          if (Array.isArray(byEmailRows) && byEmailRows[0]?.id) {
            return String(byEmailRows[0].id);
          }
        } catch {
          // ignore
        }
      }

      return safeUserId || null;
    };

    const resolveBuyerIdForIdentity = async ({ id, email }) => {
      const safeUserId = String(id || '').trim();
      const safeEmail = String(email || '').trim().toLowerCase();

      if (safeUserId) {
        try {
          const { data: byUserRows } = await supabase
            .from('buyers')
            .select('id')
            .or(`user_id.eq.${safeUserId},id.eq.${safeUserId}`)
            .order('created_at', { ascending: false })
            .limit(1);
          if (Array.isArray(byUserRows) && byUserRows[0]?.id) {
            return byUserRows[0].id;
          }
        } catch {
          // ignore and continue to email fallback
        }
      }

      if (safeEmail) {
        try {
          const { data: byEmailRows } = await supabase
            .from('buyers')
            .select('id')
            .ilike('email', safeEmail)
            .order('created_at', { ascending: false })
            .limit(1);
          if (Array.isArray(byEmailRows) && byEmailRows[0]?.id) {
            return byEmailRows[0].id;
          }
        } catch {
          // ignore
        }
      }

      return null;
    };

    const hydrateIdentity = async (rawUser) => {
      const role = String(
        rawUser?.role ||
        rawUser?.user_metadata?.role ||
        rawUser?.app_metadata?.role ||
        ''
      ).toUpperCase();

      const resolvedUserId = await resolveNotificationUserId({
        id: rawUser?.id || null,
        email: rawUser?.email || null,
      });

      let resolvedBuyerId = rawUser?.buyer_id || rawUser?.buyerId || null;
      if (!resolvedBuyerId) {
        resolvedBuyerId = await resolveBuyerIdForIdentity({
          id: resolvedUserId || rawUser?.id || null,
          email: rawUser?.email || null,
        });
      }

      if (!mounted) return;
      const authUserId = String(rawUser?.id || '').trim() || null;
      const candidateUserIds = collectUserIds(resolvedUserId, authUserId, userIdProp);
      setUserId(candidateUserIds[0] || null);
      setUserIds(candidateUserIds);
      setUserRole(resolvedBuyerId ? 'BUYER' : role);
      setBuyerId(resolvedBuyerId || null);
    };

    const hydrateFromIdentity = async ({ id, email, authUserId = null }) => {
      const safeId = String(id || '').trim();
      const safeEmail = String(email || '').trim().toLowerCase();
      const safeAuthUserId = String(authUserId || '').trim();
      if (!safeId && !safeEmail) {
        if (!mounted) return;
        setUserId(null);
        setUserIds([]);
        setUserRole('');
        setBuyerId(null);
        return;
      }

      const resolvedUserId = await resolveNotificationUserId({ id: safeId, email: safeEmail || null });
      const resolvedBuyerId = await resolveBuyerIdForIdentity({
        id: resolvedUserId || safeId || null,
        email: safeEmail || null,
      });

      if (!mounted) return;
      const candidateUserIds = collectUserIds(resolvedUserId, safeId, safeAuthUserId);
      setUserId(candidateUserIds[0] || null);
      setUserIds(candidateUserIds);
      setUserRole(resolvedBuyerId ? 'BUYER' : '');
      setBuyerId(resolvedBuyerId);
    };

    const load = async () => {
      const safePropId = String(userIdProp || '').trim();
      const safePropEmail = String(userEmailProp || '').trim().toLowerCase();
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const authUserId = String(user?.id || '').trim();
        const authUserEmail = String(user?.email || '').trim().toLowerCase();
        if (safePropId || safePropEmail) {
          const matchesAuthUser =
            (safePropId && authUserId && safePropId === authUserId) ||
            (safePropEmail && authUserEmail && safePropEmail === authUserEmail);

          if (matchesAuthUser && user) {
            await hydrateIdentity(user);
          } else {
            await hydrateFromIdentity({
              id: safePropId || authUserId || null,
              email: safePropEmail || authUserEmail || null,
              authUserId: authUserId || null,
            });
          }
          return;
        }
        await hydrateIdentity(user || null);
      } catch {
        if (mounted) {
          if (safePropId || safePropEmail) {
            await hydrateFromIdentity({
              id: safePropId || null,
              email: safePropEmail || null,
              authUserId: null,
            });
          } else {
            setUserId(null);
            setUserIds([]);
            setUserRole('');
            setBuyerId(null);
          }
        }
      }
    };

    load();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      await hydrateIdentity(session?.user || null);
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe?.();
    };
  }, [userIdProp, userEmailProp]);

  useEffect(() => {
    const targetUserIds = collectUserIds(userIds, userId);
    if (!targetUserIds.length) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    fetchNotifications(targetUserIds);

    // Real-time subscription
    const channels = targetUserIds.map((targetUserId) => (
      supabase
        .channel(`notifications-realtime:${targetUserId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${targetUserId}` },
          (payload) => {
            const incoming = payload?.new || null;
            if (!incoming || !isNotificationInScope(incoming, dashboardScope)) return;
            setNotifications((prev) => {
              if (prev.some((n) => String(n?.id || '') === String(incoming?.id || ''))) {
                return prev;
              }
              const next = [incoming, ...prev];
              setUnreadCount(next.filter((n) => !n.is_read).length || 0);
              return next;
            });
            toast({
              title: incoming.title,
              description: incoming.message,
              className: "bg-white border-l-4 border-blue-600"
            });
          }
        )
        .subscribe()
    ));

    let buyerChannel = null;
    if (String(userRole || '').toUpperCase() === 'BUYER' && buyerId) {
      buyerChannel = supabase
        .channel(`buyer-notifications-realtime:${buyerId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'buyer_notifications', filter: `buyer_id=eq.${buyerId}` },
          (payload) => {
            const row = payload?.new || {};
            const mapped = mapBuyerNotificationRow(row);
            if (!isNotificationInScope(mapped, dashboardScope)) return;
            setNotifications((prev) => [mapped, ...prev]);
            if (!mapped?.is_read) {
              setUnreadCount((prev) => prev + 1);
            }
            toast({
              title: mapped.title || 'New Notification',
              description: mapped.message || 'You have a new update',
              className: "bg-white border-l-4 border-blue-600"
            });
          }
        )
        .subscribe();
    }

    // Polling fallback (in case realtime is disabled)
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }
      fetchNotifications(targetUserIds);
    }, FALLBACK_POLL_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchNotifications(targetUserIds);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      channels.forEach((channel) => supabase.removeChannel(channel));
      if (buyerChannel) supabase.removeChannel(buyerChannel);
      if (pollingRef.current) clearInterval(pollingRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [userId, userRole, buyerId, dashboardScope, userIds.join('|')]);

  const listNotificationsFromApi = async () => {
    const performRequest = async ({ path, options = {}, retry = true }) => {
      const res = await fetchWithCsrf(apiUrl(path), options);
      const payload = await res.json().catch(() => null);

      if (res.ok && payload?.success !== false) {
        return payload;
      }

      const message =
        payload?.error ||
        payload?.message ||
        `Request failed (${res.status || 'unknown'})`;

      const canRetry =
        retry &&
        (res.status === 401 ||
          res.status === 403 ||
          /csrf|unauthorized|forbidden/i.test(String(message || '')));

      if (canRetry) {
        try {
          // Refresh auth+csrf cookies and retry once.
          await fetchWithCsrf(apiUrl('/api/auth/me'));
        } catch {
          // ignore refresh failures
        }
        return performRequest({ path, options, retry: false });
      }

      throw new Error(message);
    };

    const payload = await performRequest({
      path: '/api/notifications/list?limit=100',
    });

    if (payload?.success === false) {
      throw new Error(payload?.error || 'Failed to load notifications');
    }

    return Array.isArray(payload?.notifications) ? payload.notifications : [];
  };

  const splitNotificationIds = (ids = []) => {
    const normalizedIds = Array.from(
      new Set(
        (ids || [])
          .map((id) => String(id || '').trim())
          .filter(Boolean)
      )
    );

    return {
      normalizedIds,
      buyerIds: normalizedIds
        .filter((id) => isBuyerNotifId(id))
        .map((id) => fromBuyerNotifId(id)),
      normalIds: normalizedIds.filter((id) => !isBuyerNotifId(id)),
    };
  };

  const toIdsQueryValue = (ids = []) =>
    (ids || [])
      .map((id) => String(id || '').trim())
      .filter(Boolean)
      .join(',');

  const markNotificationIdsReadFallback = async (ids = []) => {
    const { buyerIds, normalIds } = splitNotificationIds(ids);

    if (normalIds.length > 0) {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .in('id', normalIds);
      if (error) throw error;
    }

    if (buyerIds.length > 0) {
      const { error } = await supabase
        .from('buyer_notifications')
        .update({ is_read: true })
        .in('id', buyerIds);
      if (error) throw error;
    }
  };

  const deleteNotificationIdsFallback = async (ids = []) => {
    const { buyerIds, normalIds } = splitNotificationIds(ids);

    if (normalIds.length > 0) {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .in('id', normalIds);
      if (error) throw error;
    }

    if (buyerIds.length > 0) {
      const { error } = await supabase
        .from('buyer_notifications')
        .delete()
        .in('id', buyerIds);
      if (error) throw error;
    }
  };

  const markNotificationIdsRead = async (ids = []) => {
    const { normalizedIds } = splitNotificationIds(ids);

    if (!normalizedIds.length) return;

    try {
      const queryIds = toIdsQueryValue(normalizedIds);
      const res = await fetchWithCsrf(
        apiUrl(`/api/notifications/read${queryIds ? `?ids=${queryIds}` : ''}`),
        {
          method: 'PATCH',
          body: JSON.stringify({ ids: normalizedIds }),
        }
      );
      const payload = await res.json().catch(() => null);

      if (!res.ok || payload?.success === false) {
        throw new Error(payload?.error || `Failed to mark notifications as read (${res.status})`);
      }
    } catch (apiError) {
      await markNotificationIdsReadFallback(normalizedIds).catch(() => {
        throw apiError;
      });
    }
  };

  const deleteNotificationIds = async (ids = []) => {
    const { normalizedIds } = splitNotificationIds(ids);

    if (!normalizedIds.length) return;

    try {
      const queryIds = toIdsQueryValue(normalizedIds);
      const res = await fetchWithCsrf(
        apiUrl(`/api/notifications${queryIds ? `?ids=${queryIds}` : ''}`),
        {
          method: 'DELETE',
          body: JSON.stringify({ ids: normalizedIds }),
        }
      );
      const payload = await res.json().catch(() => null);

      if (!res.ok || payload?.success === false) {
        throw new Error(payload?.error || `Failed to delete notifications (${res.status})`);
      }
    } catch (apiError) {
      await deleteNotificationIdsFallback(normalizedIds).catch(() => {
        throw apiError;
      });
    }
  };

  const fetchNotifications = async (ids) => {
    try {
      const targetUserIds = collectUserIds(ids);
      if (!targetUserIds.length) {
        setNotifications([]);
        setUnreadCount(0);
        return;
      }

      const rows = await listNotificationsFromApi();
      const scoped = rows.filter((n) => isNotificationInScope(n, dashboardScope));
      setNotifications(scoped);
      setUnreadCount(scoped.filter((n) => !n.is_read).length || 0);
    } catch (error) {
      console.error("Fetch notifications error:", error);
    }
  };

  useEffect(() => {
    if (unreadCount <= 0) {
      setBellBlinking(false);
      return;
    }

    let resetTimer = null;
    let blinkInterval = null;

    const runBlink = () => {
      setBellBlinking(true);
      if (resetTimer) clearTimeout(resetTimer);
      resetTimer = setTimeout(() => setBellBlinking(false), 1400);
    };

    runBlink();
    blinkInterval = setInterval(runBlink, 15000);

    return () => {
      if (blinkInterval) clearInterval(blinkInterval);
      if (resetTimer) clearTimeout(resetTimer);
    };
  }, [unreadCount]);

  useEffect(() => {
    const rawPath = String(location?.pathname || '');
    const normalizedPath = stripCurrentAppPrefix(rawPath, appType);
    const inBuyerMessages =
      rawPath.startsWith('/buyer/messages') ||
      (appType === 'buyer' && normalizedPath.startsWith('/messages'));
    const inVendorMessages =
      rawPath.startsWith('/vendor/messages') ||
      (appType === 'vendor' && normalizedPath.startsWith('/messages'));
    if (!inBuyerMessages && !inVendorMessages) return;

    const proposalFromUrl = String(new URLSearchParams(location?.search || '').get('proposal') || '').trim();
    if (!proposalFromUrl) return;
    const targetPrefix = inBuyerMessages
      ? (appType === 'buyer' ? '/messages' : '/buyer/messages')
      : (appType === 'vendor' ? '/messages' : '/vendor/messages');

    const unreadMessageNotifs = notifications.filter((notif) => {
      if (notif?.is_read) return false;
      if (!isChatNotification(notif)) return false;

      const linkPath = resolveNotificationPathForCurrentApp(notif, appType);
      if (linkPath && !linkPath.startsWith(targetPrefix)) return false;

      const notifReference = String(notif?.reference_id || '').trim();
      if (notifReference) return notifReference === proposalFromUrl;

      const proposalFromLink = String(notificationLinkQuery(notif)?.get('proposal') || '').trim();
      if (!proposalFromLink) return true;
      return proposalFromLink === proposalFromUrl;
    });

    if (unreadMessageNotifs.length === 0) return;

    const unreadIds = unreadMessageNotifs.map((n) => n.id);

    const unreadIdSet = new Set(unreadMessageNotifs.map((n) => n.id));
    let cancelled = false;

    const markVisibleChatNotificationsRead = async () => {
      try {
        await markNotificationIdsRead(unreadIds);

        if (cancelled) return;

        setNotifications((prev) => {
          const next = prev.map((n) => (unreadIdSet.has(n.id) ? { ...n, is_read: true } : n));
          setUnreadCount(next.filter((n) => !n.is_read).length || 0);
          return next;
        });
      } catch (error) {
        console.error('Auto mark chat notifications read failed:', error);
      }
    };

    markVisibleChatNotificationsRead();

    return () => {
      cancelled = true;
    };
  }, [appType, location?.pathname, location?.search, notifications]);

  const markAsRead = async (id) => {
    try {
      await markNotificationIdsRead([id]);

      setNotifications((prev) => {
        const next = prev.map((n) => (n.id === id ? { ...n, is_read: true } : n));
        setUnreadCount(next.filter((n) => !n.is_read).length || 0);
        return next;
      });
    } catch (error) {
      console.error("Error marking read:", error);
    }
  };

  const deleteNotification = async (id, e) => {
    e.stopPropagation();
    try {
      await deleteNotificationIds([id]);

      setNotifications((prev) => {
        const next = prev.filter((n) => n.id !== id);
        setUnreadCount(next.filter((n) => !n.is_read).length || 0);
        return next;
      });
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  const clearVisibleNotifications = async () => {
    if (notifications.length === 0) {
      setIsOpen(false);
      return;
    }

    const ids = notifications.map((n) => n.id);

    try {
      await deleteNotificationIds(ids);

      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error("Error clearing notifications:", error);
      toast({
        title: 'Clear failed',
        description: error?.message || 'Could not clear notifications right now.',
        variant: 'destructive',
      });
    }
  };

  const markAllRead = async () => {
    const unread = notifications.filter((n) => !n.is_read);
    if (unread.length === 0) return;

    const ids = unread.map((n) => n.id);

    try {
      await markNotificationIdsRead(ids);

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Error marking all read:", error);
    }
  };

  const handleNotificationClick = async (notif) => {
    await markAsRead(notif.id);
    const target = resolveNotificationTarget(notif, appType);
    if (!target) return;
    setIsOpen(false);
    navigate(target);
  };

  const getCategoryRequestId = (notif) => {
    const link = notif?.link;
    if (link) {
      try {
        const url = new URL(link, window.location.origin);
        const id = url.searchParams.get('category_request');
        if (id) return id;
      } catch {
        // ignore
      }
    }
    const msg = String(notif?.message || '');
    const match = msg.match(/ticket[:\s#]*([a-f0-9-]{36})/i);
    return match ? match[1] : null;
  };

  const getTaskStatus = (notif) => {
    const msg = String(notif?.message || '');
    const match = msg.match(/status[:\s]*([A-Z_]+)/i);
    return (match?.[1] || 'ASSIGNED').toString().toUpperCase();
  };

  const isCategoryTask = (notif) => notif?.type === 'CATEGORY_REQUEST' && Boolean(getCategoryRequestId(notif));

  const updateTaskStatus = async (notif, nextStatus, event) => {
    if (event?.stopPropagation) event.stopPropagation();
    const taskId = getCategoryRequestId(notif);
    if (!taskId) return;
    if (taskUpdatingId) return;

    setTaskUpdatingId(notif.id);
    try {
      const res = await fetchWithCsrf(apiUrl(`/api/category-requests/${taskId}/status`), {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to update task');
      }
      setNotifications((prev) =>
        prev.map((n) => {
          if (n.id !== notif.id) return n;
          const msg = String(n.message || '');
          const nextMsg = msg.match(/status[:\s]*[A-Z_]+/i)
            ? msg.replace(/status[:\s]*[A-Z_]+/i, `Status: ${nextStatus}`)
            : `${msg} | Status: ${nextStatus}`;
          return { ...n, message: nextMsg };
        })
      );
      toast({
        title: nextStatus === 'DONE' ? 'Marked done' : 'Status updated',
        description: `Task status: ${String(nextStatus).replace('_', ' ')}`,
      });
    } catch (error) {
      toast({
        title: 'Update failed',
        description: error?.message || 'Could not update task status',
        variant: 'destructive',
      });
    } finally {
      setTaskUpdatingId(null);
    }
  };

  const formatStatus = (status) => String(status || '').replace('_', ' ');
  const isDataEntryView = typeof window !== 'undefined' && window.location.pathname.startsWith('/employee/dataentry');
  const statusClasses = (status) => {
    switch (status) {
      case 'DONE':
        return 'text-emerald-700 bg-emerald-50 border-emerald-200';
      case 'IN_PROGRESS':
        return 'text-amber-700 bg-amber-50 border-amber-200';
      case 'CANCELLED':
        return 'text-red-700 bg-red-50 border-red-200';
      case 'UNASSIGNED':
        return 'text-slate-600 bg-slate-50 border-slate-200';
      default:
        return 'text-blue-700 bg-blue-50 border-blue-200';
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
          className={cn(
            "relative text-gray-500 hover:text-[#003D82] hover:bg-blue-50",
            unreadCount > 0 && "text-[#003D82]",
            bellBlinking && "animate-pulse"
          )}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className={cn(
              "absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full border border-white bg-red-500 text-white text-[10px] leading-[16px] text-center font-semibold",
              bellBlinking && "animate-pulse"
            )}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 shadow-xl border-gray-100">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50/50">
          <h4 className="font-semibold text-sm">Notifications</h4>
          <div className="flex items-center gap-1">
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="xs"
                onClick={clearVisibleNotifications}
                className="h-auto px-2 py-1 text-xs text-red-600 hover:bg-red-50"
              >
                Clear
              </Button>
            )}
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="xs"
                onClick={markAllRead}
                className="h-auto px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"
              >
                Mark all read
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close notifications"
              className="h-6 w-6 text-gray-500 hover:text-gray-700"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <ScrollArea className="h-[300px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center text-gray-400">
              <Bell className="h-8 w-8 mb-2 opacity-20" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notif) => {
                const isTask = isCategoryTask(notif);
                const taskStatus = getTaskStatus(notif);
                const isAssignee = isDataEntryView;
                const isUpdating = taskUpdatingId === notif.id;

                return (
                  <div 
                    key={notif.id} 
                    className={cn(
                      "relative p-4 hover:bg-gray-50 transition-colors cursor-pointer group",
                      !notif.is_read && "bg-blue-50/30"
                    )}
                    onClick={() => handleNotificationClick(notif)}
                  >
                    <div className="flex gap-3">
                      <div className={cn(
                        "mt-1 h-2 w-2 rounded-full flex-shrink-0",
                        !notif.is_read ? "bg-blue-500" : "bg-transparent"
                      )} />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <p className={cn("text-sm font-medium leading-none", !notif.is_read ? "text-gray-900" : "text-gray-600")}>
                            {notif.title}
                          </p>
                          {!notif.is_read && isFreshNotification(notif) ? (
                            <span className="inline-flex rounded-full bg-blue-100 text-blue-700 text-[10px] font-semibold px-1.5 py-0.5">
                              New
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-2">
                          {notif.message}
                        </p>
                        {isTask && (
                          <div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-500">
                            <span className={cn("px-1.5 py-0.5 rounded border", statusClasses(taskStatus))}>
                              {formatStatus(taskStatus)}
                            </span>
                          </div>
                        )}
                        <p className="text-[10px] text-gray-400">
                          {new Date(notif.created_at).toLocaleDateString()} at {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {isTask && isAssignee && taskStatus !== 'DONE' && (
                          <div className="flex gap-2 pt-1">
                            {taskStatus !== 'IN_PROGRESS' && (
                              <Button
                                variant="outline"
                                size="xs"
                                disabled={isUpdating}
                                onClick={(e) => updateTaskStatus(notif, 'IN_PROGRESS', e)}
                              >
                                {isUpdating ? '...' : 'Start'}
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="xs"
                              disabled={isUpdating}
                              onClick={(e) => updateTaskStatus(notif, 'DONE', e)}
                            >
                              {isUpdating ? '...' : 'Mark Done'}
                            </Button>
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete notification"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-600"
                        onClick={(e) => deleteNotification(notif.id, e)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
