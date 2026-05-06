import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { directoryApi } from '@/modules/directory/api/directoryApi';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  MapPin,
  Building2,
  CheckCircle,
  Phone,
  Mail,
  FileText,
  PlayCircle,
  MessageCircle,
  Facebook,
  Linkedin,
  Twitter,
  Link as LinkIcon,
  Check,
  Heart,
  Star,
} from 'lucide-react';
import { shareUtils } from '@/shared/utils/shareUtils';
import { phoneUtils } from '@/shared/utils/phoneUtils';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { productFavorites } from '@/modules/buyer/services/productFavorites';
import { productRatings, PRODUCT_RATINGS_UPDATED_EVENT } from '@/shared/services/productRatings';
import { fetchWithCsrf } from '@/lib/fetchWithCsrf';
import { apiUrl } from '@/lib/apiBase';
import TurnstileField from '@/shared/components/TurnstileField';
import { useCaptchaGate } from '@/shared/hooks/useCaptchaGate';
import { getProductDetailPath, getProductDetailUrl } from '@/shared/utils/productRoutes';
import { stripLegacyRandomSlugSuffix } from '@/shared/utils/slugUtils';
import { getVendorProfilePath } from '@/shared/utils/vendorRoutes';

const ProductDetail = () => {
  const { productSlug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userRole, vendorId: currentVendorId } = useAuth();
  const enquiryCaptcha = useCaptchaGate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [isDraft, setIsDraft] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favLoading, setFavLoading] = useState(false);
  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
  const [ratingDraft, setRatingDraft] = useState(0);
  const [feedbackDraft, setFeedbackDraft] = useState('');
  const [savingRating, setSavingRating] = useState(false);
  const [myRating, setMyRating] = useState(0);
  const [myRatingUpdatedAt, setMyRatingUpdatedAt] = useState('');
  const [ratingSummary, setRatingSummary] = useState({ average: 0, count: 0 });
  const [recentFeedback, setRecentFeedback] = useState([]);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const isBuyer = String(userRole || user?.role || '').toUpperCase() === 'BUYER';

  // Enquiry modal
  const [enquiryOpen, setEnquiryOpen] = useState(false);
  const [sendingEnquiry, setSendingEnquiry] = useState(false);
  const [enquiry, setEnquiry] = useState({
    quantity: '',
    unit: 'pieces',
    budget: '',
    requirement: '',
  });
  const canonicalProductUrl = useMemo(
    () => getProductDetailUrl(data || productSlug),
    [data, productSlug]
  );

  const unitOptions = useMemo(
    () => [
      { value: 'pieces', label: 'Pieces' },
      { value: 'kg', label: 'Kg' },
      { value: 'gram', label: 'Gram' },
      { value: 'ton', label: 'Ton' },
      { value: 'liter', label: 'Liter' },
      { value: 'meter', label: 'Meter' },
      { value: 'feet', label: 'Feet' },
      { value: 'sqft', label: 'Sq Ft' },
      { value: 'sqm', label: 'Sq M' },
      { value: 'hours', label: 'Hours' },
      { value: 'days', label: 'Days' },
      { value: 'service', label: 'Service' },
      { value: 'lot', label: 'Lot' },
    ],
    []
  );

  // ✅ Helpers to partially mask contact info (SEO/Privacy friendly)
  const maskEmail = (email) => {
    const e = String(email || '').trim();
    if (!e.includes('@')) return e;

    const [local, domain] = e.split('@');
    const safeLocal = local || '';
    const safeDomain = domain || '';

    const maskPart = (part) => {
      const p = String(part || '');
      if (p.length <= 2) return p[0] ? `${p[0]}*` : '*';
      return `${p[0]}${'*'.repeat(Math.min(6, p.length - 2))}${p[p.length - 1]}`;
    };

    const domainParts = safeDomain.split('.');
    const d0 = domainParts[0] || '';
    const rest = domainParts.slice(1).join('.') || '';
    return `${maskPart(safeLocal)}@${maskPart(d0)}${rest ? `.${rest}` : ''}`;
  };

  const parseBudgetNumber = (rawValue) => {
    const raw = String(rawValue || '').trim().toLowerCase();
    if (!raw) return null;

    const compact = raw.replace(/[^0-9a-z.]/g, '');
    let multiplier = 1;
    let numericPart = compact;

    if (compact.endsWith('crore')) {
      multiplier = 10000000;
      numericPart = compact.slice(0, -5);
    } else if (compact.endsWith('cr')) {
      multiplier = 10000000;
      numericPart = compact.slice(0, -2);
    } else if (compact.endsWith('lakh')) {
      multiplier = 100000;
      numericPart = compact.slice(0, -4);
    } else if (compact.endsWith('lac')) {
      multiplier = 100000;
      numericPart = compact.slice(0, -3);
    } else if (compact.endsWith('lk')) {
      multiplier = 100000;
      numericPart = compact.slice(0, -2);
    } else if (compact.endsWith('k')) {
      multiplier = 1000;
      numericPart = compact.slice(0, -1);
    }

    const numeric = Number(numericPart);
    if (!Number.isFinite(numeric) || numeric <= 0) return null;
    return numeric * multiplier;
  };

  const formatDateTime = (value) => {
    if (!value) return '';
    const stamp = new Date(value);
    if (Number.isNaN(stamp.getTime())) return '';
    return stamp.toLocaleString([], {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPlainDescription = (value) =>
    String(value || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();

  const formatPrice = (value) => {
    const raw = String(value ?? '').trim();
    if (!raw) return 'Price on request';
    const numeric = Number(raw);
    if (!Number.isFinite(numeric)) return `₹${raw}`;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: numeric % 1 === 0 ? 0 : 2,
    }).format(numeric);
  };

  const getProductUnit = (product) => product?.qty_unit || product?.price_unit || product?.unit || 'Piece';

  const normalizeSpecifications = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) {
      return value
        .map((item) => {
          if (!item) return null;
          if (typeof item === 'string') return { key: 'Detail', value: item };
          const key = item.key || item.name || item.label || item.title || '';
          const specValue = item.value || item.description || item.text || '';
          if (!key && !specValue) return null;
          return { key: key || 'Detail', value: specValue || '-' };
        })
        .filter(Boolean);
    }
    if (typeof value === 'object') {
      return Object.entries(value)
        .map(([key, specValue]) => ({ key, value: specValue }))
        .filter((item) => item.key && item.value !== undefined && item.value !== null && item.value !== '');
    }
    return [];
  };

  const plainDescription = useMemo(() => getPlainDescription(data?.description), [data?.description]);

  useEffect(() => {
    setDescriptionExpanded(false);
  }, [data?.id]);

  const handleCopyLink = async () => {
    const url = canonicalProductUrl || shareUtils.getCurrentUrl();
    const success = await shareUtils.copyToClipboard(url);
    if (success) {
      setCopied(true);
      toast({ title: 'Link copied to clipboard!', description: 'Share the link with anyone' });
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast({ title: 'Failed to copy', description: 'Please try again', variant: 'destructive' });
    }
  };

  const openEnquiryModal = () => {
    // Check if user is logged in
    if (!user) {
      toast({
        title: 'Please Login',
        description: 'You need to login as a buyer to send enquiry',
        variant: 'destructive',
      });
      navigate('/buyer/login');
      return;
    }

    // Check if user is a buyer
    const role = String(userRole || user?.role || '').toUpperCase();
    if (role !== 'BUYER') {
      toast({
        title: 'Buyer Account Required',
        description: 'Only buyers can send enquiries',
        variant: 'destructive',
      });
      return;
    }

    // Reset form every time modal opens
    setEnquiry({ quantity: '', unit: 'pieces', budget: '', requirement: '' });
    enquiryCaptcha.resetCaptcha();
    setEnquiryOpen(true);
  };

  const handleSubmitEnquiry = async () => {
    if (!data?.vendors?.id) {
      toast({ title: 'Vendor not found', description: 'Please try again later', variant: 'destructive' });
      return;
    }

    const requirement = String(enquiry.requirement || '').trim();
    if (requirement.length < 10) {
      toast({
        title: 'Add requirement details',
        description: 'Please write at least 10 characters in requirement/description.',
        variant: 'destructive',
      });
      return;
    }

    const qtyRaw = String(enquiry.quantity || '').trim();
    const budgetRaw = String(enquiry.budget || '').trim();

    const safeQty = qtyRaw ? qtyRaw.replace(/[\n\r\t]/g, ' ').slice(0, 50) : null;
    const safeBudget = parseBudgetNumber(budgetRaw);
    const qtyWithUnit = safeQty ? `${safeQty} ${enquiry.unit || 'pieces'}`.trim() : null;

    const buyerEmail = user?.email || '';
    const buyerName =
      user?.user_metadata?.company_name ||
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      (buyerEmail ? buyerEmail.split('@')[0] : 'Buyer');
    const buyerPhone =
      user?.user_metadata?.phone ||
      user?.user_metadata?.mobile ||
      '';
    const buyerCompany = user?.user_metadata?.company_name || '';

    const captchaError = enquiryCaptcha.getCaptchaError();
    if (captchaError) {
      toast({
        title: enquiryCaptcha.getCaptchaErrorTitle(),
        description: captchaError,
        variant: 'destructive',
      });
      return;
    }

    setSendingEnquiry(true);
    try {
      const payload = {
        title: data.name,
        product_name: data.name,
        product_interest: data.name,
        buyer_name: buyerName,
        buyer_email: buyerEmail,
        buyer_phone: buyerPhone,
        company_name: buyerCompany,
        description: requirement,
        message: requirement,
        quantity: qtyWithUnit,
        budget: safeBudget,
        category: data.micro_categories?.name || 'General',
        category_slug: data.micro_categories?.slug || '',
        location: data.vendors?.city ? `${data.vendors.city}, ${data.vendors.state || ''}`.trim() : null,
        captcha_token: enquiryCaptcha.captchaToken,
        captcha_action: 'lead_submit',
      };

      const response = await fetchWithCsrf(apiUrl(`/api/vendors/${data.vendors.id}/leads`), {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const responseJson = await response.json().catch(() => null);
      if (!response.ok || !responseJson?.success) {
        throw new Error(responseJson?.error || 'Failed to send enquiry');
      }

      toast({ title: 'Enquiry Sent', description: 'Your enquiry has been submitted to the vendor' });
      setEnquiryOpen(false);
      enquiryCaptcha.resetCaptcha();
      navigate(getVendorProfilePath(data?.vendors) || '/directory/vendor');
    } catch (error) {
      console.error('Error creating lead:', error);
      enquiryCaptcha.resetCaptcha();
      toast({
        title: 'Error',
        description: error?.message || 'Failed to send enquiry',
        variant: 'destructive',
      });
    } finally {
      setSendingEnquiry(false);
    }
  };

  const handleCompanyClick = () => {
    if (data?.vendors?.id) {
      navigate(getVendorProfilePath(data?.vendors) || '/directory/vendor');
    }
  };

  const favoriteProduct = useMemo(() => {
    if (!data?.id) return null;
    return {
      productId: data.id,
      slug: data.slug || productSlug || data.id,
      name: data.name || 'Service',
      price: data.price ?? null,
      images: Array.isArray(data.images) ? data.images : [],
      vendorId: data?.vendors?.id || data?.vendor_id || null,
      vendorSlug: data?.vendors?.slug || '',
      vendorName: data?.vendors?.company_name || '',
      vendorCity: data?.vendors?.city || '',
      vendorState: data?.vendors?.state || '',
    };
  }, [data, productSlug]);

  useEffect(() => {
    const productId = favoriteProduct?.productId;
    if (!productId || !user?.id || !isBuyer) {
      setIsFavorite(false);
      return;
    }
    setIsFavorite(productFavorites.isFavorite(user.id, productId));
  }, [favoriteProduct?.productId, user?.id, isBuyer]);

  const handleToggleFavorite = async () => {
    if (!favoriteProduct?.productId || favLoading) return;

    if (!user) {
      toast({ title: 'Login required', description: 'Please login as Buyer to add favorites.' });
      navigate('/buyer/login');
      return;
    }

    if (!isBuyer) {
      toast({ title: 'Buyer account required', description: 'Only buyers can save favorite services.' });
      return;
    }

    setFavLoading(true);
    try {
      const next = productFavorites.toggle(user.id, favoriteProduct);
      setIsFavorite(Boolean(next?.isFavorite));
      toast({ title: next?.isFavorite ? 'Added to Favorites' : 'Removed from Favorites' });
    } catch (e) {
      console.error('[ProductDetail] favorite toggle failed:', e);
      toast({ title: 'Failed', description: 'Could not update favorite service', variant: 'destructive' });
    } finally {
      setFavLoading(false);
    }
  };

  useEffect(() => {
    const productId = data?.id;
    if (!productId) {
      setRatingSummary({ average: 0, count: 0 });
      setMyRating(0);
      setMyRatingUpdatedAt('');
      setRecentFeedback([]);
      return;
    }

    const refreshRatings = () => {
      const summary = productRatings.getProductSummary(productId);
      const mine = user?.id ? productRatings.getUserRating(productId, user.id) : null;
      const feedbackList = productRatings
        .getProductRatings(productId)
        .filter((row) => String(row?.feedback || '').trim())
        .slice(0, 3);

      setRatingSummary(summary);
      setMyRating(mine?.rating || 0);
      setMyRatingUpdatedAt(mine?.updated_at || mine?.created_at || '');
      setRecentFeedback(feedbackList);
    };

    refreshRatings();
    if (typeof window !== 'undefined') {
      window.addEventListener(PRODUCT_RATINGS_UPDATED_EVENT, refreshRatings);
      window.addEventListener('focus', refreshRatings);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(PRODUCT_RATINGS_UPDATED_EVENT, refreshRatings);
        window.removeEventListener('focus', refreshRatings);
      }
    };
  }, [data?.id, user?.id]);

  const openRatingDialog = () => {
    if (!data?.id) return;

    if (!user) {
      toast({ title: 'Login required', description: 'Please login as Buyer to rate this service.' });
      navigate('/buyer/login');
      return;
    }

    if (!isBuyer) {
      toast({ title: 'Buyer account required', description: 'Only buyers can add ratings and feedback.' });
      return;
    }

    const mine = productRatings.getUserRating(data.id, user.id);
    setRatingDraft(mine?.rating || 0);
    setFeedbackDraft(mine?.feedback || '');
    setRatingDialogOpen(true);
  };

  const handleSaveRating = async () => {
    if (!data?.id || !user?.id) return;

    if (ratingDraft < 1 || ratingDraft > 5) {
      toast({ title: 'Select rating', description: 'Please select at least 1 star.' });
      return;
    }

    setSavingRating(true);
    try {
      const displayName =
        user?.user_metadata?.full_name ||
        user?.user_metadata?.name ||
        user?.full_name ||
        user?.email ||
        'Buyer';

      const { summary, entry } = productRatings.upsertRating({
        productId: data.id,
        userId: user.id,
        rating: ratingDraft,
        feedback: feedbackDraft,
        buyerName: displayName,
      });

      setRatingSummary(summary || { average: 0, count: 0 });
      setMyRating(entry?.rating || ratingDraft);
      setMyRatingUpdatedAt(entry?.updated_at || '');
      setRatingDialogOpen(false);
      toast({ title: 'Thanks', description: 'Your rating and feedback are saved.' });
    } catch (error) {
      console.error('[ProductDetail] save rating failed:', error);
      toast({ title: 'Failed', description: 'Could not save your rating', variant: 'destructive' });
    } finally {
      setSavingRating(false);
    }
  };

  const handleDeleteRating = async () => {
    if (!data?.id || !user?.id || !isBuyer || savingRating) return;

    setSavingRating(true);
    try {
      const { removed, summary } = productRatings.deleteRating({
        productId: data.id,
        userId: user.id,
      });

      if (!removed) {
        toast({ title: 'Nothing to delete', description: 'No rating found for this service.' });
        return;
      }

      setRatingSummary(summary || { average: 0, count: 0 });
      setMyRating(0);
      setMyRatingUpdatedAt('');
      setRatingDraft(0);
      setFeedbackDraft('');
      setRatingDialogOpen(false);
      toast({ title: 'Deleted', description: 'Your rating and feedback were removed.' });
    } catch (error) {
      console.error('[ProductDetail] delete rating failed:', error);
      toast({ title: 'Failed', description: 'Could not delete your rating', variant: 'destructive' });
    } finally {
      setSavingRating(false);
    }
  };

  const hydrateProduct = async (product) => {
    if (!product) return null;
    if (product.micro_category_id) {
      const { data: catData } = await supabase
        .from('micro_categories')
        .select(
          `
          id, name, slug,
          sub_categories (
            id, name, slug,
            head_categories (id, name, slug)
          )
        `
        )
        .eq('id', product.micro_category_id)
        .single();
      if (catData) {
        product.micro_categories = catData;

        let metaRes = await supabase
          .from('micro_category_meta')
          .select('meta_tags, description')
          .eq('micro_categories', product.micro_category_id)
          .maybeSingle();
        if (metaRes.error && (metaRes.error.code === '42703' || /column .* does not exist/i.test(metaRes.error.message || ''))) {
          metaRes = await supabase
            .from('micro_category_meta')
            .select('meta_tags, description')
            .eq('micro_category_id', product.micro_category_id)
            .maybeSingle();
        }
        if (metaRes.data) {
          product.meta_tags = metaRes.data.meta_tags;
          product.meta_description = metaRes.data.description;
        }
      }
    }
    return product;
  };

  const findProductByLegacySlug = async ({ slug, select, requireActiveVendor = false }) => {
    if (!slug) return null;

    let query = supabase
      .from('products')
      .select(select)
      .eq('metadata->>legacy_slug', slug);

    if (requireActiveVendor) {
      query = query.eq('vendors.is_active', true);
    }

    const { data: byPrimaryLegacySlug } = await query.maybeSingle();
    if (byPrimaryLegacySlug) {
      return hydrateProduct(byPrimaryLegacySlug);
    }

    let aliasQuery = supabase
      .from('products')
      .select(select)
      .contains('metadata', { legacy_slugs: [slug] });

    if (requireActiveVendor) {
      aliasQuery = aliasQuery.eq('vendors.is_active', true);
    }

    const { data: byLegacySlugArray } = await aliasQuery.maybeSingle();
    return hydrateProduct(byLegacySlugArray);
  };

  useEffect(() => {
    const load = async () => {
      try {
        let product = null;
        const normalizedIncomingSlug = String(productSlug || '').trim();
        const slugCandidates = Array.from(
          new Set(
            [normalizedIncomingSlug, stripLegacyRandomSlugSuffix(productSlug)]
              .filter(Boolean)
          )
        );

        for (const slugCandidate of slugCandidates) {
          try {
            product = await directoryApi.getProductDetailBySlug(slugCandidate);
          } catch (slugError) {
            console.warn('Slug lookup failed:', slugError);
          }

          if (product) break;
        }

        if (!product && normalizedIncomingSlug) {
          product = await findProductByLegacySlug({
            slug: normalizedIncomingSlug,
            select: '*, vendors!inner(*)',
            requireActiveVendor: true,
          });
        }

        // If not found (often due to vendor inactive), allow vendor owner to view
        if (!product && userRole === 'VENDOR' && currentVendorId) {
          for (const slugCandidate of slugCandidates) {
            const { data: raw } = await supabase
              .from('products')
              .select('*, vendors(*)')
              .eq('slug', slugCandidate)
              .maybeSingle();

            if (raw && raw.vendor_id === currentVendorId) {
              product = await hydrateProduct(raw);
              break;
            }
          }

          if (!product && normalizedIncomingSlug) {
            const rawByLegacySlug = await findProductByLegacySlug({
              slug: normalizedIncomingSlug,
              select: '*, vendors(*)',
            });

            if (rawByLegacySlug && rawByLegacySlug.vendor_id === currentVendorId) {
              product = rawByLegacySlug;
            }
          }
        }

        // Fallback: try loading by ID (in case slug is actually an ID)
        if (!product) {
          const { data: rawById } = await supabase
            .from('products')
            .select('*, vendors(*)')
            .eq('id', productSlug)
            .maybeSingle();
          product = await hydrateProduct(rawById);
        }

        if (product) {
          setData(product);
          if (product?.status === 'DRAFT') {
            setIsDraft(true);
          }

          const nextCanonicalPath = getProductDetailPath(product);
          if (nextCanonicalPath && location.pathname !== nextCanonicalPath) {
            navigate(nextCanonicalPath, { replace: true });
          }
        } else {
          console.error('Product not found by slug or ID');
        }
      } catch (e) {
        console.error('Product load failed:', e);
      } finally {
        setLoading(false);
      }
    };
    if (productSlug) load();
  }, [productSlug, userRole, currentVendorId, location.pathname, navigate]);

  if (loading)
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="animate-spin w-8 h-8 text-blue-600" />
      </div>
    );
  if (!data) return <div className="p-10 text-center">Product not found</div>;

  const { vendors: vendor, micro_categories: cat } = data;
  const images = data.images || [];
  const categoryPathParts = (() => {
    if (cat?.sub_categories || cat?.name) {
      const headName = cat?.sub_categories?.head_categories?.name || '';
      const subName = cat?.sub_categories?.name || '';
      const microName = cat?.name || '';
      return [headName, subName, microName].filter(Boolean);
    }
    const rawPath = data.category_path || data.category_other || data.category || '';
    return rawPath
      .split('>')
      .map((part) => part.trim())
      .filter(Boolean);
  })();
  const categoryLabel =
    categoryPathParts.length > 0 ? categoryPathParts.join(' › ') : 'Uncategorized';
  const productName = data.name || 'Product';
  const productUnit = getProductUnit(data);
  const priceUnitLabel = data.price_unit || productUnit;
  const priceLabel = data.price ? formatPrice(data.price) : 'Price on request';
  const moqLabel = data.min_order_qty ? `${data.min_order_qty} ${productUnit}` : 'Ask supplier';
  const vendorLocation = [vendor?.city, vendor?.state].filter(Boolean).join(', ') || 'India';
  const productSpecifications = normalizeSpecifications(data.specifications);
  const extraCategoryLabels = (() => {
    try {
      const raw =
        typeof data.extra_micro_categories === 'string'
          ? JSON.parse(data.extra_micro_categories)
          : data.extra_micro_categories;
      if (!Array.isArray(raw)) return [];
      return raw
        .map((item) => (typeof item === 'string' ? item : item?.name || item?.label || ''))
        .filter(Boolean);
    } catch {
      return [];
    }
  })();
  const overviewCopy =
    plainDescription ||
    `${productName} is listed by ${vendor?.company_name || 'this supplier'} for B2B buyers comparing product details, pricing, minimum order needs, and supplier credentials before sending an enquiry.`;
  const isOverviewLong = overviewCopy.length > 620;
  const visibleOverview =
    descriptionExpanded || !isOverviewLong ? overviewCopy : `${overviewCopy.slice(0, 620).trim()}...`;
  const productFacts = [
    { label: 'Price', value: data.price ? `${priceLabel} / ${priceUnitLabel}` : priceLabel },
    { label: 'Minimum Order', value: moqLabel },
    { label: 'Unit', value: priceUnitLabel },
    {
      label: 'Rating',
      value:
        ratingSummary.count > 0
          ? `${Number(ratingSummary.average || 0).toFixed(1)} (${ratingSummary.count})`
          : 'No ratings yet',
    },
  ];
  const detailRows = [
    { label: 'Category', value: categoryLabel },
    { label: 'Supplier', value: vendor?.company_name || 'Listed supplier' },
    { label: 'Location', value: vendorLocation },
    { label: 'Business Type', value: vendor?.primary_business_type || vendor?.business_type || '' },
  ].filter((item) => item.value);

  // Build SEO meta tags
  let seoMetaTags = null;
  try {
    let extraCategories = [];
    if (data.extra_micro_categories) {
      if (typeof data.extra_micro_categories === 'string') {
        extraCategories = JSON.parse(data.extra_micro_categories);
      } else if (Array.isArray(data.extra_micro_categories)) {
        extraCategories = data.extra_micro_categories;
      }
    }

    const extraCatNames = extraCategories?.map((c) => c?.name).filter(Boolean).join(', ') || '';
    const extraMetaTags = extraCategories?.map((c) => c?.meta_tags).filter(Boolean) || [];
    const extraDescriptions = extraCategories?.map((c) => c?.description).filter(Boolean) || [];
    const categoryPath =
      [cat?.sub_categories?.head_categories?.name, cat?.sub_categories?.name, cat?.name]
        .filter(Boolean)
        .join(' - ') ||
      (data.category_path || data.category_other || data.category || '');

    // Priority: primary micro category meta_tags > custom meta_tags > generated title
    const seoTitle =
      data.primary_meta_tags ||
      `${data.name} | ${categoryPath}${extraCatNames ? ' | ' + extraCatNames : ''} | IndianTradeMart`;

    // Priority: primary micro category description > extra category descriptions > product description
    let seoDescription = data.primary_meta_description;
    if (!seoDescription && extraDescriptions.length > 0) {
      seoDescription = extraDescriptions[0]?.replace(/<[^>]*>/g, '').substring(0, 160);
    }
    if (!seoDescription) {
      seoDescription = data.description?.replace(/<[^>]*>/g, '').substring(0, 160) || data.name;
    }

    // Build comprehensive keywords: primary meta + extra meta tags + category names
    const allKeywords = [
      data.primary_meta_tags,
      data.name,
      cat?.name,
      cat?.sub_categories?.name,
      vendor?.company_name,
      ...extraCatNames.split(',').map((n) => n.trim()),
      ...extraMetaTags,
    ]
      .filter(Boolean)
      .join(', ');

    seoMetaTags = (
      <Helmet>
        <title>{seoTitle}</title>
        <meta name="description" content={seoDescription} />
        <meta name="keywords" content={allKeywords} />
        {canonicalProductUrl ? <link rel="canonical" href={canonicalProductUrl} /> : null}
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={seoDescription} />
        {images[0] && <meta property="og:image" content={images[0]} />}
        <meta property="og:url" content={canonicalProductUrl || shareUtils.getCurrentUrl()} />
      </Helmet>
    );
  } catch (error) {
    console.warn('Error building SEO tags:', error);
    seoMetaTags = (
      <Helmet>
        <title>{`${data.name} | IndianTradeMart`}</title>
        {canonicalProductUrl ? <link rel="canonical" href={canonicalProductUrl} /> : null}
        <meta
          name="description"
          content={data.description?.replace(/<[^>]*>/g, '').substring(0, 160) || data.name}
        />
        <meta property="og:url" content={canonicalProductUrl || shareUtils.getCurrentUrl()} />
      </Helmet>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-20">
      {seoMetaTags}

      {/* Enquiry Modal */}
      <Dialog
        open={enquiryOpen}
        onOpenChange={(v) => {
          if (sendingEnquiry) return;
          if (!v) enquiryCaptcha.resetCaptcha();
          setEnquiryOpen(v);
        }}
      >
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Send Enquiry</DialogTitle>
            <DialogDescription>
              Fill your requirement details. This helps the supplier respond faster.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="qty">Quantity</Label>
              <Input
                id="qty"
                placeholder="e.g. 10"
                value={enquiry.quantity}
                onChange={(e) => setEnquiry((p) => ({ ...p, quantity: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Unit</Label>
              <Select
                value={enquiry.unit}
                onValueChange={(v) => setEnquiry((p) => ({ ...p, unit: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  {unitOptions.map((u) => (
                    <SelectItem key={u.value} value={u.value}>
                      {u.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="budget">Budget</Label>
              <Input
                id="budget"
                placeholder="e.g. ₹50,000 or 50k"
                value={enquiry.budget}
                onChange={(e) => setEnquiry((p) => ({ ...p, budget: e.target.value }))}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="req">Requirement / Description</Label>
              <Textarea
                id="req"
                rows={5}
                placeholder="Write your requirement in detail... (quality, size, delivery location, timeline, etc.)"
                value={enquiry.requirement}
                onChange={(e) => setEnquiry((p) => ({ ...p, requirement: e.target.value }))}
              />
              <div className="text-xs text-slate-500">
                Product: <span className="font-medium">{data?.name}</span>
              </div>
            </div>
          </div>

          <TurnstileField
            action="lead_submit"
            onStatusChange={enquiryCaptcha.setCaptchaStatus}
            resetKey={enquiryCaptcha.captchaResetKey}
            onTokenChange={enquiryCaptcha.setCaptchaToken}
          />

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEnquiryOpen(false)}
              disabled={sendingEnquiry}
            >
              Cancel
            </Button>
            <Button
              className="bg-[#003D82] hover:bg-blue-800"
              onClick={handleSubmitEnquiry}
              disabled={sendingEnquiry}
            >
              {sendingEnquiry ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Sending...
                </span>
              ) : (
                'Send'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={ratingDialogOpen} onOpenChange={(v) => !savingRating && setRatingDialogOpen(v)}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Rate This Service</DialogTitle>
            <DialogDescription>
              Give star rating and feedback. This helps other buyers choose better.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {myRating > 0 && myRatingUpdatedAt ? (
              <p className="text-xs text-slate-500">
                Last updated: {formatDateTime(myRatingUpdatedAt)}
              </p>
            ) : null}
            <div>
              <Label className="mb-2 block">Your Rating</Label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setRatingDraft(val)}
                    className="rounded p-1 hover:bg-slate-100 transition"
                    aria-label={`Rate ${val} star`}
                  >
                    <Star
                      className={`h-7 w-7 ${
                        val <= ratingDraft ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300'
                      }`}
                    />
                  </button>
                ))}
                <span className="text-sm text-slate-500 ml-1">
                  {ratingDraft > 0 ? `${ratingDraft} / 5` : 'Select stars'}
                </span>
              </div>
            </div>

            <div>
              <Label htmlFor="rating-feedback" className="mb-2 block">
                Feedback (optional)
              </Label>
              <Textarea
                id="rating-feedback"
                rows={5}
                maxLength={1000}
                placeholder="Share your experience about service quality, response, timeline, etc."
                value={feedbackDraft}
                onChange={(e) => setFeedbackDraft(e.target.value)}
              />
              <div className="text-xs text-slate-500 text-right mt-1">{feedbackDraft.length}/1000</div>
            </div>
          </div>

          <DialogFooter>
            {isBuyer && myRating > 0 ? (
              <Button
                variant="outline"
                className="mr-auto border-red-200 text-red-600 hover:bg-red-50"
                onClick={handleDeleteRating}
                disabled={savingRating}
              >
                Delete Rating
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => setRatingDialogOpen(false)} disabled={savingRating}>
              Cancel
            </Button>
            <Button className="bg-[#003D82] hover:bg-blue-800" onClick={handleSaveRating} disabled={savingRating}>
              {savingRating ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                </span>
              ) : (
                'Submit'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isDraft && (
        <div className="bg-yellow-50 border-b border-yellow-200 py-3 px-4 mb-0 shadow-sm">
          <div className="container mx-auto text-sm text-yellow-800 flex items-center gap-2">
            <span className="font-semibold">⚠️ Draft Product:</span> This product is in draft status and not visible
            to other buyers.
          </div>
        </div>
      )}

      <div className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="container mx-auto flex flex-wrap gap-1 text-sm text-slate-500">
          <Link to="/directory">Directory</Link> {' › '}
          {cat ? (
            <>
              {cat.sub_categories?.head_categories?.name && (
                <>
                  <span>{cat.sub_categories?.head_categories?.name}</span> {' › '}
                </>
              )}
              {cat.sub_categories?.name && (
                <>
                  <span>{cat.sub_categories?.name}</span> {' › '}
                </>
              )}
              <Link
                to={`/directory/${cat.sub_categories?.head_categories?.slug}/${cat.sub_categories?.slug}/${cat.slug}`}
                className="text-blue-600 font-medium"
              >
                {cat.name}
              </Link>
            </>
          ) : (
            <span>{categoryLabel}</span>
          )}
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[300px_minmax(0,1fr)_300px] xl:grid-cols-[330px_minmax(0,1fr)_310px]">
          <aside className="lg:sticky lg:top-24">
            <div className="aspect-square overflow-hidden bg-slate-50">
              {images[activeImage] ? (
                <img src={images[activeImage]} alt={productName} className="h-full w-full object-contain p-3" />
              ) : (
                <div className="flex h-full items-center justify-center text-sm font-medium text-slate-300">
                  No Image
                </div>
              )}
            </div>
            {images.length > 0 && (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {images.map((img, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveImage(i)}
                    className={`h-12 w-12 shrink-0 overflow-hidden rounded border bg-white ${
                      activeImage === i
                        ? 'border-[#003D82] ring-1 ring-[#003D82]'
                        : 'border-slate-200 opacity-75 hover:opacity-100'
                    }`}
                    aria-label={`View product image ${i + 1}`}
                  >
                    <img src={img} className="h-full w-full object-cover" alt="" />
                  </button>
                ))}
              </div>
            )}
          </aside>

          <main className="min-w-0">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  {cat?.name ? (
                    <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
                      {cat.name}
                    </Badge>
                  ) : null}
                  {vendor?.verification_badge ? (
                    <Badge className="border-none bg-green-100 text-green-700 hover:bg-green-100">
                      <CheckCircle className="mr-1 h-3 w-3" /> Verified Supplier
                    </Badge>
                  ) : null}
                </div>
                <h1 className="max-w-4xl break-words text-[1.65rem] font-semibold leading-[1.22] text-slate-950 sm:text-[2rem] lg:text-[2.25rem]">
                  {productName}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="break-words">{vendor?.company_name || 'Listed supplier'}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="break-words">{vendorLocation}</span>
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap gap-1.5 md:pt-1">
                <Button size="icon" variant="outline" className="h-8 w-8 border-slate-200" asChild>
                  <a
                    href={shareUtils.getWhatsAppUrl(productName, canonicalProductUrl || shareUtils.getCurrentUrl())}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Share on WhatsApp"
                  >
                    <MessageCircle className="h-4 w-4 text-green-600" />
                  </a>
                </Button>
                <Button size="icon" variant="outline" className="h-8 w-8 border-slate-200" asChild>
                  <a
                    href={shareUtils.getFacebookUrl(canonicalProductUrl || shareUtils.getCurrentUrl())}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Share on Facebook"
                  >
                    <Facebook className="h-4 w-4 text-blue-600" />
                  </a>
                </Button>
                <Button size="icon" variant="outline" className="h-8 w-8 border-slate-200" asChild>
                  <a
                    href={shareUtils.getLinkedInUrl(canonicalProductUrl || shareUtils.getCurrentUrl(), productName)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Share on LinkedIn"
                  >
                    <Linkedin className="h-4 w-4 text-blue-700" />
                  </a>
                </Button>
                <Button size="icon" variant="outline" className="h-8 w-8 border-slate-200" asChild>
                  <a
                    href={shareUtils.getTwitterUrl(productName, canonicalProductUrl || shareUtils.getCurrentUrl())}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Share on Twitter"
                  >
                    <Twitter className="h-4 w-4 text-sky-500" />
                  </a>
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 border-slate-200"
                  onClick={handleCopyLink}
                  title="Copy link"
                >
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <LinkIcon className="h-4 w-4 text-slate-600" />}
                </Button>
              </div>
            </div>

            <div className="mt-7 grid gap-x-6 gap-y-4 border-y border-slate-200 py-5 sm:grid-cols-2 xl:grid-cols-4">
              {productFacts.map((item) => (
                <div key={item.label}>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{item.label}</div>
                  <div className="mt-1 break-words text-base font-bold text-slate-950">{item.value}</div>
                </div>
              ))}
            </div>

            <div className="mt-8 space-y-8">
              <section className="border-b border-slate-200 pb-8">
                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Overview</h2>
                <p className="mt-3 max-w-[72ch] whitespace-pre-line break-words text-[15px] leading-8 text-slate-700">
                  {visibleOverview}
                </p>
                {isOverviewLong && (
                  <button
                    type="button"
                    onClick={() => setDescriptionExpanded((value) => !value)}
                    className="mt-2 text-sm font-semibold text-[#003D82] hover:text-blue-800"
                  >
                    {descriptionExpanded ? 'Show less' : 'Read full description'}
                  </button>
                )}
              </section>

              <section className="border-b border-slate-200 pb-8">
                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Product Details</h2>
                <div className="mt-3 grid gap-x-5 gap-y-2 text-sm sm:grid-cols-2">
                  {detailRows.map((item) => (
                    <div key={item.label} className="flex gap-3 border-b border-slate-100 py-2">
                      <span className="w-28 shrink-0 text-slate-500">{item.label}</span>
                      <span className="min-w-0 break-words font-medium text-slate-900">{item.value}</span>
                    </div>
                  ))}
                </div>
                {extraCategoryLabels.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {extraCategoryLabels.map((label) => (
                      <Badge key={label} variant="secondary" className="bg-blue-50 text-blue-700">
                        {label}
                      </Badge>
                    ))}
                  </div>
                )}
              </section>

              {productSpecifications.length > 0 && (
                <section className="border-b border-slate-200 pb-8">
                  <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Specifications</h2>
                  <div className="mt-3 grid gap-x-6 text-sm sm:grid-cols-2">
                    {productSpecifications.map((s, i) => (
                      <div key={`${s.key}-${i}`} className="flex justify-between gap-4 border-b border-slate-100 py-2.5">
                        <span className="break-words text-slate-500">{s.key}</span>
                        <span className="break-words text-right font-medium text-slate-900">{s.value}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {recentFeedback.length > 0 && (
                <section className="border-b border-slate-200 pb-8">
                  <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Buyer Feedback</h2>
                  <div className="mt-3 space-y-3">
                    {recentFeedback.map((row, idx) => (
                      <div key={`${row.userId}-${row.updated_at || idx}`} className="border-b border-slate-100 pb-3 last:border-b-0">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <div>
                            <span className="text-sm font-semibold text-slate-800">{row.buyerName || 'Buyer'}</span>
                            {row.updated_at || row.created_at ? (
                              <p className="text-[11px] text-slate-400">
                                Rated on {formatDateTime(row.updated_at || row.created_at)}
                              </p>
                            ) : null}
                          </div>
                          <span className="inline-flex items-center gap-1 text-sm text-slate-600">
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            {Number(row.rating || 0).toFixed(1)}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap break-words text-sm text-slate-600">{row.feedback}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {(data.pdf_url || data.video_url) && (
                <section className="border-b border-slate-200 pb-8">
                  <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Media & Documents</h2>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {data.pdf_url && (
                      <a
                        href={data.pdf_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded border border-blue-200 bg-white px-3 py-2 text-sm text-blue-700 hover:bg-blue-50"
                      >
                        <FileText className="h-4 w-4" /> Product Brochure
                      </a>
                    )}
                    {data.video_url && (
                      <a
                        href={data.video_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded border border-red-200 bg-white px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        <PlayCircle className="h-4 w-4" /> Watch Video
                      </a>
                    )}
                  </div>
                </section>
              )}
            </div>
          </main>

          <aside className="border-t border-slate-200 pt-6 lg:sticky lg:top-24 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Supplier</div>
            <div className="mt-4 flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded border border-slate-200 bg-slate-50">
                {vendor.profile_image ? (
                  <img src={vendor.profile_image} className="h-full w-full object-cover" alt={vendor.company_name} />
                ) : (
                  <span className="text-lg font-bold text-slate-300">{vendor.company_name?.[0]}</span>
                )}
              </div>
              <div className="min-w-0">
                <h3
                  onClick={handleCompanyClick}
                  className="cursor-pointer break-words text-base font-bold leading-snug text-slate-950 hover:text-[#003D82]"
                >
                  {vendor.company_name}
                </h3>
                <div className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                  <MapPin className="h-3.5 w-3.5 shrink-0" /> <span className="break-words">{vendorLocation}</span>
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-3 border-y border-slate-100 py-4">
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-[#003D82]" />
                <span className="break-words font-medium text-slate-900">{phoneUtils.maskPhone(vendor.phone)}</span>
              </div>
              {vendor.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-[#003D82]" />
                  <span className="break-words font-medium text-slate-900">{maskEmail(vendor.email)}</span>
                </div>
              )}
            </div>

            <Button onClick={openEnquiryModal} className="mt-5 h-10 w-full bg-[#003D82] hover:bg-blue-800">
              Send Enquiry
            </Button>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={handleToggleFavorite}
                disabled={favLoading}
                className={`h-9 px-2 text-sm ${
                  isFavorite ? 'border-yellow-300 bg-yellow-50 text-yellow-700 hover:bg-yellow-100' : ''
                }`}
              >
                <Heart className={`mr-1.5 h-4 w-4 ${isFavorite ? 'fill-current text-yellow-500' : ''}`} />
                {favLoading ? 'Wait' : isFavorite ? 'Saved' : 'Favorite'}
              </Button>
              <Button
                variant="outline"
                onClick={openRatingDialog}
                disabled={Boolean(user) && !isBuyer}
                className="h-9 px-2 text-sm"
                title={Boolean(user) && !isBuyer ? 'Only buyers can add/edit ratings' : undefined}
              >
                <Star className={`mr-1.5 h-4 w-4 ${myRating > 0 ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                Rate
              </Button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;
