export const asPlanObject = (value) => {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof value === 'object' && !Array.isArray(value) ? value : {};
};

const normalizeBool = (value, fallback = false) => {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  const token = String(value ?? '').trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'on'].includes(token)) return true;
  if (['false', '0', 'no', 'n', 'off'].includes(token)) return false;
  return fallback;
};

const normalizePositiveInt = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.floor(parsed);
};

const inferTierFromName = (name = '') => {
  const token = String(name || '').toLowerCase();
  if (token.includes('diamond') || token.includes('dimond')) return 'DIAMOND';
  if (token.includes('gold')) return 'GOLD';
  if (token.includes('silver')) return 'SILVER';
  if (token.includes('certified') || token.includes('verified')) return 'CERTIFIED';
  return '';
};

const titleCase = (value = '') => {
  const token = String(value || '').trim().toUpperCase();
  if (!token) return '';
  return token.charAt(0) + token.slice(1).toLowerCase();
};

export const normalizeVendorPlanEntitlements = (source = {}, plan = {}) => {
  const features = asPlanObject(plan?.features);
  const entitlementSource = asPlanObject(source);
  const name = String(plan?.name || '').trim();
  const price = Number(plan?.price || 0);
  const inferredTier = inferTierFromName(name);

  const purchase = {
    ...asPlanObject(features.purchase),
    ...asPlanObject(entitlementSource.purchase),
  };
  const badge = {
    ...asPlanObject(features.badge),
    ...asPlanObject(entitlementSource.badge),
  };
  const portfolioRaw = {
    ...asPlanObject(features.portfolio),
    ...asPlanObject(entitlementSource.portfolio),
  };
  const certificateRaw = {
    ...asPlanObject(features.certificate),
    ...asPlanObject(entitlementSource.certificate),
  };
  const seoRaw = {
    ...asPlanObject(features.seo),
    ...asPlanObject(entitlementSource.seo),
  };
  const sitemapRaw = {
    ...asPlanObject(entitlementSource.sitemap),
  };

  const purchaseChannel = String(purchase.channel || '').trim().toUpperCase();
  const salesAssisted =
    purchaseChannel === 'SALES_ASSISTED' ||
    purchase.sales_assisted === true ||
    purchase.public_purchase_enabled === false ||
    price >= 75000 ||
    Boolean(inferredTier && ['SILVER', 'GOLD', 'DIAMOND'].includes(inferredTier));

  const portfolioTemplate = String(portfolioRaw.template || '').trim().toUpperCase() === 'PREMIUM'
    ? 'PREMIUM'
    : (salesAssisted || price >= 75000 ? 'PREMIUM' : 'STANDARD');
  const certificateTier = String(certificateRaw.tier || inferredTier || '').trim().toUpperCase();
  const certificateEnabled = normalizeBool(certificateRaw.enabled, Boolean(certificateTier && salesAssisted));
  const seoEnabled = normalizeBool(seoRaw.enabled, salesAssisted || portfolioTemplate === 'PREMIUM');

  return {
    purchase: {
      channel: salesAssisted ? 'SALES_ASSISTED' : 'DIRECT',
      sales_assisted: salesAssisted,
      public_purchase_enabled: !salesAssisted && purchase.public_purchase_enabled !== false,
      cta_label: String(purchase.cta_label || (salesAssisted ? 'Talk to sales' : 'Buy online')).trim(),
    },
    badge: {
      label: String(badge.label || '').trim(),
      variant: String(badge.variant || '').trim(),
    },
    portfolio: {
      enabled: normalizeBool(portfolioRaw.enabled, true),
      template: portfolioTemplate,
      premium: portfolioTemplate === 'PREMIUM',
      customizable: normalizeBool(portfolioRaw.customizable, salesAssisted),
      custom_url: normalizeBool(portfolioRaw.custom_url, salesAssisted),
      custom_sections: normalizeBool(portfolioRaw.custom_sections, salesAssisted),
      sitemap_customization: normalizeBool(portfolioRaw.sitemap_customization, salesAssisted),
      sitemap_url_boost: normalizePositiveInt(portfolioRaw.sitemap_url_boost, salesAssisted ? 100 : 0),
      showcase_label: String(portfolioRaw.showcase_label || '').trim(),
    },
    certificate: {
      enabled: certificateEnabled,
      tier: certificateTier,
      title: String(
        certificateRaw.title ||
          (certificateTier ? `${titleCase(certificateTier)} Vendor on IndianTradeMart` : '')
      ).trim(),
      printable: certificateRaw.printable !== false,
      shop_display: certificateRaw.shop_display !== false,
    },
    seo: {
      enabled: seoEnabled,
      portfolio_schema: normalizeBool(seoRaw.portfolio_schema, seoEnabled),
      sitemap: normalizeBool(seoRaw.sitemap, seoEnabled),
      custom_keywords: normalizeBool(seoRaw.custom_keywords, salesAssisted),
      url_aliases: normalizePositiveInt(seoRaw.url_aliases, salesAssisted ? 5 : 0),
      city_category_pages: normalizePositiveInt(seoRaw.city_category_pages, salesAssisted ? 50 : 0),
    },
    sitemap: {
      customizable: normalizeBool(sitemapRaw.customizable, normalizeBool(portfolioRaw.sitemap_customization, salesAssisted)),
      url_boost: normalizePositiveInt(sitemapRaw.url_boost, normalizePositiveInt(portfolioRaw.sitemap_url_boost, salesAssisted ? 100 : 0)),
      seo_pages: normalizePositiveInt(sitemapRaw.seo_pages, normalizePositiveInt(seoRaw.city_category_pages, salesAssisted ? 50 : 0)),
    },
  };
};

export const getVendorPlanEntitlements = (vendor = {}) => {
  const plan = vendor?.active_plan || vendor?.plan || {};
  return normalizeVendorPlanEntitlements(
    vendor?.plan_entitlements || plan?.entitlements || {},
    plan
  );
};

export const getVendorPlanBadgeLabel = (vendor = {}) => {
  const entitlements = getVendorPlanEntitlements(vendor);
  return entitlements.badge.label || vendor?.active_plan?.name || vendor?.plan?.name || '';
};

export const getVendorCertificate = (vendor = {}) => {
  const entitlements = getVendorPlanEntitlements(vendor);
  const certificate = asPlanObject(vendor?.certificate);
  if (!entitlements.certificate.enabled && !certificate.title) return null;
  return {
    ...certificate,
    tier: certificate.tier || entitlements.certificate.tier,
    title: certificate.title || entitlements.certificate.title,
    certificate_number: certificate.certificate_number || '',
  };
};

export const buildVendorPlanBenefitChips = (vendor = {}) => {
  const entitlements = getVendorPlanEntitlements(vendor);
  const certificate = getVendorCertificate(vendor);
  return [
    entitlements.portfolio.premium ? 'Premium portfolio' : 'Business profile',
    entitlements.portfolio.custom_url ? 'Custom profile URL' : '',
    entitlements.portfolio.customizable ? 'Custom sections' : '',
    certificate?.title || '',
    entitlements.seo.enabled ? 'SEO-ready profile' : '',
    entitlements.sitemap.customizable ? `${entitlements.sitemap.seo_pages || entitlements.sitemap.url_boost}+ sitemap reach` : '',
  ].filter(Boolean);
};
