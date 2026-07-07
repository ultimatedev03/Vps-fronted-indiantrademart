import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Button } from '@/components/ui/button';
import {
  Award,
  BadgeCheck,
  Briefcase,
  Building2,
  CalendarDays,
  ChevronRight,
  ExternalLink,
  Factory,
  Globe,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  PackageCheck,
  Phone,
  Send,
  ShieldCheck,
  Star,
  Store,
  User,
  Wrench,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Card from '@/shared/components/Card';
import { Badge } from '@/shared/components/Badge';
import { useAuth } from '@/contexts/AppAuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchWithCsrf } from '@/lib/fetchWithCsrf';
import { apiUrl } from '@/lib/apiBase';
import { toast } from '@/components/ui/use-toast';
import { getVendorProfilePath, getVendorProfileUrl } from '@/shared/utils/vendorRoutes';
import { getProductDetailPath } from '@/shared/utils/productRoutes';
import { phoneUtils } from '@/shared/utils/phoneUtils';
import {
  asPlanObject,
  buildVendorPlanBenefitChips,
  getVendorCertificate,
  getVendorPlanBadgeLabel,
  getVendorPlanEntitlements,
} from '@/shared/utils/vendorPlanEntitlements';
import { productRatings, PRODUCT_RATINGS_UPDATED_EVENT } from '@/shared/services/productRatings';
import { isValidIndianPhone, normalizeIndianPhone, submitPublicLead } from '@/shared/services/publicLeadApi';
import { setGlobalModalOpen, suppressQuotePopup } from '@/shared/utils/popupCoordinator';
import {
  getPremiumBrandBySlug,
  getPremiumBrandByVendorSlug,
  getPremiumBrandFallbackOfferings,
  getPremiumBrandProfileSlug,
  shouldUsePremiumBrandFallbackContent,
} from '@/modules/directory/lib/premiumBrands';

const VENDOR_FAVORITES_UPDATED_EVENT = 'itm:favorite-vendors:updated';

const aggregateRatingSummaries = (summaryMap = {}) => {
  const summaries = Object.values(summaryMap || {}).filter((item) => Number(item?.count || 0) > 0);
  const count = summaries.reduce((sum, item) => sum + Number(item.count || 0), 0);
  if (!count) return { average: 0, count: 0 };

  const weighted = summaries.reduce(
    (sum, item) => sum + (Number(item.average || 0) * Number(item.count || 0)),
    0
  );
  return { average: Math.round((weighted / count) * 10) / 10, count };
};

const normalizeEstablishedYear = (value) => {
  const year = Number(value);
  const currentYear = new Date().getFullYear();
  if (!Number.isFinite(year) || year < 1800 || year > currentYear) return null;
  return year;
};

const normalizePremiumBrandKey = (value = '') => String(value || '').trim().toLowerCase();

const resolvePremiumBrandForVendor = (requestedBrandSlug = '', requestedVendorKey = '', resolvedVendorKey = '') => {
  const vendorKeys = Array.from(
    new Set(
      [requestedVendorKey, resolvedVendorKey]
        .map((value) => normalizePremiumBrandKey(value))
        .filter(Boolean)
    )
  );

  const brandFromVendorKey = vendorKeys
    .map((key) => getPremiumBrandByVendorSlug(key))
    .find(Boolean) || null;
  const brandFromQuery = getPremiumBrandBySlug(requestedBrandSlug);

  if (!brandFromQuery) return brandFromVendorKey;

  const fallbackProfileSlug = normalizePremiumBrandKey(getPremiumBrandProfileSlug(brandFromQuery));
  const configuredVendorSlug = normalizePremiumBrandKey(brandFromQuery.vendorSlug);
  const queryMatchesVendor =
    (fallbackProfileSlug && vendorKeys.includes(fallbackProfileSlug)) ||
    (configuredVendorSlug && vendorKeys.includes(configuredVendorSlug));

  return queryMatchesVendor ? brandFromQuery : brandFromVendorKey;
};

const buildPremiumBrandFallbackVendor = (brand = null) => {
  if (!brand) return null;

  return {
    id: '',
    slug: getPremiumBrandProfileSlug(brand),
    brand_slug: brand.slug || '',
    company_name: brand.name || 'Premium Brand',
    legal_company_name: '',
    name: 'Sales Team',
    city: '',
    state: '',
    rating: 4.0,
    reviews: 0,
    verified: true,
    primary_business_type: brand.primaryBusinessType || 'Business Services',
    description:
      brand.description ||
      `${brand.name || 'This premium brand'} is featured on Indian Trade Mart for business enquiries and supplier discovery.`,
    phone: '',
    address: 'Address available on request',
    established: null,
    gst: '',
    email: '',
    website: '',
    profile_image: brand.logo_url || '',
    annual_turnover: '',
    tagline: brand.tagline || '',
    highlights: Array.isArray(brand.highlights) ? brand.highlights : [],
    is_brand_fallback: true,
  };
};

const mergeVendorWithPremiumBrand = (vendorData = {}, brand = null, options = {}) => {
  const { preferBrandName = false, preferBrandContent = false } = options;
  const brandFallback = buildPremiumBrandFallbackVendor(brand) || {};
  const legalCompanyName = String(vendorData.company_name || '').trim();

  return {
    id: vendorData.id || '',
    slug: vendorData.slug || brand?.vendorSlug || '',
    brand_slug: brand?.slug || '',
    company_name:
      (preferBrandName ? brand?.name : '') || legalCompanyName || brandFallback.company_name || 'Company Name',
    legal_company_name: legalCompanyName,
    name: vendorData.owner_name || vendorData.first_name || brandFallback.name || 'Contact',
    city: vendorData.city || brandFallback.city || '',
    state: vendorData.state || brandFallback.state || '',
    rating: vendorData.seller_rating || brandFallback.rating || 4.0,
    reviews: 0,
    verified: Boolean(vendorData.verification_badge || vendorData.is_verified || brand),
    primary_business_type:
      (preferBrandContent ? brand?.primaryBusinessType : '') ||
      vendorData.primary_business_type ||
      brandFallback.primary_business_type ||
      'Business Services',
    description:
      (preferBrandContent ? brand?.description : '') ||
      vendorData.description ||
      vendorData.business_description ||
      brandFallback.description ||
      vendorData.primary_business_type ||
      'Established business',
    phone: vendorData.phone || '',
    address: vendorData.registered_address || vendorData.address || brandFallback.address || 'Address available on request',
    established: normalizeEstablishedYear(vendorData.year_of_establishment),
    gst: vendorData.gst_number || '',
    email: vendorData.email || '',
    website: vendorData.website_url || '',
    profile_image: (preferBrandContent ? brand?.logo_url : '') || vendorData.profile_image || brand?.logo_url || '',
    annual_turnover: vendorData.annual_turnover || vendorData.annualTurnover || '',
    tagline: brand?.tagline || '',
    highlights: Array.isArray(brand?.highlights) ? brand.highlights : [],
    profile_template: vendorData.profile_template || (brand ? 'PREMIUM' : 'STANDARD'),
    profile_template_override: vendorData.profile_template_override || 'AUTO',
    portfolio_settings: vendorData.portfolio_settings || null,
    active_plan: vendorData.active_plan || null,
    active_subscription: vendorData.active_subscription || null,
    plan_entitlements: vendorData.plan_entitlements || vendorData.active_plan?.entitlements || null,
    certificate: vendorData.certificate || null,
    is_brand_fallback: false,
  };
};

class VendorProfileErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[VendorProfile] render error:', error, info);
    if (typeof window !== 'undefined') {
      window.__vendorProfileError = { error, info };
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto w-[92vw] max-w-3xl py-8" style={{ minHeight: 'calc(100vh - 8rem)' }}>
          <Card>
            <Card.Content className="p-6 text-center text-gray-600 space-y-3">
              <div className="text-lg font-semibold text-gray-900">Something went wrong</div>
              <p>Vendor profile could not load. Please refresh the page.</p>
              {this.state.error && (
                <pre className="text-xs text-gray-500 break-all whitespace-pre-wrap text-left bg-gray-50 border rounded p-3">
                  {String(this.state.error?.message || this.state.error)}
                </pre>
              )}
              <Button variant="outline" onClick={() => window.location.reload()}>
                Reload
              </Button>
            </Card.Content>
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}

const maskPhoneNumber = (phone) => {
  if (!phone) return '+91-XXXXXXXXXX';
  const masked = phoneUtils.maskPhone(phone);
  return masked ? `+91-${masked}` : '+91-XXXXXXXXXX';
};

const getCompanyInitials = (name = '') =>
  String(name || 'ITM')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'IT';

const getProductImage = (product = {}) =>
  product?.image ||
  product?.image_url ||
  'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=800&q=80';

const createGuestEnquiryForm = () => ({
  name: '',
  email: '',
  phone: '',
  company: '',
  quantity: '',
  budget: '',
  requirement: '',
});

const isValidEmail = (value = '') => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

const parseBudgetNumber = (value = '') => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const normalized = raw
    .replace(/[₹,\s]/g, '')
    .replace(/k$/i, '000')
    .replace(/l$/i, '00000');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const VendorProfileContent = () => {
  const { vendorSlugOrId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const searchParamsString = searchParams.toString();
  const requestedBrandSlug = searchParams.get('brand');
  const { user, userRole } = useAuth();
  const isBuyer = userRole === 'BUYER' && !!user;
  const requestedPremiumBrand = useMemo(
    () => resolvePremiumBrandForVendor(requestedBrandSlug, vendorSlugOrId),
    [requestedBrandSlug, vendorSlugOrId]
  );
  const premiumBrandFallbackOfferings = useMemo(
    () => getPremiumBrandFallbackOfferings(requestedPremiumBrand),
    [requestedPremiumBrand]
  );
  const requestedBrandUsesFallbackContent = useMemo(
    () => shouldUsePremiumBrandFallbackContent(requestedPremiumBrand),
    [requestedPremiumBrand]
  );

  // ✅ Favorites (buyer)
  const [isFavorite, setIsFavorite] = useState(false);
  const [favLoading, setFavLoading] = useState(false);

  const [vendor, setVendor] = useState(null);
  const [products, setProducts] = useState([]);
  const [services, setServices] = useState([]);
  const [serviceCategories, setServiceCategories] = useState([]);
  const [leads, setLeads] = useState([]);
  const [productRatingSummary, setProductRatingSummary] = useState({ average: 0, count: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'products');
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [selectedCollectionKey, setSelectedCollectionKey] = useState('');
  const [showAllServiceCollections, setShowAllServiceCollections] = useState(false);
  const [guestEnquiryOpen, setGuestEnquiryOpen] = useState(false);
  const [guestEnquirySubmitting, setGuestEnquirySubmitting] = useState(false);
  const [guestEnquiryProduct, setGuestEnquiryProduct] = useState(null);
  const [guestEnquiry, setGuestEnquiry] = useState(() => createGuestEnquiryForm());
  const requestedVendorKey = String(vendorSlugOrId || '').trim();
  const vendorRecordId = String(vendor?.id || '').trim();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [requestedVendorKey]);

  useEffect(() => {
    if (!guestEnquiryOpen) return undefined;
    setGlobalModalOpen(true);
    suppressQuotePopup(180_000);
    return () => setGlobalModalOpen(false);
  }, [guestEnquiryOpen]);

  useEffect(() => {
    // Fetch vendor data from backend APIs
    const fetchVendor = async () => {
      setLoading(true);
      if (requestedBrandUsesFallbackContent) {
        setVendor(null);
        setProducts([]);
        setServices([]);
        setServiceCategories([]);
        setShowAllProducts(false);
        setLoading(false);
        return;
      }

      try {
        const vendorRes = await fetchWithCsrf(apiUrl(`/api/vendors/${requestedVendorKey}`));
        if (!vendorRes.ok) throw new Error('Vendor not found');
        const vendorJson = await vendorRes.json();
        const vendorData = vendorJson?.vendor;

        if (vendorData) {
          const resolvedPremiumBrand = resolvePremiumBrandForVendor(
            requestedBrandSlug,
            requestedVendorKey,
            vendorData.slug || vendorData.id || requestedVendorKey
          );
          const shouldPreferBrandPresentation =
            Boolean(String(requestedBrandSlug || '').trim()) &&
            normalizePremiumBrandKey(resolvedPremiumBrand?.slug) === normalizePremiumBrandKey(requestedBrandSlug);
          const nextVendor = mergeVendorWithPremiumBrand(vendorData, resolvedPremiumBrand, {
            preferBrandName: shouldPreferBrandPresentation,
            preferBrandContent: shouldPreferBrandPresentation,
          });
          setVendor(nextVendor);

          const canonicalPath = getVendorProfilePath(vendorData);
          const currentPath = getVendorProfilePath(requestedVendorKey);
          if (vendorData.slug && canonicalPath && canonicalPath !== currentPath) {
            navigate(searchParamsString ? `${canonicalPath}?${searchParamsString}` : canonicalPath, { replace: true });
          }

          const [productsRes, servicesRes, categoriesRes] = await Promise.all([
            fetchWithCsrf(apiUrl(`/api/vendors/${vendorData.id}/products`)),
            fetchWithCsrf(apiUrl(`/api/vendors/${vendorData.id}/services`)),
            fetchWithCsrf(apiUrl(`/api/vendors/${vendorData.id}/service-categories`)),
          ]);

          if (productsRes.ok) {
            const productsJson = await productsRes.json();
            setProducts(productsJson?.products || []);
          } else {
            setProducts([]);
          }
          setShowAllProducts(false);

          if (servicesRes.ok) {
            const servicesJson = await servicesRes.json();
            setServices(servicesJson?.services || []);
          } else {
            setServices([]);
          }

          if (categoriesRes.ok) {
            const categoriesJson = await categoriesRes.json();
            setServiceCategories(categoriesJson?.categories || []);
          } else {
            setServiceCategories([]);
          }
        } else {
          setVendor(null);
          setProducts([]);
          setServices([]);
          setServiceCategories([]);
          setShowAllProducts(false);
        }
      } catch (e) {
        console.error("Vendor fetch failed", e);
        setVendor(null);
        setProducts([]);
        setServices([]);
        setServiceCategories([]);
        setShowAllProducts(false);
      } finally {
        setLoading(false);
      }
    };

    if (requestedVendorKey) {
      fetchVendor();
    }
  }, [requestedBrandSlug, requestedVendorKey, requestedBrandUsesFallbackContent, navigate, searchParamsString]);

  // ✅ Load favorite status
  useEffect(() => {
    const loadFavoriteStatus = async () => {
      if (!isBuyer || !user?.id || !vendorRecordId) return;

      try {
        const res = await fetchWithCsrf(apiUrl(`/api/vendors/${vendorRecordId}/favorite`));
        if (!res.ok) return;
        const data = await res.json();
        setIsFavorite(!!data?.isFavorite);
      } catch (e) {
        console.warn('[VendorProfile] favorite status load failed:', e);
      }
    };

    loadFavoriteStatus();
  }, [vendorRecordId, isBuyer, user?.id]);

  const toggleFavorite = async () => {
    if (!isBuyer) {
      toast({ title: 'Login required', description: 'Please login as Buyer to add favorites.' });
      navigate('/buyer/login');
      return;
    }

    if (!vendorRecordId || favLoading) return;
    setFavLoading(true);

    try {
      if (isFavorite) {
        const res = await fetchWithCsrf(apiUrl(`/api/vendors/${vendorRecordId}/favorite`), {
          method: 'DELETE',
        });
        if (!res.ok) throw new Error('Failed to remove favorite');

        setIsFavorite(false);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent(VENDOR_FAVORITES_UPDATED_EVENT));
        }
        toast({ title: 'Removed from Favorites' });
      } else {
        const res = await fetchWithCsrf(apiUrl(`/api/vendors/${vendorRecordId}/favorite`), {
          method: 'POST',
        });
        if (!res.ok) throw new Error('Failed to add favorite');

        setIsFavorite(true);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent(VENDOR_FAVORITES_UPDATED_EVENT));
        }
        toast({ title: 'Added to Favorites' });
      }
    } catch (e) {
      console.error('Favorite toggle error:', e);
      toast({ title: 'Failed', description: 'Could not update favorite. Try again.' });
    } finally {
      setFavLoading(false);
    }
  };

  // Load leads submitted by buyer to this vendor
  useEffect(() => {
    const loadLeads = async () => {
      if (!isBuyer || !user?.id || !vendorRecordId) return;

      try {
        const res = await fetchWithCsrf(apiUrl(`/api/vendors/${vendorRecordId}/leads`));
        if (!res.ok) return;
        const data = await res.json();
        if (data?.leads) setLeads(data.leads);
      } catch (error) {
        console.error('Error loading leads:', error);
      }
    };

    loadLeads();
  }, [vendorRecordId, isBuyer, user]);

  useEffect(() => {
    const productIds = (Array.isArray(products) ? products : [])
      .map((product) => String(product?.id || '').trim())
      .filter(Boolean);

    if (!productIds.length) {
      setProductRatingSummary({ average: 0, count: 0 });
      return undefined;
    }

    let cancelled = false;
    const loadProductRatings = async () => {
      const summaryMap = await productRatings.getSummaryMap(productIds);
      if (!cancelled) setProductRatingSummary(aggregateRatingSummaries(summaryMap));
    };

    loadProductRatings();
    if (typeof window !== 'undefined') {
      window.addEventListener(PRODUCT_RATINGS_UPDATED_EVENT, loadProductRatings);
      window.addEventListener('focus', loadProductRatings);
    }

    return () => {
      cancelled = true;
      if (typeof window !== 'undefined') {
        window.removeEventListener(PRODUCT_RATINGS_UPDATED_EVENT, loadProductRatings);
        window.removeEventListener('focus', loadProductRatings);
      }
    };
  }, [products]);

  const displayVendor = useMemo(
    () => {
      const baseVendor = vendor || buildPremiumBrandFallbackVendor(requestedPremiumBrand);
      if (!baseVendor || productRatingSummary.count <= 0) return baseVendor;

      return {
        ...baseVendor,
        rating: productRatingSummary.average,
        reviews: productRatingSummary.count,
      };
    },
    [productRatingSummary.average, productRatingSummary.count, requestedPremiumBrand, vendor]
  );
  const displayProducts =
    Array.isArray(products) && products.length ? products : premiumBrandFallbackOfferings;
  const displayServices =
    Array.isArray(services) && services.length ? services : premiumBrandFallbackOfferings;
  const visibleProducts = showAllProducts ? displayProducts : displayProducts.slice(0, 6);
  const groupedCollections = useMemo(() => {
    try {
      const groups = {};
      (displayProducts || []).forEach((product) => {
        const head = String(product?.head_category_name || 'Other Category');
        const sub = String(product?.sub_category_name || 'Other Subcategory');
        if (!groups[head]) groups[head] = {};
        if (!groups[head][sub]) groups[head][sub] = [];
        groups[head][sub].push(product);
      });
      return groups;
    } catch (e) {
      console.error('[VendorProfile] product grouping failed:', e);
      return {};
    }
  }, [displayProducts]);
  const hasCollections = Object.keys(groupedCollections || {}).length > 0;
  const collectionList = useMemo(() => {
    const list = [];
    Object.entries(groupedCollections || {}).forEach(([headName, subGroups]) => {
      const safeSubGroups = subGroups && typeof subGroups === 'object' ? subGroups : {};
      Object.entries(safeSubGroups).forEach(([subName, items]) => {
        const key = `${headName}|||${subName}`;
        list.push({
          key,
          headName,
          subName,
          items: Array.isArray(items) ? items : []
        });
      });
    });
    return list.sort((a, b) => String(a.subName).localeCompare(String(b.subName)));
  }, [groupedCollections]);
  const selectedCollection = collectionList.find((c) => c.key === selectedCollectionKey) || null;
  const visibleCollections = showAllServiceCollections ? collectionList : collectionList.slice(0, 6);
  const companyInitials = getCompanyInitials(displayVendor?.company_name);
  const productCount = Array.isArray(displayProducts) ? displayProducts.length : 0;
  const serviceCount = collectionList.length;
  const locationLabel = [displayVendor?.city, displayVendor?.state].filter(Boolean).join(', ') || 'India';
  const businessTypeLabel = displayVendor?.primary_business_type || 'Manufacturer, Supplier';
  const activePlanName = displayVendor?.active_plan?.name || 'Trial / Basic';
  const portfolioSettings = asPlanObject(displayVendor?.portfolio_settings);
  const customSeo = asPlanObject(portfolioSettings.seo);
  const customSitemap = asPlanObject(portfolioSettings.sitemap);
  const customHighlights = Array.isArray(portfolioSettings.featured_highlights)
    ? portfolioSettings.featured_highlights.filter(Boolean)
    : [];
  const customSections = Array.isArray(portfolioSettings.custom_sections)
    ? portfolioSettings.custom_sections
        .map((section) => ({
          title: String(section?.title || '').trim(),
          body: String(section?.body || '').trim(),
        }))
        .filter((section) => section.title || section.body)
    : [];
  const planEntitlements = getVendorPlanEntitlements(displayVendor || {});
  const planBadgeLabel = getVendorPlanBadgeLabel(displayVendor || {});
  const certificateMeta = getVendorCertificate(displayVendor || {});
  const planBenefitChips = buildVendorPlanBenefitChips(displayVendor || {});
  const hasPlanVerifiedSignal =
    Boolean(displayVendor?.verified) ||
    Boolean(planEntitlements.badge.label) ||
    Boolean(certificateMeta?.title);
  const isPremiumProfile =
    String(displayVendor?.profile_template || '').toUpperCase() === 'PREMIUM' ||
    planEntitlements.portfolio.premium;
  const heroDescription =
    portfolioSettings.tagline ||
    displayVendor?.tagline ||
    portfolioSettings.intro ||
    displayVendor?.description ||
    `${displayVendor?.company_name || 'This supplier'} is available for verified B2B enquiries on IndianTradeMart.`;
  const trustBadges = [
    planBadgeLabel || (isPremiumProfile ? 'Premium profile' : 'Business profile'),
    certificateMeta?.title || '',
    hasPlanVerifiedSignal ? 'Trusted supplier' : 'Supplier profile',
    planEntitlements.seo.enabled ? 'SEO-ready profile' : '',
    businessTypeLabel,
    displayVendor?.established ? `Since ${displayVendor.established}` : '',
    locationLabel,
  ].filter(Boolean);
  const statCards = [
    { label: 'Listed products', value: productCount || 'New', icon: PackageCheck },
    { label: 'Active plan', value: activePlanName, icon: Award },
    { label: 'Location', value: locationLabel, icon: MapPin },
    { label: certificateMeta?.title ? 'Certificate' : 'Buyer rating', value: certificateMeta?.tier || `${Number(displayVendor?.rating || 4).toFixed(1)} / 5`, icon: certificateMeta?.title ? ShieldCheck : Star },
  ];
  const portfolioCategories = Array.from(
    new Set(
      (displayProducts || [])
        .map((product) => product?.category || product?.micro_category_name || product?.sub_category_name)
        .filter(Boolean)
    )
  ).slice(0, 5);
  const portfolioCapabilities = [
    businessTypeLabel,
    ...portfolioCategories,
    ...customHighlights,
    ...customSections.map((section) => section.title),
    displayVendor?.established ? `Established ${displayVendor.established}` : '',
    ...planBenefitChips,
  ].filter(Boolean).slice(0, 6);
  const portfolioMetrics = [
    { label: 'Catalogue Range', value: `${productCount || 0}+`, helper: 'listed offerings', icon: PackageCheck },
    { label: 'Operating Base', value: locationLabel, helper: 'supplier location', icon: MapPin },
    { label: 'Business Focus', value: businessTypeLabel, helper: 'primary capability', icon: Briefcase },
    {
      label: certificateMeta?.title ? 'Vendor Certificate' : 'Profile Trust',
      value: certificateMeta?.tier || (hasPlanVerifiedSignal ? 'Verified' : 'Listed'),
      helper: certificateMeta?.title || activePlanName,
      icon: ShieldCheck,
    },
  ];
  const seoProductKeywords = portfolioCategories.length
    ? portfolioCategories
    : (displayProducts || []).slice(0, 5).map((product) => product?.name).filter(Boolean);
  const seoTitle = customSeo.title || `${displayVendor?.company_name || 'Vendor'} - ${businessTypeLabel} in ${locationLabel} | IndianTradeMart`;
  const seoDescription =
    customSeo.description ||
    portfolioSettings.intro ||
    `${displayVendor?.company_name || 'This supplier'} is a ${businessTypeLabel} in ${locationLabel}. View company portfolio, ${productCount || 'multiple'} products, contact details and business enquiry options on IndianTradeMart.`;
  const customSeoKeywords = Array.isArray(customSeo.keywords) ? customSeo.keywords : [];
  const customSitemapKeywords = customSitemap.enabled === false
    ? []
    : (Array.isArray(customSitemap.priority_keywords) ? customSitemap.priority_keywords : []);
  const seoKeywords = [
    displayVendor?.company_name,
    businessTypeLabel,
    locationLabel,
    activePlanName,
    certificateMeta?.title,
    planBadgeLabel,
    planEntitlements.seo.enabled ? 'SEO ready supplier profile' : '',
    ...customSeoKeywords,
    ...customSitemapKeywords,
    ...customHighlights,
    ...seoProductKeywords,
    'IndianTradeMart supplier',
    'B2B company profile',
  ].filter(Boolean).join(', ');
  const canonicalUrl = getVendorProfileUrl(displayVendor, 'https://indiantrademart.com');
  const vendorStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: displayVendor?.company_name || 'Supplier',
    description: seoDescription,
    url: canonicalUrl,
    image: displayVendor?.profile_image || undefined,
    telephone: displayVendor?.phone || undefined,
    email: displayVendor?.email || undefined,
    address: {
      '@type': 'PostalAddress',
      streetAddress: displayVendor?.address || undefined,
      addressLocality: displayVendor?.city || undefined,
      addressRegion: displayVendor?.state || undefined,
      addressCountry: 'IN',
    },
    aggregateRating: Number(displayVendor?.reviews || 0) > 0
      ? {
          '@type': 'AggregateRating',
          ratingValue: Number(displayVendor?.rating || 4).toFixed(1),
          reviewCount: Number(displayVendor?.reviews || 0),
        }
      : undefined,
    makesOffer: (displayProducts || []).slice(0, 8).map((product) => ({
      '@type': 'Offer',
      itemOffered: {
        '@type': 'Product',
        name: product?.name || product?.category || 'Product',
        image: getProductImage(product),
        category: product?.category || product?.micro_category_name || undefined,
      },
      price: String(product?.price || '').replace(/[^\d.]/g, '') || undefined,
      priceCurrency: 'INR',
    })),
    award: certificateMeta?.title || planBadgeLabel || undefined,
    additionalProperty: [
      planBadgeLabel ? { '@type': 'PropertyValue', name: 'Vendor badge', value: planBadgeLabel } : null,
      certificateMeta?.title ? { '@type': 'PropertyValue', name: 'Certificate', value: certificateMeta.title } : null,
      planEntitlements.portfolio.custom_url ? { '@type': 'PropertyValue', name: 'Custom profile URL', value: 'Enabled' } : null,
      planEntitlements.seo.enabled ? { '@type': 'PropertyValue', name: 'SEO profile', value: 'Enabled' } : null,
    ].filter(Boolean),
  };
  const tabsListClass = isPremiumProfile
    ? 'flex h-auto w-full justify-start gap-2 overflow-x-auto rounded-xl border border-slate-300 bg-slate-200/70 p-2 shadow-sm'
    : 'flex h-auto w-full justify-start gap-2 overflow-x-auto rounded-lg border border-slate-200 bg-white p-2 shadow-sm';
  const tabsTriggerClass = isPremiumProfile
    ? 'rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 data-[state=active]:bg-[#00A699] data-[state=active]:text-white data-[state=active]:shadow-none'
    : 'rounded-md px-4 py-2.5 text-sm font-semibold data-[state=active]:bg-[#003D82] data-[state=active]:text-white data-[state=active]:shadow-none';
  const catalogueShellClass = isPremiumProfile
    ? 'rounded-xl border border-slate-300 bg-slate-100 p-4 shadow-sm'
    : '';
  const contactPanelClass = isPremiumProfile
    ? 'sticky top-24 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm'
    : 'sticky top-24 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm';
  const contactHeaderClass = isPremiumProfile
    ? 'border-b border-slate-300 bg-[linear-gradient(135deg,#f8fafc,#e5e7eb)] px-4 py-4 text-slate-950 sm:px-5'
    : 'bg-slate-950 px-6 py-5 text-white';
  const contactBodyClass = isPremiumProfile
    ? 'space-y-2.5 p-4'
    : 'space-y-4 p-6';
  const contactItemClass = isPremiumProfile
    ? 'flex gap-2.5 items-start rounded-lg border border-slate-300 bg-slate-50 p-2.5 transition-all hover:-translate-y-0.5 hover:border-[#00A699] hover:bg-white hover:shadow-sm'
    : 'flex gap-3 items-start';
  const contactLabelClass = isPremiumProfile ? 'text-xs text-slate-500' : 'text-xs text-gray-500';
  const contactValueClass = isPremiumProfile ? 'font-semibold text-slate-950' : 'font-semibold text-slate-950';
  const contactSubTextClass = isPremiumProfile ? 'text-sm text-slate-600' : 'text-sm text-gray-600';
  const contactIconWrapClass = isPremiumProfile ? 'rounded-md p-1.5' : 'rounded-lg p-2';
  const contactIconClass = isPremiumProfile ? 'h-4 w-4' : 'h-5 w-5';

  const openGuestEnquiry = (product = null) => {
    const fallbackEmail = String(user?.email || '').trim();
    const metadata = user?.user_metadata || {};
    setGuestEnquiryProduct(product || null);
    setGuestEnquiry({
      ...createGuestEnquiryForm(),
      name: metadata.full_name || metadata.name || (fallbackEmail ? fallbackEmail.split('@')[0] : ''),
      email: fallbackEmail,
      phone: metadata.phone || metadata.mobile || '',
      company: metadata.company_name || '',
      requirement: product?.name ? `I am interested in ${product.name}. Please share pricing and availability.` : '',
    });
    setGuestEnquiryOpen(true);
  };

  const submitGuestEnquiry = async () => {
    if (!vendorRecordId) {
      toast({ title: 'Vendor unavailable', description: 'Vendor profile could not be resolved.' });
      return;
    }

    const buyerName = String(guestEnquiry.name || '').trim();
    const buyerEmail = String(guestEnquiry.email || '').trim().toLowerCase();
    const buyerPhone = normalizeIndianPhone(guestEnquiry.phone || '');
    const requirement = String(guestEnquiry.requirement || '').trim();

    if (!buyerName) {
      toast({ title: 'Name required', description: 'Please enter your name.', variant: 'destructive' });
      return;
    }
    if (!isValidEmail(buyerEmail)) {
      toast({ title: 'Valid email required', description: 'Please enter a correct email address.', variant: 'destructive' });
      return;
    }
    if (!isValidIndianPhone(buyerPhone)) {
      toast({ title: 'Valid phone required', description: 'Please enter a valid 10 digit Indian mobile number.', variant: 'destructive' });
      return;
    }
    if (requirement.length < 10) {
      toast({ title: 'Requirement required', description: 'Please write at least 10 characters.', variant: 'destructive' });
      return;
    }

    const selectedProduct = guestEnquiryProduct || {};
    const productName = selectedProduct?.name || `Enquiry for ${displayVendor?.company_name || 'supplier'}`;
    const categoryName =
      selectedProduct?.category ||
      selectedProduct?.micro_category_name ||
      selectedProduct?.sub_category_name ||
      businessTypeLabel ||
      'General';
    const quantity = String(guestEnquiry.quantity || '').trim().slice(0, 80) || null;
    const budget = parseBudgetNumber(guestEnquiry.budget);

    setGuestEnquirySubmitting(true);
    suppressQuotePopup(180_000);
    try {
      await submitPublicLead({
        vendor_id: vendorRecordId,
        vendor_email: displayVendor?.email || '',
        title: productName,
        product_name: productName,
        product_interest: productName,
        category: categoryName,
        category_slug: selectedProduct?.category_slug || selectedProduct?.micro_category_slug || '',
        buyer_name: buyerName,
        buyer_email: buyerEmail,
        buyer_phone: buyerPhone,
        company_name: String(guestEnquiry.company || '').trim() || null,
        description: requirement,
        message: requirement,
        quantity,
        budget,
        location: locationLabel,
        city: displayVendor?.city || '',
        state: displayVendor?.state || '',
        source: 'GUEST_VENDOR_PROFILE_ENQUIRY',
        lead_origin: 'GUEST_BUYER_ENQUIRY',
        consent_source: 'vendor_profile_guest_enquiry',
      });
      suppressQuotePopup(180_000);

      toast({
        title: 'Enquiry sent',
        description: 'Supplier aur sales team ko lead mil gayi. Email par buyer account banane ka link bhi bheja jayega.',
      });
      setGuestEnquiryOpen(false);
      setGuestEnquiryProduct(null);
      setGuestEnquiry(createGuestEnquiryForm());
    } catch (error) {
      toast({
        title: 'Enquiry failed',
        description: error?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setGuestEnquirySubmitting(false);
    }
  };

  const handleEnquire = (product) => {
    if (!vendorRecordId) {
      toast({ title: 'Vendor unavailable', description: 'Vendor profile could not be resolved.' });
      return;
    }

    const vendorName = encodeURIComponent(displayVendor?.company_name || '');
    const productName = encodeURIComponent(product?.name || '');
    if (isBuyer) {
      navigate(`/buyer/proposals/new?vendorId=${vendorRecordId}&vendorName=${vendorName}&productName=${productName}`);
    } else {
      openGuestEnquiry(product);
    }
  };

  const handleVendorEnquiry = () => {
    if (!vendorRecordId) {
      toast({ title: 'Vendor unavailable', description: 'Vendor profile could not be resolved.' });
      return;
    }

    if (isBuyer) {
      navigate(`/buyer/proposals/new?vendorId=${vendorRecordId}&vendorName=${encodeURIComponent(displayVendor.company_name)}`);
      return;
    }

    openGuestEnquiry();
  };

  const handleOpenProduct = (product) => {
    if (product?.isBrandOffering) {
      if (!vendorRecordId) return;
      handleEnquire(product);
      return;
    }

    const detailPath = getProductDetailPath(product);
    if (!detailPath) {
      handleEnquire(product);
      return;
    }
    navigate(detailPath);
  };

  if (loading) {
    return (
      <div className="mx-auto w-[92vw] py-8 space-y-6" style={{ minHeight: 'calc(100vh - 8rem)' }}>
        <Skeleton className="h-64 w-full rounded-xl" />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!displayVendor) {
    return (
      <div className="mx-auto w-[92vw] max-w-3xl py-8" style={{ minHeight: 'calc(100vh - 8rem)' }}>
        <Card>
          <Card.Content className="p-6 text-center text-gray-600 space-y-3">
            <div className="text-lg font-semibold text-gray-900">
              {requestedPremiumBrand?.name || 'Vendor'} details are unavailable
            </div>
            <p>
              We could not load the supplier profile for this page right now. Please try again in a moment.
            </p>
            <Button variant="outline" onClick={() => navigate('/directory/vendor')}>
              Back to Vendor Directory
            </Button>
          </Card.Content>
        </Card>
      </div>
    );
  }

  return (
    <div className={`${isPremiumProfile ? 'bg-slate-100' : 'bg-slate-50'} font-sans`}>
      <Helmet>
        <title>{seoTitle}</title>
        <meta name="description" content={seoDescription} />
        <meta name="keywords" content={seoKeywords} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={seoDescription} />
        <meta property="og:type" content="profile" />
        <meta property="og:url" content={canonicalUrl} />
        {displayVendor?.profile_image ? <meta property="og:image" content={displayVendor.profile_image} /> : null}
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json">
          {JSON.stringify(vendorStructuredData)}
        </script>
      </Helmet>

      <Dialog
        open={guestEnquiryOpen}
        onOpenChange={(open) => {
          if (guestEnquirySubmitting) return;
          setGuestEnquiryOpen(open);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:w-[38vw]">
          <DialogHeader>
            <DialogTitle>Send Enquiry</DialogTitle>
            <DialogDescription>
              {isBuyer
                ? 'Your buyer account details will be used for this enquiry.'
                : 'No buyer login needed. Sales team will also help you create a buyer account after enquiry.'}
            </DialogDescription>
          </DialogHeader>

          {guestEnquiryProduct?.name ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              Product: <span className="font-semibold text-slate-950">{guestEnquiryProduct.name}</span>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="guest-enquiry-name">Name</Label>
              <Input
                id="guest-enquiry-name"
                value={guestEnquiry.name}
                onChange={(event) => setGuestEnquiry((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Your name"
                autoComplete="name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="guest-enquiry-phone">Mobile number</Label>
              <Input
                id="guest-enquiry-phone"
                value={guestEnquiry.phone}
                onChange={(event) => setGuestEnquiry((prev) => ({ ...prev, phone: event.target.value }))}
                placeholder="10 digit mobile"
                inputMode="tel"
                autoComplete="tel"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="guest-enquiry-email">Email</Label>
              <Input
                id="guest-enquiry-email"
                type="email"
                value={guestEnquiry.email}
                onChange={(event) => setGuestEnquiry((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="guest-enquiry-company">Company</Label>
              <Input
                id="guest-enquiry-company"
                value={guestEnquiry.company}
                onChange={(event) => setGuestEnquiry((prev) => ({ ...prev, company: event.target.value }))}
                placeholder="Company name"
                autoComplete="organization"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="guest-enquiry-quantity">Quantity</Label>
              <Input
                id="guest-enquiry-quantity"
                value={guestEnquiry.quantity}
                onChange={(event) => setGuestEnquiry((prev) => ({ ...prev, quantity: event.target.value }))}
                placeholder="e.g. 100 pieces"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="guest-enquiry-budget">Budget</Label>
              <Input
                id="guest-enquiry-budget"
                value={guestEnquiry.budget}
                onChange={(event) => setGuestEnquiry((prev) => ({ ...prev, budget: event.target.value }))}
                placeholder="e.g. 50000"
                inputMode="numeric"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="guest-enquiry-requirement">Requirement</Label>
              <Textarea
                id="guest-enquiry-requirement"
                rows={4}
                value={guestEnquiry.requirement}
                onChange={(event) => setGuestEnquiry((prev) => ({ ...prev, requirement: event.target.value }))}
                placeholder="Tell supplier what you need, delivery location, timeline, quantity, etc."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGuestEnquiryOpen(false)} disabled={guestEnquirySubmitting}>
              Cancel
            </Button>
            <Button className="bg-[#00A699] hover:bg-[#008c81]" onClick={submitGuestEnquiry} disabled={guestEnquirySubmitting}>
              {guestEnquirySubmitting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  Send Enquiry
                </span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="mx-auto w-[92vw] max-w-[1760px] py-6 lg:py-8">

      {/* Company website style hero */}
      {isPremiumProfile ? (
      <section className="mb-4 overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
        <div className="relative border-b border-slate-300 bg-[linear-gradient(135deg,#f8fafc,#e9eef4)] px-4 py-4 text-slate-950 sm:px-5 lg:px-6">
          <div className="absolute inset-y-0 left-0 w-1.5 bg-[#00A699]" />
          <div className="relative grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-center">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-sm sm:h-20 sm:w-20">
                {displayVendor.profile_image ? (
                  <img src={displayVendor.profile_image} alt={displayVendor.company_name} className="h-full w-full rounded-md object-contain" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-md bg-slate-100 text-2xl font-extrabold text-[#003D82]">
                    {companyInitials}
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#00A699]/20 bg-[#00A699]/10 px-2.5 py-1 text-[11px] font-semibold text-[#007a70]">
                    <Store className="h-3.5 w-3.5" />
                    {planEntitlements.portfolio.showcase_label || 'Premium Portfolio'}
                  </span>
                  {planBadgeLabel ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[11px] font-semibold text-cyan-800">
                      <Award className="h-3.5 w-3.5" />
                      {planBadgeLabel}
                    </span>
                  ) : null}
                  {hasPlanVerifiedSignal ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Verified profile
                    </span>
                  ) : null}
                  {certificateMeta?.title ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                      <BadgeCheck className="h-3.5 w-3.5" />
                      {certificateMeta.title}
                    </span>
                  ) : null}
                </div>

                <h1 className="max-w-4xl text-2xl font-extrabold leading-tight tracking-normal text-slate-950 lg:text-3xl">
                  {displayVendor.company_name || 'Company Name'}
                  {hasPlanVerifiedSignal && <BadgeCheck className="ml-2 inline h-5 w-5 fill-blue-100 text-blue-500 align-[-2px] sm:h-6 sm:w-6" />}
                </h1>

                <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-600">
                  {heroDescription}
                </p>

                <div className="mt-2 flex flex-wrap gap-2">
                  {trustBadges.slice(0, 4).map((badge) => (
                    <span key={badge} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600">
                      {badge}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-300 bg-white/90 p-2.5 shadow-sm">
              <div className="grid grid-cols-2 gap-2">
                {statCards.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-100 p-2 text-slate-900 transition-colors hover:bg-white">
                      <Icon className="mb-1 h-3.5 w-3.5 text-[#00A699]" />
                      <div className="line-clamp-1 text-sm font-extrabold">{item.value}</div>
                      <div className="mt-0.5 text-[10px] font-medium uppercase text-slate-500">{item.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 px-4 py-3 sm:px-5 lg:grid-cols-[1fr_auto] lg:items-center lg:px-6">
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-700">
            <span className="inline-flex items-center gap-2">
              <MapPin className="h-4 w-4 text-[#003D82]" />
              {locationLabel}
            </span>
            <span className="inline-flex items-center gap-2">
              <Star className="h-4 w-4 fill-orange-400 text-orange-400" />
              {Number(displayVendor.rating || 4).toFixed(1)} ({displayVendor.reviews || 0} Reviews)
            </span>
            <span className="inline-flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-[#003D82]" />
              {businessTypeLabel}
            </span>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto lg:justify-end">
            <Button
              variant="outline"
              className={`h-9 border-slate-300 ${isFavorite ? 'bg-yellow-50 text-slate-900' : 'bg-white'}`}
              onClick={toggleFavorite}
              disabled={favLoading || !vendorRecordId}
              title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Star
                className={`mr-2 h-4 w-4 ${isFavorite ? 'text-yellow-500' : ''}`}
                fill={isFavorite ? 'currentColor' : 'none'}
              />
              {isFavorite ? 'Favorited' : 'Favorite'}
            </Button>

            <Button
              variant="outline"
              className="h-9 border-slate-300 bg-white"
              disabled={!vendorRecordId}
              onClick={() =>
                toast({
                  title: 'Lead confirmation required',
                  description: 'Number show after lead confirm.',
                })
              }
            >
              <Phone className="mr-2 h-4 w-4" /> View Number
            </Button>

            <Button
              className="h-9 bg-[#00A699] hover:bg-[#008c81]"
              disabled={!vendorRecordId}
              onClick={handleVendorEnquiry}
            >
              <Send className="mr-2 h-4 w-4" /> Send Enquiry
            </Button>
          </div>
        </div>
      </section>
      ) : (
      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-2">
              {displayVendor.profile_image ? (
                <img src={displayVendor.profile_image} alt={displayVendor.company_name} className="h-full w-full rounded-md object-contain" />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-md bg-[#003D82] text-2xl font-extrabold text-white">
                  {companyInitials}
                </div>
              )}
            </div>

            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                  <Store className="h-3.5 w-3.5" />
                  Standard Profile
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                  <Award className="h-3.5 w-3.5" />
                  {planBadgeLabel || activePlanName}
                </span>
                {certificateMeta?.title ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    {certificateMeta.title}
                  </span>
                ) : null}
                {hasPlanVerifiedSignal ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Verified profile
                  </span>
                ) : null}
              </div>

              <h1 className="text-xl font-extrabold text-slate-950 sm:text-2xl">
                {displayVendor.company_name || 'Company Name'}
                {hasPlanVerifiedSignal && <BadgeCheck className="ml-2 inline h-5 w-5 fill-blue-50 text-blue-500 align-[-2px]" />}
              </h1>

              <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-600">
                {heroDescription}
              </p>

              <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-[#003D82]" />
                  {locationLabel}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Briefcase className="h-4 w-4 text-[#003D82]" />
                  {businessTypeLabel}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <PackageCheck className="h-4 w-4 text-[#003D82]" />
                  {productCount} products
                </span>
              </div>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto lg:justify-end">
            <Button
              variant="outline"
              className={`h-10 border-slate-300 ${isFavorite ? 'bg-yellow-50 text-slate-900' : 'bg-white'}`}
              onClick={toggleFavorite}
              disabled={favLoading || !vendorRecordId}
              title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Star
                className={`mr-2 h-4 w-4 ${isFavorite ? 'text-yellow-500' : ''}`}
                fill={isFavorite ? 'currentColor' : 'none'}
              />
              {isFavorite ? 'Favorited' : 'Favorite'}
            </Button>

            <Button
              variant="outline"
              className="h-10 border-slate-300 bg-white"
              disabled={!vendorRecordId}
              onClick={() =>
                toast({
                  title: 'Lead confirmation required',
                  description: 'Number show after lead confirm.',
                })
              }
            >
              <Phone className="mr-2 h-4 w-4" /> View Number
            </Button>

            <Button
              className="h-10 bg-[#003D82] hover:bg-[#002f66]"
              disabled={!vendorRecordId}
              onClick={handleVendorEnquiry}
            >
              <Send className="mr-2 h-4 w-4" /> Send Enquiry
            </Button>
          </div>
        </div>
      </section>
      )}

      {isPremiumProfile ? (
        <section className="mb-5 rounded-xl border border-slate-300 bg-slate-200/70 p-4 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold uppercase text-slate-600">Buyer-ready portfolio</p>
                <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm">
                  {activePlanName} profile
                </span>
                {certificateMeta?.certificate_number ? (
                  <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-700 shadow-sm">
                    Certificate #{certificateMeta.certificate_number}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
                {displayVendor.company_name} showcases {productCount || 'multiple'} offerings in {businessTypeLabel} from {locationLabel}.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {portfolioCapabilities.map((item) => (
                  <span key={item} className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:border-[#00A699] hover:text-[#007a70]">
                    {item}
                  </span>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="h-9 bg-slate-950 px-4 text-xs hover:bg-slate-800"
                  onClick={() => setActiveTab('products')}
                >
                  View catalogue
                  <ChevronRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 border-slate-400 bg-white px-4 text-xs hover:border-[#00A699] hover:text-[#007a70]"
                  disabled={!vendorRecordId}
                  onClick={handleVendorEnquiry}
                >
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                  Send enquiry
                </Button>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:w-[520px]">
              {portfolioMetrics.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="group flex min-w-0 items-center gap-3 rounded-lg border border-slate-300 bg-slate-50 p-3 transition-all hover:-translate-y-0.5 hover:border-[#00A699] hover:bg-white hover:shadow-sm">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#003D82] shadow-sm transition-colors group-hover:bg-[#00A699] group-hover:text-white">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase text-slate-500">{item.label}</p>
                      <p className="line-clamp-1 text-sm font-extrabold text-slate-950">{item.value}</p>
                      <p className="line-clamp-1 text-xs text-slate-500">{item.helper}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {isPremiumProfile && customSections.length > 0 ? (
        <section className="mb-5 grid gap-3 md:grid-cols-2">
          {customSections.map((section, index) => (
            <div key={`${section.title}-${index}`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#00A699] hover:shadow-md">
              <p className="text-[11px] font-semibold uppercase text-[#00A699]">Portfolio highlight</p>
              <h3 className="mt-1 text-lg font-extrabold leading-snug text-slate-950">{section.title || 'Company highlight'}</h3>
              {section.body ? (
                <p className="mt-2 text-sm leading-6 text-slate-600">{section.body}</p>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content: Products & About */}
        <div className="lg:col-span-2 space-y-8">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className={tabsListClass}>
              <TabsTrigger value="products" className={tabsTriggerClass}>Products</TabsTrigger>
              <TabsTrigger value="services" className={tabsTriggerClass}>Services</TabsTrigger>
              <TabsTrigger value="about" className={tabsTriggerClass}>About Company</TabsTrigger>
              {isBuyer && <TabsTrigger value="my-leads" className={tabsTriggerClass}><MessageSquare className="w-4 h-4 mr-2" />My Leads</TabsTrigger>}
              <TabsTrigger value="reviews" className={tabsTriggerClass}>Reviews</TabsTrigger>
            </TabsList>

            <TabsContent value="products" className="pt-6">
              {displayProducts && displayProducts.length > 0 ? (
                <div className={catalogueShellClass}>
                  <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase text-[#00A699]">
                        {isPremiumProfile ? 'Premium catalogue' : 'Product catalogue'}
                      </p>
                      <h2 className={`${isPremiumProfile ? 'text-xl sm:text-2xl' : 'text-2xl'} font-extrabold text-slate-950`}>
                        Products by {displayVendor.company_name}
                      </h2>
                    </div>
                    <p className="text-sm font-medium text-slate-500">{productCount} listed item{productCount === 1 ? '' : 's'}</p>
                  </div>

                  <div className={`${isPremiumProfile ? 'gap-3' : 'gap-5'} grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3`}>
                    {visibleProducts.map(product => (
                      <Card
                        key={product.id}
                        className={`group cursor-pointer overflow-hidden bg-white transition-all hover:-translate-y-0.5 hover:shadow-lg ${
                          isPremiumProfile
                            ? 'border-slate-200 shadow-sm hover:border-[#00A699]'
                            : 'border-slate-200 hover:border-[#00A699]'
                        }`}
                        onClick={() => handleOpenProduct(product)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            handleOpenProduct(product);
                          }
                        }}
                      >
                        <div className={`${isPremiumProfile ? 'h-32' : 'h-44'} relative overflow-hidden bg-slate-100`}>
                          <img
                            src={getProductImage(product)}
                            alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          {isPremiumProfile ? (
                            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-slate-950/55 to-transparent" />
                          ) : null}
                          <div className="absolute left-3 top-3">
                            <Badge variant="secondary" className={`${isPremiumProfile ? 'bg-white text-slate-950' : 'bg-white/95 text-slate-800'} text-[11px] font-semibold shadow-sm`}>
                              {product.category || product.micro_category_name || 'Product'}
                            </Badge>
                          </div>
                        </div>
                        <Card.Content className={isPremiumProfile ? 'p-3' : 'p-4'}>
                          <h3 className={`${isPremiumProfile ? 'mb-2 min-h-[38px]' : 'mb-3 min-h-[42px]'} text-sm font-bold leading-5 text-slate-950 line-clamp-2`}>{product.name}</h3>
                          <div className={`${isPremiumProfile ? 'pt-2' : 'pt-3'} flex items-center justify-between gap-3 border-t border-slate-100`}>
                            <span className="text-sm font-extrabold text-[#003D82]">{product.price || 'Get latest price'}</span>
                            <Button
                              size="sm"
                              className={`${isPremiumProfile ? 'bg-[#00A699] hover:bg-[#008c81]' : 'bg-slate-950 hover:bg-[#003D82]'} h-8 shrink-0 px-3 text-xs`}
                              onClick={(event) => {
                                event.stopPropagation();
                                handleEnquire(product);
                              }}
                            >
                              Enquire
                            </Button>
                          </div>
                        </Card.Content>
                      </Card>
                    ))}
                  </div>

                  {displayProducts.length > 6 && !showAllProducts && (
                    <div className="flex justify-center mt-6">
                      <Button variant="outline" className="border-slate-300 bg-white" onClick={() => setShowAllProducts(true)}>
                        View all products ({displayProducts.length}) <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  {showAllProducts && displayProducts.length > 6 && (
                    <div className="flex justify-center mt-3">
                      <Button variant="ghost" onClick={() => setShowAllProducts(false)}>
                        Show fewer products
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <Card>
                  <Card.Content className="p-6 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-3">
                      <Globe className="h-12 w-12 text-gray-300" />
                      <p>No products available yet</p>
                    </div>
                  </Card.Content>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="services" className="pt-6">
              {hasCollections ? (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {visibleCollections.map((col) => {
                      const previewImage = col.items?.[0]?.image || 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=300&q=80';
                      return (
                        <Card
                          key={col.key}
                          className={`overflow-hidden hover:shadow-md transition-shadow cursor-pointer border ${selectedCollectionKey === col.key ? 'border-[#00A699]' : 'border-gray-200'}`}
                          onClick={() => setSelectedCollectionKey(col.key)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSelectedCollectionKey(col.key);
                            }
                          }}
                        >
                          <div className="h-20 bg-gray-100 relative overflow-hidden">
                            <img src={previewImage} alt={col.subName} className="w-full h-full object-cover" />
                          </div>
                          <Card.Content className="p-2.5">
                            <div className="text-[11px] font-semibold text-gray-900 line-clamp-1">{col.subName}</div>
                            <div className="text-[10px] text-gray-500 line-clamp-1">{col.headName}</div>
                            <div className="mt-2 flex items-center justify-between">
                              <Badge variant="secondary" className="text-[10px]">{col.items.length} item(s)</Badge>
                              <span className="text-[10px] text-[#00A699]">View</span>
                            </div>
                          </Card.Content>
                        </Card>
                      );
                    })}
                  </div>
                  {collectionList.length > 6 && !showAllServiceCollections && (
                    <div className="flex justify-center">
                      <Button variant="outline" onClick={() => setShowAllServiceCollections(true)}>
                        View all services ({collectionList.length})
                      </Button>
                    </div>
                  )}
                  {showAllServiceCollections && collectionList.length > 6 && (
                    <div className="flex justify-center">
                      <Button variant="ghost" onClick={() => setShowAllServiceCollections(false)}>
                        Show fewer services
                      </Button>
                    </div>
                  )}

                  <Dialog open={!!selectedCollection} onOpenChange={(open) => { if (!open) setSelectedCollectionKey(''); }}>
                    <DialogContent className="w-[60vw]">
                      <DialogHeader>
                        <DialogTitle className="text-base">
                          {selectedCollection?.subName}
                        </DialogTitle>
                        <p className="text-xs text-gray-500">{selectedCollection?.headName}</p>
                      </DialogHeader>
                      {selectedCollection && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {selectedCollection.items.map(product => (
                            <Card key={product.id} className="overflow-hidden hover:shadow-md transition-shadow group cursor-pointer">
                              <div className="h-24 bg-gray-100 relative overflow-hidden">
                                <img
                                  src={product.image || 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=300&q=80'}
                                  alt={product.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <Card.Content className="p-2.5">
                                <Badge variant="outline" className="mb-1.5 text-[10px]">
                                  {product.micro_category_name || product.sub_category_name || product.category}
                                </Badge>
                                <h3 className="font-semibold text-xs text-gray-900 mb-1 line-clamp-2">{product.name}</h3>
                                <div className="flex justify-between items-center mt-1.5">
                                  <span className="font-semibold text-[#003D82] text-xs">{product.price}</span>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    className="h-6 px-2 text-[10px]"
                                    onClick={() => handleEnquire(product)}
                                  >
                                    Enquire
                                  </Button>
                                </div>
                              </Card.Content>
                            </Card>
                          ))}
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                </div>
              ) : (
                <Card>
                  <Card.Content className="p-6 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-3">
                      <Wrench className="h-12 w-12 text-gray-300" />
                      <p>No collections available yet</p>
                    </div>
                  </Card.Content>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="about" className="pt-6">
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 bg-slate-950 px-6 py-5 text-white">
                  <p className="text-xs font-semibold uppercase text-[#00A699]">Company overview</p>
                  <h3 className="mt-1 text-2xl font-extrabold">About {displayVendor.company_name}</h3>
                </div>
                <div className="p-6">
                  <div className="mb-6 grid gap-5 lg:grid-cols-[1fr_240px]">
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-slate-500">Business Description</p>
                      <p className="text-base leading-7 text-slate-700">
                      {displayVendor.description || 'Description not provided'}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-950">
                        <ShieldCheck className="h-5 w-5 text-[#00A699]" />
                        Profile confidence
                      </div>
                      <div className="mt-4 space-y-3 text-sm text-slate-600">
                        <div className="flex items-center justify-between gap-4">
                          <span>Verification</span>
                          <span className="font-semibold text-slate-950">{hasPlanVerifiedSignal ? 'Verified profile' : 'Listed'}</span>
                        </div>
                        {planBadgeLabel ? (
                          <div className="flex items-center justify-between gap-4">
                            <span>Plan badge</span>
                            <span className="font-semibold text-slate-950">{planBadgeLabel}</span>
                          </div>
                        ) : null}
                        {certificateMeta?.title ? (
                          <div className="flex items-center justify-between gap-4">
                            <span>Certificate</span>
                            <span className="text-right font-semibold text-slate-950">{certificateMeta.title}</span>
                          </div>
                        ) : null}
                        <div className="flex items-center justify-between gap-4">
                          <span>Products</span>
                          <span className="font-semibold text-slate-950">{productCount}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span>Collections</span>
                          <span className="font-semibold text-slate-950">{serviceCount}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {displayVendor.highlights?.length ? (
                    <div className="mb-6 space-y-2">
                      <p className="text-sm font-semibold text-slate-500">Brand Highlights</p>
                      <div className="flex flex-wrap gap-2">
                        {displayVendor.highlights.map((item) => (
                          <Badge key={item} variant="outline" className="border-[#00A699]/25 bg-[#00A699]/5 text-slate-700">
                            {item}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="rounded-lg border border-slate-200 p-4">
                      <Factory className="mb-3 h-5 w-5 text-[#003D82]" />
                      <p className="mb-1 text-sm text-slate-500">Business Type</p>
                      <p className="font-semibold text-slate-950">{displayVendor.primary_business_type || 'Manufacturer, Supplier'}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-4">
                      <CalendarDays className="mb-3 h-5 w-5 text-[#003D82]" />
                      <p className="mb-1 text-sm text-slate-500">Established</p>
                      <p className="font-semibold text-slate-950">{displayVendor.established || 'Not specified'}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-4">
                      <BadgeCheck className="mb-3 h-5 w-5 text-[#003D82]" />
                      <p className="mb-1 text-sm text-slate-500">GST Number</p>
                      <p className="font-semibold text-slate-950">{displayVendor.gst || 'N/A'}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-4">
                      <Briefcase className="mb-3 h-5 w-5 text-[#003D82]" />
                      <p className="mb-1 text-sm text-slate-500">Annual Turnover</p>
                      <p className="font-semibold text-slate-950">{displayVendor.annual_turnover || 'Not provided'}</p>
                    </div>
                    {displayVendor.legal_company_name && displayVendor.legal_company_name !== displayVendor.company_name ? (
                      <div className="rounded-lg border border-slate-200 p-4">
                        <Building2 className="mb-3 h-5 w-5 text-[#003D82]" />
                        <p className="mb-1 text-sm text-slate-500">Legal Entity</p>
                        <p className="font-semibold text-slate-950">{displayVendor.legal_company_name}</p>
                      </div>
                    ) : null}
                    {displayVendor.website ? (
                      <div className="rounded-lg border border-slate-200 p-4">
                        <Globe className="mb-3 h-5 w-5 text-[#003D82]" />
                        <p className="mb-1 text-sm text-slate-500">Website</p>
                        <a
                          href={displayVendor.website}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 break-all font-semibold text-[#003D82] hover:underline"
                        >
                          {displayVendor.website} <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                        </a>
                      </div>
                    ) : null}
                    {displayVendor.email ? (
                      <div className="rounded-lg border border-slate-200 p-4">
                        <Mail className="mb-3 h-5 w-5 text-[#003D82]" />
                        <p className="mb-1 text-sm text-slate-500">Email</p>
                        <p className="break-all font-semibold text-slate-950">{displayVendor.email}</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="my-leads" className="pt-6">
              <Card>
                <Card.Content className="p-6">
                  {leads.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      <MessageSquare className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                      <p>No leads submitted yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {leads.map(lead => (
                        <div key={lead.id} className="border rounded-lg p-4 hover:bg-gray-50">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-semibold text-gray-900">{lead.title}</h4>
                            <Badge className={`${lead.status === 'AVAILABLE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{lead.status}</Badge>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{lead.description}</p>
                          <div className="grid grid-cols-2 gap-4 text-sm text-gray-500">
                            <div>
                              <span className="font-medium">Category:</span> {lead.category}
                            </div>
                            {lead.budget && (
                              <div>
                                <span className="font-medium">Budget:</span> {lead.budget}
                              </div>
                            )}
                          </div>
                          <div className="text-xs text-gray-400 mt-2">
                            Created: {new Date(lead.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card.Content>
              </Card>
            </TabsContent>

            <TabsContent value="reviews" className="pt-6">
              <Card>
                <Card.Content className="p-6 text-center text-gray-500">
                  <Star className={`h-12 w-12 mx-auto mb-3 ${displayVendor.reviews > 0 ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                  {displayVendor.reviews > 0 ? (
                    <>
                      <p className="text-lg font-semibold text-gray-900">
                        {Number(displayVendor.rating || 0).toFixed(1)} / 5
                      </p>
                      <p>{displayVendor.reviews} buyer {displayVendor.reviews === 1 ? 'rating' : 'ratings'} across listed services.</p>
                    </>
                  ) : (
                    <p>No detailed reviews available yet.</p>
                  )}
                </Card.Content>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar: Contact Info */}
        <aside className="space-y-6 lg:col-span-1">
          <div className={contactPanelClass}>
            <div className={contactHeaderClass}>
              <p className="text-xs font-semibold uppercase text-[#00A699]">Business enquiry desk</p>
              <h3 className={`${isPremiumProfile ? 'text-lg leading-snug' : 'text-xl'} mt-1 line-clamp-2 font-extrabold`}>
                {isPremiumProfile ? `Contact ${displayVendor.company_name}` : 'Contact Supplier'}
              </h3>
              <p className={`${isPremiumProfile ? 'text-slate-600' : 'text-slate-300'} mt-1.5 ${isPremiumProfile ? 'text-xs' : 'text-sm'}`}>
                Send a requirement and connect with the supplier team.
              </p>
            </div>

            <div className={contactBodyClass}>
              <div className={contactItemClass}>
                <div className={`${contactIconWrapClass} bg-blue-50`}><User className={`${contactIconClass} text-blue-600`} /></div>
                <div>
                  <p className={contactLabelClass}>Contact Person</p>
                  <p className={contactValueClass}>{displayVendor.name || 'Contact'}</p>
                </div>
              </div>

              <div className={contactItemClass}>
                <div className={`${contactIconWrapClass} bg-green-50`}><Phone className={`${contactIconClass} text-green-600`} /></div>
                <div>
                  <p className={contactLabelClass}>Mobile Number</p>
                  <p className="font-semibold text-green-700">{displayVendor.phone ? maskPhoneNumber(displayVendor.phone) : '+91-XXXXXXXXXX'}</p>
                </div>
              </div>

              <div className={contactItemClass}>
                <div className={`${contactIconWrapClass} bg-purple-50`}><Building2 className={`${contactIconClass} text-purple-600`} /></div>
                <div>
                  <p className={contactLabelClass}>Address</p>
                  <p className={`${contactValueClass} text-sm`}>{displayVendor.address || 'Address'}</p>
                  <p className={contactSubTextClass}>{displayVendor.city || 'City'}, {displayVendor.state || 'State'}</p>
                </div>
              </div>

              {displayVendor.email ? (
                <div className={contactItemClass}>
                  <div className={`${contactIconWrapClass} bg-amber-50`}><Mail className={`${contactIconClass} text-amber-600`} /></div>
                  <div>
                    <p className={contactLabelClass}>Email</p>
                    <p className={`${contactValueClass} break-all text-sm`}>{displayVendor.email}</p>
                  </div>
                </div>
              ) : null}

              {displayVendor.website ? (
                <div className={contactItemClass}>
                  <div className={`${contactIconWrapClass} bg-indigo-50`}><Globe className={`${contactIconClass} text-indigo-600`} /></div>
                  <div>
                    <p className={contactLabelClass}>Website</p>
                    <a
                      href={displayVendor.website}
                      target="_blank"
                      rel="noreferrer"
                      className={`${isPremiumProfile ? 'text-[#00A699]' : 'text-[#003D82]'} inline-flex items-center gap-1 break-all text-sm font-semibold hover:underline`}
                    >
                      {displayVendor.website} <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    </a>
                  </div>
                </div>
              ) : null}

              <div className={`${isPremiumProfile ? 'space-y-2 pt-1.5' : 'space-y-3 pt-2'}`}>
                <Button className={`${isPremiumProfile ? 'h-9 bg-[#00A699] text-sm hover:bg-[#008c81]' : 'h-11 bg-[#003D82] hover:bg-[#002f66]'} w-full`} onClick={handleVendorEnquiry} disabled={!vendorRecordId}>
                  <Send className="mr-2 h-4 w-4" />
                  Contact Supplier
                </Button>
                <Button
                  variant="outline"
                  className={`${isPremiumProfile ? 'h-9 border-slate-300 bg-white text-sm text-slate-800 hover:bg-slate-50' : 'h-11 border-slate-300 bg-white'} w-full`}
                  disabled={!vendorRecordId}
                  onClick={() =>
                    toast({
                      title: 'Lead confirmation required',
                      description: 'Number show after lead confirm.',
                    })
                  }
                >
                  <Phone className="mr-2 h-4 w-4" />
                  Request phone number
                </Button>
              </div>
            </div>
          </div>

          <div className={`${isPremiumProfile ? 'border-emerald-100 bg-emerald-50 text-emerald-950 shadow-sm' : 'border-emerald-100 bg-emerald-50'} rounded-xl border p-6`}>
            <div className={`${isPremiumProfile ? 'text-emerald-950' : 'text-emerald-950'} mb-3 flex items-center gap-2 font-bold`}>
              <ShieldCheck className="h-5 w-5 text-emerald-700" />
              Safe Trading Guide
            </div>
            <ul className={`${isPremiumProfile ? 'text-emerald-900' : 'text-emerald-900'} space-y-2 text-sm`}>
              <li className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" />Check verified badge before dealing</li>
              <li className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" />Always communicate via portal</li>
              <li className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" />Never pay to personal bank accounts</li>
            </ul>
          </div>
        </aside>
      </div>
      </div>
    </div>
  );
};

const VendorProfile = () => (
  <VendorProfileErrorBoundary>
    <VendorProfileContent />
  </VendorProfileErrorBoundary>
);

export default VendorProfile;
