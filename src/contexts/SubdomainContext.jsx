// src/contexts/SubdomainContext.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';

const SubdomainContext = createContext();

// ✅ Only these should trigger subdomain-mode
const KNOWN_SUBDOMAINS = new Set(['vendor', 'buyer', 'man', 'dir', 'admin', 'career']);

const resolveSubdomainState = () => {
  if (typeof window === 'undefined') {
    return { subdomain: null, appType: 'main', basePath: '' };
  }

  const hostname = window.location.hostname;

  // ✅ Localhost (Development)
  if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
    return { subdomain: null, appType: 'main', basePath: '' };
  }

  // ✅ Netlify default domain (e.g. xyz.netlify.app) => treat as MAIN
  // So /vendor/register etc works on Netlify
  if (hostname.endsWith('.netlify.app')) {
    return { subdomain: null, appType: 'main', basePath: '' };
  }

  const parts = hostname.split('.');
  let currentSub = '';

  // Assuming: subdomain.domain.com (ignore www)
  if (parts.length >= 3 && parts[0] !== 'www') {
    currentSub = parts[0];
  }

  // ✅ If subdomain is not one of our known subdomains, treat as MAIN
  // This prevents random domains from forcing "directory" and causing blank pages
  if (!KNOWN_SUBDOMAINS.has(currentSub)) {
    return { subdomain: null, appType: 'main', basePath: '' };
  }

  switch (currentSub) {
    case 'vendor':
      return { subdomain: currentSub, appType: 'vendor', basePath: '' };
    case 'buyer':
      return { subdomain: currentSub, appType: 'buyer', basePath: '' };
    case 'man':
      return { subdomain: currentSub, appType: 'management', basePath: '' };
    case 'dir':
      return { subdomain: currentSub, appType: 'directory', basePath: '' };
    case 'admin':
      return { subdomain: currentSub, appType: 'admin', basePath: '' };
    case 'career':
      return { subdomain: currentSub, appType: 'career', basePath: '' };
    default:
      return { subdomain: null, appType: 'main', basePath: '' };
  }
};

export const SubdomainProvider = ({ children }) => {
  const [routingState, setRoutingState] = useState(resolveSubdomainState);
  const { subdomain, appType, basePath } = routingState;

  useEffect(() => {
    setRoutingState((current) => {
      const next = resolveSubdomainState();
      if (
        current.subdomain === next.subdomain &&
        current.appType === next.appType &&
        current.basePath === next.basePath
      ) {
        return current;
      }
      return next;
    });
  }, []);

  // ✅ Helper to generate correct links based on environment
  // If we are in 'main' mode, we prepend the app prefix (e.g. /vendor)
  // If we are in 'subdomain' mode, we use the path as is (e.g. /dashboard)
  const resolvePath = (path, module) => {
    if (appType === 'main') {
      const cleanPath = path.startsWith('/') ? path : `/${path}`;
      if (cleanPath.startsWith(`/${module}`)) return cleanPath;
      return `/${module}${cleanPath}`;
    }
    return path.startsWith('/') ? path : `/${path}`;
  };

  return (
    <SubdomainContext.Provider value={{ subdomain, appType, resolvePath, basePath }}>
      {children}
    </SubdomainContext.Provider>
  );
};

export const useSubdomain = () => {
  const context = useContext(SubdomainContext);
  if (!context) throw new Error('useSubdomain must be used within a SubdomainProvider');
  return context;
};
