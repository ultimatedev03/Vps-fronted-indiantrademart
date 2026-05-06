import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { BadgeCheck, MapPin, Send, Star, Phone, Globe, Building2, User, MessageSquare, Wrench, Mail } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Card from '@/shared/components/Card';
import { Badge } from '@/shared/components/Badge';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchWithCsrf } from '@/lib/fetchWithCsrf';
import { apiUrl } from '@/lib/apiBase';
import { toast } from '@/components/ui/use-toast';
import { getVendorProfilePath } from '@/shared/utils/vendorRoutes';
import { getProductDetailPath } from '@/shared/utils/productRoutes';
import { phoneUtils } from '@/shared/utils/phoneUtils';
import {
  getPremiumBrandBySlug,
  getPremiumBrandByVendorSlug,
  getPremiumBrandFallbackOfferings,
  getPremiumBrandProfileSlug,
  shouldUsePremiumBrandFallbackContent,
} from '@/modules/directory/lib/premiumBrands';

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
        <div className="container mx-auto px-4 py-8 max-w-4xl">
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
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'products');
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [selectedCollectionKey, setSelectedCollectionKey] = useState('');
  const [showAllServiceCollections, setShowAllServiceCollections] = useState(false);
  const requestedVendorKey = String(vendorSlugOrId || '').trim();
  const vendorRecordId = String(vendor?.id || '').trim();

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
        toast({ title: 'Removed from Favorites' });
      } else {
        const res = await fetchWithCsrf(apiUrl(`/api/vendors/${vendorRecordId}/favorite`), {
          method: 'POST',
        });
        if (!res.ok) throw new Error('Failed to add favorite');

        setIsFavorite(true);
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

  const displayVendor = useMemo(
    () => vendor || buildPremiumBrandFallbackVendor(requestedPremiumBrand),
    [vendor, requestedPremiumBrand]
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
      navigate('/buyer/login');
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

    navigate('/buyer/login');
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
      <div className="container mx-auto px-4 py-8 space-y-6">
        <Skeleton className="h-64 w-full rounded-xl" />
        <div className="grid grid-cols-4 gap-6">
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
      <div className="container mx-auto px-4 py-8 max-w-4xl">
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
    <div className="container mx-auto px-4 py-8 max-w-7xl font-sans">

      {/* Hero / Header Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
        <div className="bg-[#003D82] h-24 w-full"></div>
        <div className="px-8 pb-8">
          <div className="relative -mt-10 flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start">
              <div className="h-24 w-24 rounded-lg bg-white p-1 shadow-md border border-gray-100 overflow-hidden">
                {displayVendor.profile_image ? (
                  <img src={displayVendor.profile_image} alt={displayVendor.company_name} className="h-full w-full object-cover rounded" />
                ) : (
                  <div className="h-full w-full bg-gray-100 rounded flex items-center justify-center text-2xl font-bold text-[#003D82]">
                    {displayVendor.company_name?.charAt(0) || 'V'}
                  </div>
                )}
              </div>
              <div className="min-w-0 pt-1">
                <h1 className="inline-flex w-fit flex-wrap items-center gap-2 rounded-lg bg-slate-950/30 px-3 py-2 text-3xl font-bold text-white shadow-sm backdrop-blur-sm">
                  {displayVendor.company_name || 'Company Name'}
                  {displayVendor.verified && <BadgeCheck className="text-blue-500 h-6 w-6 fill-blue-50" />}
                </h1>
                {displayVendor.brand_slug ? (
                  <div className="mt-2">
                    <Badge variant="outline" className="border-white/50 bg-white/10 text-white">
                      Premium Brand
                    </Badge>
                  </div>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" /> {displayVendor.city || 'City'}{displayVendor.state ? `, ${displayVendor.state}` : ''}
                  </span>
                  <span className="flex items-center gap-1">
                    <Star className="h-4 w-4 text-orange-400 fill-orange-400" /> {displayVendor.rating || 4.0} ({displayVendor.reviews || 0} Reviews)
                  </span>
                </div>
                {displayVendor.tagline ? (
                  <p className="mt-3 max-w-2xl text-sm text-slate-600">
                    {displayVendor.tagline}
                  </p>
                ) : null}
              </div>
            </div>

            {/* ✅ ACTIONS */}
            <div className="flex w-full flex-wrap gap-3 xl:w-auto xl:justify-end">
              {/* ✅ Favorite Button */}
              <Button
                variant="outline"
                className={`border-gray-300 ${isFavorite ? 'bg-yellow-50' : ''}`}
                onClick={toggleFavorite}
                disabled={favLoading || !vendorRecordId}
                title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Star
                  className={`h-4 w-4 mr-2 ${isFavorite ? 'text-yellow-500' : ''}`}
                  fill={isFavorite ? 'currentColor' : 'none'}
                />
                {isFavorite ? 'Favorited' : 'Add Favorite'}
              </Button>

              <Button
                variant="outline"
                className="border-gray-300"
                disabled={!vendorRecordId}
                onClick={() =>
                  toast({
                    title: 'Lead confirmation required',
                    description: 'Number show after lead confirm.',
                  })
                }
              >
                <Phone className="h-4 w-4 mr-2" /> View Number
              </Button>

              <Button
                className="bg-[#00A699] hover:bg-[#008c81]"
                disabled={!vendorRecordId}
                onClick={handleVendorEnquiry}
              >
                <Send className="h-4 w-4 mr-2" /> Send Enquiry
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content: Products & About */}
        <div className="lg:col-span-2 space-y-8">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full justify-start border-b rounded-none p-0 h-auto bg-transparent gap-6">
              <TabsTrigger value="products" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#00A699] data-[state=active]:shadow-none px-4 py-3 text-base">Products</TabsTrigger>
              <TabsTrigger value="services" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#00A699] data-[state=active]:shadow-none px-4 py-3 text-base">Services</TabsTrigger>
              <TabsTrigger value="about" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#00A699] data-[state=active]:shadow-none px-4 py-3 text-base">About Company</TabsTrigger>
              {isBuyer && <TabsTrigger value="my-leads" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#00A699] data-[state=active]:shadow-none px-4 py-3 text-base"><MessageSquare className="w-4 h-4 mr-2" />My Leads</TabsTrigger>}
              <TabsTrigger value="reviews" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#00A699] data-[state=active]:shadow-none px-4 py-3 text-base">Reviews</TabsTrigger>
            </TabsList>

            <TabsContent value="products" className="pt-6">
              {displayProducts && displayProducts.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {visibleProducts.map(product => (
                      <Card
                        key={product.id}
                        className="overflow-hidden hover:shadow-md transition-shadow group cursor-pointer"
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
                        <div className="h-24 bg-gray-100 relative overflow-hidden">
                          <img
                            src={product.image || 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=300&q=80'}
                            alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                        <Card.Content className="p-2.5">
                          <Badge variant="outline" className="mb-1.5 text-[10px]">
                            {product.category}
                          </Badge>
                          <h3 className="font-semibold text-xs text-gray-900 mb-1 line-clamp-2">{product.name}</h3>
                          <div className="flex justify-between items-center mt-1.5">
                            <span className="font-semibold text-[#003D82] text-xs">{product.price}</span>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-6 px-2 text-[10px]"
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
                      <Button variant="outline" onClick={() => setShowAllProducts(true)}>
                        View all products ({displayProducts.length})
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
                </>
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
                    <DialogContent className="max-w-4xl">
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
              <Card>
                <Card.Content className="p-6">
                  <h3 className="text-xl font-bold mb-4">About {displayVendor.company_name}</h3>
                  <div className="mb-6 space-y-2">
                    <p className="text-sm text-gray-500 font-medium">Business Description</p>
                    <p className="text-gray-600 leading-relaxed">
                      {displayVendor.description || 'Description not provided'}
                    </p>
                  </div>

                  {displayVendor.highlights?.length ? (
                    <div className="mb-6 space-y-2">
                      <p className="text-sm text-gray-500 font-medium">Brand Highlights</p>
                      <div className="flex flex-wrap gap-2">
                        {displayVendor.highlights.map((item) => (
                          <Badge key={item} variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                            {item}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Business Type</p>
                      <p className="font-medium">{displayVendor.primary_business_type || 'Manufacturer, Supplier'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Established</p>
                      <p className="font-medium">{displayVendor.established || 'Not specified'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">GST Number</p>
                      <p className="font-medium">{displayVendor.gst || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Annual Turnover</p>
                      <p className="font-medium">{displayVendor.annual_turnover || 'Not provided'}</p>
                    </div>
                    {displayVendor.legal_company_name && displayVendor.legal_company_name !== displayVendor.company_name ? (
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Legal Entity</p>
                        <p className="font-medium">{displayVendor.legal_company_name}</p>
                      </div>
                    ) : null}
                    {displayVendor.website ? (
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Website</p>
                        <a
                          href={displayVendor.website}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-[#003D82] hover:underline break-all"
                        >
                          {displayVendor.website}
                        </a>
                      </div>
                    ) : null}
                    {displayVendor.email ? (
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Email</p>
                        <p className="font-medium break-all">{displayVendor.email}</p>
                      </div>
                    ) : null}
                  </div>
                </Card.Content>
              </Card>
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
                  <Star className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                  <p>No detailed reviews available yet.</p>
                </Card.Content>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar: Contact Info */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <Card.Content className="p-6 space-y-4">
              <h3 className="font-bold text-gray-900 border-b pb-2">Contact Details</h3>

              <div className="flex gap-3 items-start">
                <div className="bg-blue-50 p-2 rounded-lg"><User className="h-5 w-5 text-blue-600" /></div>
                <div>
                  <p className="text-xs text-gray-500">Contact Person</p>
                  <p className="font-medium">{displayVendor.name || 'Contact'}</p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <div className="bg-green-50 p-2 rounded-lg"><Phone className="h-5 w-5 text-green-600" /></div>
                <div>
                  <p className="text-xs text-gray-500">Mobile Number</p>
                  <p className="font-medium text-green-700">{displayVendor.phone ? maskPhoneNumber(displayVendor.phone) : '+91-XXXXXXXXXX'}</p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <div className="bg-purple-50 p-2 rounded-lg"><Building2 className="h-5 w-5 text-purple-600" /></div>
                <div>
                  <p className="text-xs text-gray-500">Address</p>
                  <p className="font-medium text-sm">{displayVendor.address || 'Address'}</p>
                  <p className="text-sm text-gray-600">{displayVendor.city || 'City'}, {displayVendor.state || 'State'}</p>
                </div>
              </div>

              {displayVendor.email ? (
                <div className="flex gap-3 items-start">
                  <div className="bg-amber-50 p-2 rounded-lg"><Mail className="h-5 w-5 text-amber-600" /></div>
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    <p className="font-medium text-sm break-all">{displayVendor.email}</p>
                  </div>
                </div>
              ) : null}

              {displayVendor.website ? (
                <div className="flex gap-3 items-start">
                  <div className="bg-indigo-50 p-2 rounded-lg"><Globe className="h-5 w-5 text-indigo-600" /></div>
                  <div>
                    <p className="text-xs text-gray-500">Website</p>
                    <a
                      href={displayVendor.website}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-sm break-all text-[#003D82] hover:underline"
                    >
                      {displayVendor.website}
                    </a>
                  </div>
                </div>
              ) : null}

              <div className="pt-2">
                <Button className="w-full bg-[#003D82]" onClick={handleVendorEnquiry} disabled={!vendorRecordId}>
                  Contact Supplier
                </Button>
              </div>
            </Card.Content>
          </Card>

          <Card className="bg-gradient-to-br from-indigo-50 to-white border-indigo-100">
            <Card.Content className="p-6">
              <h3 className="font-bold text-indigo-900 mb-2">Safe Trading Guide</h3>
              <ul className="text-sm text-indigo-800 space-y-2 list-disc pl-4">
                <li>Check verified badge before dealing</li>
                <li>Always communicate via portal</li>
                <li>Never pay to personal bank accounts</li>
              </ul>
            </Card.Content>
          </Card>
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
