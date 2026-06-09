import { apiUrl } from '@/lib/apiBase';
import { dbClient } from '@/lib/dbClient';
import { fetchWithCsrf } from '@/lib/fetchWithCsrf';

const KNOWN_PORTAL_SUBDOMAINS = new Set(['buyer', 'vendor', 'admin', 'man', 'emp', 'dir', 'career']);

const parseJson = async (response) => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};

const postSwitch = async (path) => {
  const response = await fetchWithCsrf(apiUrl(path), {
    method: 'POST',
    body: JSON.stringify({}),
  });
  const data = await parseJson(response);

  if (!response.ok || data?.success === false) {
    const error = new Error(data?.error || 'Unable to switch account');
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  await dbClient.auth.setSession().catch(() => {});
  return data;
};

export const switchToBuyer = () => postSwitch('/api/auth/switch/buyer');

export const switchToVendor = () => postSwitch('/api/auth/switch/vendor');

export const getPortalUrl = (portal, portalPath = '/') => {
  const cleanPortal = String(portal || '').trim().replace(/^\/+|\/+$/g, '');
  const cleanPath = `/${String(portalPath || '').replace(/^\/+/, '')}`;
  if (!cleanPortal) return cleanPath;
  if (typeof window === 'undefined') return `/${cleanPortal}${cleanPath}`;

  const { protocol, hostname, port } = window.location;
  const parts = hostname.split('.');
  const currentSubdomain = parts[0];

  if (parts.length >= 3 && KNOWN_PORTAL_SUBDOMAINS.has(currentSubdomain)) {
    const rootHost = parts.slice(1).join('.');
    const hostWithPort = port ? `${cleanPortal}.${rootHost}:${port}` : `${cleanPortal}.${rootHost}`;
    return `${protocol}//${hostWithPort}${cleanPath}`;
  }

  return `/${cleanPortal}${cleanPath}`;
};
