import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Boxes,
  Building2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Factory,
  FlaskConical,
  Globe2,
  Handshake,
  Headphones,
  Leaf,
  Mail,
  MapPin,
  MapPinned,
  Package,
  Phone,
  Quote,
  Search,
  ShieldCheck,
  Shirt,
  Sparkles,
  Star,
  Stethoscope,
  Target,
  TrendingUp,
  UsersRound,
  Zap,
} from 'lucide-react';

import PremiumBrandsSection from '@/modules/directory/components/PremiumBrandsSection';
import TopCitiesSection from '@/modules/directory/components/TopCitiesSection';
import { categoryApi } from '@/modules/directory/services/categoryApi';
import { getHomeFeed } from '@/modules/directory/services/homeFeedService';
import { vendorService } from '@/modules/directory/services/vendorService';
import { successStories } from '@/modules/directory/pages/successStoriesData';
import { BUYING_JOURNEY, HOME_FAQS } from '@/modules/directory/pages/homeStoryContent';
import { getProductDetailPath } from '@/shared/utils/productRoutes';
import { getVendorProfilePath } from '@/shared/utils/vendorRoutes';
import { optimizeImageUrl } from '@/shared/utils/imageUrl';

const PostRequirementModal = lazy(() => import('@/shared/components/modals/PostRequirementModal'));

const EMPTY_FEED = {
  generatedAt: null,
  categories: [],
  products: [],
  vendors: [],
  stats: {},
};

const CATEGORY_STYLES = [
  { icon: Factory, iconClass: 'bg-amber-100 text-amber-800', lineClass: 'bg-amber-500' },
  { icon: Leaf, iconClass: 'bg-emerald-100 text-emerald-800', lineClass: 'bg-emerald-500' },
  { icon: FlaskConical, iconClass: 'bg-sky-100 text-sky-800', lineClass: 'bg-sky-500' },
  { icon: Building2, iconClass: 'bg-orange-100 text-orange-800', lineClass: 'bg-orange-500' },
  { icon: Zap, iconClass: 'bg-yellow-100 text-yellow-800', lineClass: 'bg-yellow-500' },
  { icon: Package, iconClass: 'bg-rose-100 text-rose-800', lineClass: 'bg-rose-500' },
  { icon: Shirt, iconClass: 'bg-violet-100 text-violet-800', lineClass: 'bg-violet-500' },
  { icon: Stethoscope, iconClass: 'bg-teal-100 text-teal-800', lineClass: 'bg-teal-500' },
];

const MARKETPLACE_FEATURES = [
  {
    icon: ShieldCheck,
    title: 'Verified businesses',
    description: 'Supplier identity and business details are reviewed before trust signals are shown.',
  },
  {
    icon: Globe2,
    title: 'Nationwide discovery',
    description: 'Find manufacturers and service providers across Indian cities and industrial clusters.',
  },
  {
    icon: Search,
    title: 'Intent-led search',
    description: 'Move from a product or service requirement to relevant sellers with less noise.',
  },
  {
    icon: Zap,
    title: 'Faster RFQ workflow',
    description: 'Post one structured requirement and compare responses from matching suppliers.',
  },
  {
    icon: Handshake,
    title: 'Direct connections',
    description: 'Start conversations from product and supplier profiles without losing buying context.',
  },
  {
    icon: Headphones,
    title: 'Human support',
    description: 'Marketplace teams help buyers and suppliers keep important conversations moving.',
  },
];

const MARKETPLACE_REACH_STATS = [
  { label: 'Registered suppliers', value: 120000, icon: UsersRound },
  { label: 'Product & service listings', value: 8400000, icon: Boxes },
  { label: 'Sourcing categories', value: 14300, icon: Target },
  { label: 'Cities & industrial clusters', value: 5600, icon: MapPinned },
  { label: 'Buyer enquiries every month', value: 310000, icon: ClipboardCheck },
];

const TRADE_DESK_BASE = [
  {
    tag: 'Sourcing playbook',
    title: 'A practical way to compare B2B suppliers',
    description: 'Shortlist on business fit, location, catalogue clarity, and response quality.',
    href: '/learning-centre',
    icon: BookOpen,
  },
  {
    tag: 'Buyer workflow',
    title: 'Turn a requirement into clearer supplier quotes',
    description: 'The information buyers should share before asking suppliers for commercial terms.',
    href: '/buyleads',
    icon: ClipboardCheck,
  },
  {
    tag: 'Growth stories',
    title: 'How Indian businesses build repeatable demand',
    description: 'See how clearer listings and faster follow-up improve B2B conversations.',
    href: '/success-stories',
    icon: TrendingUp,
  },
];

const safeText = (value) => String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const truncate = (value, length = 92) => {
  const text = safeText(value);
  if (text.length <= length) return text;
  return `${text.slice(0, length).replace(/\s+\S*$/, '').trim()}...`;
};

const parseImages = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch {
      return [value];
    }
    return [value];
  }
  return [];
};

const getProductImage = (product) =>
  parseImages(product?.images)[0] || product?.image_url || product?.image || '';

const getVendorFromProduct = (product) => {
  if (Array.isArray(product?.vendors)) return product.vendors[0] || {};
  return product?.vendors || {};
};

const selectDiverseProducts = (rows = [], limit = 6) => {
  const primary = [];
  const overflow = [];
  const seenVendors = new Set();

  (Array.isArray(rows) ? rows : []).forEach((product) => {
    const vendor = getVendorFromProduct(product);
    const vendorKey = String(
      product?.vendor_id || vendor?.id || vendor?.vendor_id || vendor?.company_name || ''
    ).trim();
    if (vendorKey && !seenVendors.has(vendorKey)) {
      seenVendors.add(vendorKey);
      primary.push(product);
    } else {
      overflow.push(product);
    }
  });

  return [...primary, ...overflow].slice(0, limit);
};

const boolish = (value) => {
  if (value === true || value === 1) return true;
  return ['true', '1', 'yes', 'verified'].includes(String(value || '').trim().toLowerCase());
};

const isVerifiedVendor = (vendor) => {
  const status = String(vendor?.kyc_status || '').trim().toUpperCase();
  return boolish(vendor?.verification_badge) || boolish(vendor?.is_verified) || ['APPROVED', 'VERIFIED'].includes(status);
};

const formatPrice = (value) => {
  const amount = Number(String(value ?? '').replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(amount) || amount <= 0) return 'Ask for quotation';
  return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(amount)}`;
};

const formatMetric = (value) => {
  const count = Number(value);
  if (!Number.isFinite(count) || count < 0) return '--';
  if (count >= 10000000) return `${(count / 10000000).toFixed(count >= 100000000 ? 0 : 1)} Cr+`;
  if (count >= 100000) return `${(count / 100000).toFixed(count >= 1000000 ? 0 : 1)} Lakh+`;
  return `${new Intl.NumberFormat('en-IN').format(count)}+`;
};

const Reveal = ({ children, className = '', delay = 0, amount = 0.16 }) => {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 1, y: 16 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount }}
      transition={{ duration: 0.62, delay, ease: [0.2, 0.7, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
};

const SectionHeading = ({ eyebrow, title, description, action, light = false }) => (
  <div className="mb-8 flex flex-col gap-5 md:mb-10 md:flex-row md:items-end md:justify-between">
    <div className="max-w-3xl">
      <p className={`mb-3 text-xs font-bold uppercase tracking-normal ${light ? 'text-orange-300' : 'text-orange-700'}`}>
        {eyebrow}
      </p>
      <h2 className={`itm-display text-3xl leading-tight sm:text-4xl ${light ? 'text-white' : 'text-slate-950'}`}>
        {title}
      </h2>
      {description ? (
        <p className={`mt-4 max-w-2xl text-base leading-7 ${light ? 'text-slate-300' : 'text-slate-600'}`}>
          {description}
        </p>
      ) : null}
    </div>
    {action}
  </div>
);

const MediaImage = ({
  src,
  alt,
  className,
  fallbackIcon: FallbackIcon = Package,
  loading = 'lazy',
}) => {
  const [failed, setFailed] = useState(false);
  const optimized = optimizeImageUrl(src, { width: 720, height: 540, quality: 76 });

  if (!optimized || failed) {
    return (
      <div className={`flex items-center justify-center bg-[#eef2f3] text-slate-400 ${className}`} aria-hidden="true">
        <FallbackIcon className="h-10 w-10" />
      </div>
    );
  }

  return (
    <img
      src={optimized}
      alt={alt}
      className={className}
      loading={loading}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
};

const StorySkeleton = () => (
  <div className="bg-[#f6f8f7] py-14" aria-hidden="true">
    <div className="mx-auto w-[92vw] max-w-7xl">
      <div className="mb-8 h-8 w-64 animate-pulse rounded bg-slate-200" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="h-40 animate-pulse rounded-lg border border-slate-200 bg-white" />
        ))}
      </div>
    </div>
  </div>
);

const HomeDeferredSections = () => {
  const [feed, setFeed] = useState(EMPTY_FEED);
  const [loading, setLoading] = useState(true);
  const [showPostRequirement, setShowPostRequirement] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const nextFeed = await getHomeFeed();
        if (active) setFeed(nextFeed);
      } catch (error) {
        if (import.meta.env.DEV) console.error('Homepage feed failed:', error);

        const [categories, vendors] = await Promise.all([
          categoryApi.getHomeShowcaseCategories({ headLimit: 100, subLimit: 1, microLimit: 0 }),
          vendorService.getFeaturedVendors({ limit: 6 }),
        ]);

        if (active) {
          setFeed({
            ...EMPTY_FEED,
            categories: categories || [],
            vendors: vendors || [],
          });
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  const categories = useMemo(() => feed.categories, [feed.categories]);
  const visibleCategories = useMemo(
    () => (showAllCategories ? categories : categories.slice(0, 8)),
    [categories, showAllCategories]
  );
  const products = useMemo(() => selectDiverseProducts(feed.products, 6), [feed.products]);
  const vendors = useMemo(() => feed.vendors.slice(0, 4), [feed.vendors]);
  const visualProducts = useMemo(
    () => products.filter((product) => getProductImage(product)).slice(0, 3),
    [products]
  );

  const tradeDeskItems = useMemo(() => {
    if (!categories[0]) return TRADE_DESK_BASE;
    return [
      {
        tag: 'Category guide',
        title: `Source ${categories[0].name} with a clearer shortlist`,
        description: truncate(categories[0].description, 120) || `Explore active suppliers and listings across ${categories[0].name}.`,
        href: `/directory/${categories[0].slug}`,
        icon: Factory,
      },
      ...TRADE_DESK_BASE.slice(0, 2),
    ];
  }, [categories]);

  const ctaImage = getProductImage(visualProducts[0]);

  return (
    <>
      {showPostRequirement ? (
        <Suspense fallback={null}>
          <PostRequirementModal
            isOpen={showPostRequirement}
            onClose={() => setShowPostRequirement(false)}
          />
        </Suspense>
      ) : null}

      {loading ? <StorySkeleton /> : null}

      <section className="border-b border-slate-200 bg-[#edf2ef] py-16 text-slate-950 sm:py-20" aria-labelledby="popular-categories-heading">
        <div className="mx-auto w-[92vw] max-w-7xl">
          <Reveal>
            <SectionHeading
              eyebrow="Popular categories"
              title="Sourcing starts with the right market"
              description="Explore active business categories from the Indian Trade Mart catalogue and move directly into relevant supplier networks."
              action={(
                <Link to="/directory" className="inline-flex items-center gap-2 text-sm font-semibold text-[#003d82] hover:text-orange-700">
                  Browse all categories <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            />
          </Reveal>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {visibleCategories.map((category, index) => {
              const style = CATEGORY_STYLES[index % CATEGORY_STYLES.length];
              const Icon = style.icon;
              return (
                <Reveal key={category.id || category.slug} delay={Math.min(index * 0.04, 0.22)}>
                  <Link
                    to={`/directory/${category.slug}`}
                    className="group relative flex min-h-60 flex-col overflow-hidden rounded-lg border border-white/15 bg-[#10283e] transition duration-500 hover:-translate-y-1 hover:border-orange-300/60 hover:shadow-[0_24px_55px_rgba(0,0,0,0.32)]"
                  >
                    <MediaImage
                      src={category.image_url || category.image}
                      alt={`${category.name} sourcing category`}
                      className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
                      fallbackIcon={Icon}
                      loading={index < 8 ? 'eager' : 'lazy'}
                    />
                    <div className="absolute inset-0 bg-slate-950/45 transition duration-500 group-hover:bg-slate-950/35" />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.04)_10%,rgba(2,6,23,0.92)_100%)]" />
                    <span className={`absolute inset-x-0 top-0 h-1 origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100 ${style.lineClass}`} />
                    <div className="relative flex items-start justify-between gap-4 p-5">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/20 bg-black/30 text-orange-200 backdrop-blur-sm">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/25 backdrop-blur-sm">
                        <ChevronRight className="h-5 w-5 text-white transition-transform group-hover:translate-x-1" />
                      </span>
                    </div>
                    <div className="relative mt-auto p-5 pt-8">
                      <h3 className="text-lg font-semibold leading-6 text-white">{category.name}</h3>
                      <p className="mt-2 text-sm text-slate-300">
                        {Number(category.subcategory_count || category.subcategories?.length || 0) > 0
                          ? `${category.subcategory_count || category.subcategories.length} active sourcing segments`
                          : 'Explore products and suppliers'}
                      </p>
                    </div>
                  </Link>
                </Reveal>
              );
            })}
          </div>
          {categories.length > 8 ? (
            <div className="mt-8 flex flex-col items-center gap-3 border-t border-slate-300 pt-8">
              <button
                type="button"
                onClick={() => setShowAllCategories((value) => !value)}
                aria-expanded={showAllCategories}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-900 transition hover:border-orange-400 hover:text-orange-700"
              >
                {showAllCategories ? 'Show featured categories' : `Explore all ${categories.length} categories`}
                <ChevronDown className={`h-4 w-4 transition-transform ${showAllCategories ? 'rotate-180' : ''}`} />
              </button>
              <p className="text-center text-xs text-slate-500">
                Category names and sourcing segments are loaded directly from the active marketplace catalogue.
              </p>
            </div>
          ) : null}
        </div>
      </section>

      <section className="bg-white py-16 sm:py-20" aria-labelledby="trending-products-heading">
        <div className="mx-auto w-[92vw] max-w-7xl">
          <Reveal>
            <SectionHeading
              eyebrow="Product catalogue"
              title="Fresh listings from active suppliers"
              description="Every product below comes from current marketplace records, with its supplier, location, and commercial information."
              action={(
                <Link to="/products" className="inline-flex items-center gap-2 text-sm font-semibold text-[#003d82] hover:text-orange-700">
                  View all products <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            />
          </Reveal>

          {products.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((product, index) => {
                const vendor = getVendorFromProduct(product);
                const productPath = getProductDetailPath(product) || '/products';
                const rating = Number(vendor?.seller_rating || product?.rating || 0);
                return (
                  <Reveal key={product.id || product.slug} delay={Math.min(index * 0.05, 0.24)}>
                    <article className="group overflow-hidden rounded-lg border border-slate-200 bg-white transition duration-300 hover:-translate-y-1 hover:border-slate-400 hover:shadow-[0_20px_46px_rgba(15,23,42,0.1)]">
                      <Link to={productPath} className="relative block aspect-[4/3] overflow-hidden bg-[#f2f3f3]">
                        <MediaImage
                          src={getProductImage(product)}
                          alt={product.name || 'B2B product listing'}
                          className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                        />
                        {isVerifiedVendor(vendor) ? (
                          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-emerald-700 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
                            <BadgeCheck className="h-3.5 w-3.5" /> Verified supplier
                          </span>
                        ) : null}
                      </Link>
                      <div className="p-5">
                        <Link to={productPath}>
                          <h3 className="min-h-12 text-base font-semibold leading-6 text-slate-950 transition group-hover:text-[#003d82] line-clamp-2">
                            {product.name || 'Business product'}
                          </h3>
                        </Link>
                        <p className="mt-2 line-clamp-1 text-sm text-slate-500">
                          {vendor?.company_name || 'Indian Trade Mart supplier'}
                          {vendor?.city ? ` · ${vendor.city}` : ''}
                        </p>
                        <div className="mt-5 flex items-end justify-between gap-3 border-t border-slate-100 pt-4">
                          <div>
                            <p className="text-lg font-bold text-orange-700">{formatPrice(product.price)}</p>
                            {product.price_unit || product.qty_unit ? (
                              <p className="mt-0.5 text-xs text-slate-500">per {product.price_unit || product.qty_unit}</p>
                            ) : null}
                          </div>
                          <div className="text-right">
                            {rating > 0 ? (
                              <p className="inline-flex items-center gap-1 text-sm font-semibold text-slate-700">
                                <Star className="h-4 w-4 fill-amber-400 text-amber-400" /> {rating.toFixed(1)}
                              </p>
                            ) : null}
                            <Link
                              to={productPath}
                              className="mt-1 flex items-center gap-1 text-sm font-semibold text-[#003d82] hover:text-orange-700"
                            >
                              View listing <ArrowRight className="h-4 w-4" />
                            </Link>
                          </div>
                        </div>
                      </div>
                    </article>
                  </Reveal>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
              <Package className="mx-auto h-8 w-8 text-slate-400" />
              <p className="mt-3 font-semibold text-slate-800">Product listings are refreshing.</p>
              <Link to="/products" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[#003d82]">
                Browse the product catalogue <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-[#f3f6f4] py-16 sm:py-20" aria-labelledby="featured-suppliers-heading">
        <div className="mx-auto w-[92vw] max-w-7xl">
          <Reveal>
            <SectionHeading
              eyebrow="Featured suppliers"
              title="Meet businesses ready for the next conversation"
              description="Active supplier profiles selected from current marketplace records, with verification and location context visible upfront."
              action={(
                <Link to="/directory/vendor" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 hover:text-orange-700">
                  Find more suppliers <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            />
          </Reveal>

          <div className="grid gap-4 lg:grid-cols-2">
            {vendors.map((vendor, index) => {
              const vendorPath = getVendorProfilePath(vendor) || '/directory/vendor';
              const verified = isVerifiedVendor(vendor) || vendor.verified;
              const avatar = vendor.avatar_url || vendor.profile_image || vendor.image_url || vendor.image;
              return (
                <Reveal key={vendor.id || vendor.vendor_id} delay={Math.min(index * 0.06, 0.2)}>
                  <article className="flex min-h-40 flex-col gap-5 rounded-lg border border-[#ddd9d0] bg-white p-5 transition duration-300 hover:border-slate-400 hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)] sm:flex-row sm:items-center">
                    <Link to={vendorPath} className="h-24 w-full flex-none overflow-hidden rounded-lg bg-slate-100 sm:w-28">
                      <MediaImage
                        src={avatar}
                        alt={vendor.company_name || vendor.name || 'Supplier profile'}
                        className="h-full w-full object-cover"
                        fallbackIcon={Building2}
                      />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link to={vendorPath} className="text-lg font-semibold text-slate-950 hover:text-[#003d82]">
                          {vendor.company_name || vendor.name || vendor.owner_name || 'Marketplace supplier'}
                        </Link>
                        {verified ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">
                            <BadgeCheck className="h-3.5 w-3.5" /> Verified
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-500">
                        <MapPin className="h-4 w-4 text-orange-600" />
                        {[vendor.city, vendor.state].filter(Boolean).join(', ') || 'Serving buyers across India'}
                      </p>
                      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
                        {vendor.established_year ? <span>Established {vendor.established_year}</span> : <span>Active supplier</span>}
                        {Number(vendor.seller_rating || 0) > 0 ? (
                          <span className="inline-flex items-center gap-1">
                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {Number(vendor.seller_rating).toFixed(1)} rating
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <Link
                      to={vendorPath}
                      className="inline-flex h-10 flex-none items-center justify-center gap-2 rounded-lg bg-[#003d82] px-4 text-sm font-semibold text-white hover:bg-[#002c5e]"
                    >
                      View supplier <ArrowRight className="h-4 w-4" />
                    </Link>
                  </article>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      <section className="relative isolate min-h-[720px] overflow-hidden bg-[#0b1f33] py-20 text-white sm:py-24" aria-labelledby="marketplace-story-heading">
        <img
          src="/media/itm-marketplace-story.webp?v=20260716-marketplace3"
          alt="Business partners completing a trusted marketplace introduction"
          className="absolute inset-0 -z-20 h-full w-full object-cover object-[70%_center]"
          loading="lazy"
          decoding="async"
        />
        <div className="absolute inset-0 -z-10 bg-[#06172b]/65" />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(6,23,43,0.96)_0%,rgba(6,23,43,0.78)_50%,rgba(6,23,43,0.28)_100%)]" />
        <div className="relative mx-auto w-[92vw] max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.7fr] lg:items-end">
            <Reveal>
              <p className="mb-3 text-xs font-bold uppercase tracking-normal text-orange-300">Our story and vision</p>
              <h2 id="marketplace-story-heading" className="itm-display max-w-3xl text-3xl leading-tight sm:text-5xl">
                Every Indian business deserves a clear path to its next trusted partner.
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                Indian Trade Mart connects real buying intent with active manufacturers, suppliers, products, and cities. Our vision is a more discoverable Indian market where trust and business context travel together from search to sale.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setShowPostRequirement(true)}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-orange-500 px-6 text-sm font-bold text-slate-950 hover:bg-orange-400"
                >
                  Get free quotes <ArrowRight className="h-4 w-4" />
                </button>
                <Link to="/vendor/register" className="inline-flex h-12 items-center justify-center rounded-lg border border-white/35 bg-black/15 px-6 text-sm font-bold text-white backdrop-blur-sm hover:bg-white/10">
                  Register as a supplier
                </Link>
              </div>
            </Reveal>

            <Reveal delay={0.12}>
              <div className="border-y border-white/25 bg-black/15 p-6 backdrop-blur-md" aria-label="Marketplace statistics">
                <div className="text-xs font-bold uppercase tracking-normal text-orange-200">
                  Marketplace at a glance
                </div>
                <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-7">
                  {MARKETPLACE_REACH_STATS.slice(0, 4).map((stat) => (
                    <div key={stat.label}>
                      <p className="text-3xl font-bold text-white sm:text-4xl">{formatMetric(stat.value)}</p>
                      <p className="mt-2 text-xs font-semibold uppercase leading-5 text-slate-300">{stat.label}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-7 border-t border-white/15 pt-5 text-xs leading-5 text-slate-300">
                  Growing reach across India's manufacturing, sourcing, and service economy.
                </p>
              </div>
            </Reveal>
          </div>

          <div className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {MARKETPLACE_FEATURES.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Reveal key={feature.title} delay={Math.min(index * 0.045, 0.22)}>
                  <div className="h-full rounded-lg border border-white/10 bg-white/[0.06] p-5 transition hover:border-orange-300/40 hover:bg-white/[0.09]">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500 text-white">
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="mt-5 text-base font-semibold text-white">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{feature.description}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-white py-16 sm:py-20" aria-labelledby="how-it-works-heading">
        <div className="mx-auto w-[92vw] max-w-7xl">
          <Reveal>
            <div className="grid overflow-hidden rounded-lg border border-slate-200 bg-[#f3f6f4] sm:grid-cols-2 lg:grid-cols-5">
              {MARKETPLACE_REACH_STATS.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className={`p-5 ${index ? 'border-t border-slate-200 sm:border-l lg:border-t-0' : ''}`}>
                    <Icon className="h-5 w-5 text-orange-700" />
                    <p className="mt-4 text-3xl font-bold text-slate-950 lg:text-[2rem]">{formatMetric(stat.value)}</p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-normal text-slate-500">{stat.label}</p>
                  </div>
                );
              })}
            </div>
          </Reveal>

          <Reveal className="mt-16">
            <SectionHeading
              eyebrow="How it works"
              title="Five steps from search to a purchase-ready conversation"
              description="A clear sourcing workflow helps buyers compare with context and helps suppliers respond to real intent."
            />
          </Reveal>

          <div className="grid gap-3 lg:grid-cols-5">
            {BUYING_JOURNEY.map((step, index) => (
              <Reveal key={step.number} delay={Math.min(index * 0.055, 0.24)}>
                <div className="relative h-full min-h-52 rounded-lg border border-slate-200 bg-white p-5 transition hover:border-orange-300 hover:shadow-[0_16px_34px_rgba(15,23,42,0.07)]">
                  <p className="text-xs font-bold text-orange-700">{step.number}</p>
                  <h3 className="mt-8 text-base font-semibold text-slate-950">{step.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{step.description}</p>
                  {index < BUYING_JOURNEY.length - 1 ? (
                    <ChevronRight className="absolute -right-2 top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 rounded-full bg-white text-slate-400 lg:block" />
                  ) : null}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <TopCitiesSection />
      <PremiumBrandsSection />

      <section className="border-y border-slate-200 bg-[#edf2ef] py-16 sm:py-20" aria-labelledby="customer-stories-heading">
        <div className="mx-auto w-[92vw] max-w-7xl">
          <Reveal>
            <SectionHeading
              eyebrow="Customer stories"
              title="What clearer B2B execution can change"
              description="These platform stories focus on practical outcomes: stronger inquiry quality, faster response, and wider market reach."
              action={(
                <Link to="/success-stories" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 hover:text-orange-700">
                  Read all stories <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            />
          </Reveal>

          <div className="grid gap-4 lg:grid-cols-3">
            {successStories.slice(0, 3).map((story, index) => (
              <Reveal key={story.slug} delay={Math.min(index * 0.07, 0.2)}>
                <article className="flex h-full min-h-72 flex-col rounded-lg border border-[#ddd9d0] bg-white p-6">
                  <Quote className="h-7 w-7 text-orange-600" />
                  <p className="mt-6 text-lg font-medium leading-7 text-slate-900">{story.result}</p>
                  <p className="mt-4 text-sm leading-6 text-slate-600">{story.excerpt}</p>
                  <div className="mt-auto border-t border-slate-100 pt-5">
                    <p className="font-semibold text-slate-950">{story.company}</p>
                    <Link to={`/success-stories/${story.slug}`} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[#003d82] hover:text-orange-700">
                      Read the outcome <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="trade-desk" className="scroll-mt-24 bg-white py-16 sm:py-20" aria-labelledby="trade-desk-heading">
        <div className="mx-auto w-[92vw] max-w-7xl">
          <Reveal>
            <SectionHeading
              eyebrow="Trade desk"
              title="Useful context for the next business decision"
              description="Practical routes into marketplace data, sourcing workflows, and growth lessons already available on Indian Trade Mart."
            />
          </Reveal>

          <div className="grid gap-4 lg:grid-cols-3">
            {tradeDeskItems.map((item, index) => {
              const Icon = item.icon;
              const visual = visualProducts[index] ? getProductImage(visualProducts[index]) : '';
              return (
                <Reveal key={item.title} delay={Math.min(index * 0.07, 0.2)}>
                  <article className="group flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white transition hover:-translate-y-1 hover:shadow-[0_18px_42px_rgba(15,23,42,0.09)]">
                    <div className="relative aspect-[16/9] overflow-hidden bg-[#0b1f33]">
                      {visual ? (
                        <MediaImage
                          src={visual}
                          alt="Marketplace insight"
                          className="h-full w-full object-cover opacity-70 transition duration-700 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-orange-300">
                          <Icon className="h-10 w-10" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-slate-950/30" />
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <p className="text-xs font-bold uppercase tracking-normal text-orange-700">{item.tag}</p>
                      <h3 className="mt-3 text-xl font-semibold leading-7 text-slate-950">{item.title}</h3>
                      <p className="mt-3 text-sm leading-6 text-slate-600">{item.description}</p>
                      <Link to={item.href} className="mt-auto inline-flex items-center gap-2 pt-6 text-sm font-semibold text-[#003d82] hover:text-orange-700">
                        Explore this guide <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </article>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-[#f3f6f4] py-16 sm:py-20" aria-labelledby="home-faq-heading">
        <div className="mx-auto grid w-[92vw] max-w-7xl gap-10 lg:grid-cols-[0.75fr_1.25fr]">
          <Reveal>
            <div>
              <p className="text-xs font-bold uppercase tracking-normal text-orange-700">FAQ</p>
              <h2 id="home-faq-heading" className="itm-display mt-3 text-3xl leading-tight text-slate-950 sm:text-4xl">
                Answers before you ask
              </h2>
              <p className="mt-4 max-w-md text-base leading-7 text-slate-600">
                A quick guide to registration, product discovery, enquiries, and supplier onboarding.
              </p>
              <div className="mt-8 rounded-lg border border-[#ddd9d0] bg-white p-5">
                <p className="text-sm font-semibold text-slate-950">Talk to the marketplace team</p>
                <div className="mt-4 space-y-3 text-sm text-slate-600">
                  <a href="tel:+917290010051" className="flex items-center gap-3 hover:text-[#003d82]">
                    <Phone className="h-4 w-4 text-orange-700" /> +91 72900 10051
                  </a>
                  <a href="mailto:support@indiantrademart.com" className="flex items-center gap-3 hover:text-[#003d82]">
                    <Mail className="h-4 w-4 text-orange-700" /> support@indiantrademart.com
                  </a>
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="border-t border-slate-300">
              {HOME_FAQS.map((faq, index) => {
                const expanded = openFaq === index;
                return (
                  <div key={faq.question} className="border-b border-slate-300">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-5 py-5 text-left"
                      aria-expanded={expanded}
                      onClick={() => setOpenFaq(expanded ? -1 : index)}
                    >
                      <span className="font-semibold text-slate-950">{faq.question}</span>
                      <ChevronDown className={`h-5 w-5 flex-none text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                    </button>
                    <div className={`grid transition-[grid-template-rows] duration-300 ${expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                      <div className="overflow-hidden">
                        <p className="max-w-2xl pb-5 text-sm leading-6 text-slate-600">{faq.answer}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="bg-[#f3f6f4] pb-16 sm:pb-20" aria-labelledby="home-final-cta-heading">
        <Reveal className="mx-auto w-[92vw] max-w-7xl">
          <div
            className="relative min-h-[360px] overflow-hidden rounded-lg bg-[#0b1f33] px-6 py-12 text-white sm:px-10 lg:px-14"
            style={ctaImage ? { backgroundImage: `url(${optimizeImageUrl(ctaImage, { width: 1600, height: 700, quality: 78 })})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
          >
            <div className="absolute inset-0 bg-[#0b1f33]/90" />
            <div className="relative flex min-h-[260px] max-w-3xl flex-col justify-center">
              <p className="text-xs font-bold uppercase tracking-normal text-orange-300">Build the next connection</p>
              <h2 id="home-final-cta-heading" className="itm-display mt-4 text-3xl leading-tight sm:text-5xl">
                Grow through a marketplace designed around real Indian trade.
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-200">
                Discover current supply, present your business clearly, or share a requirement and start with the right context.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/vendor/register"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-orange-500 px-6 text-sm font-bold text-slate-950 hover:bg-orange-400"
                >
                  Register as supplier <ArrowRight className="h-4 w-4" />
                </Link>
                <button
                  type="button"
                  onClick={() => setShowPostRequirement(true)}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-white/30 bg-white/5 px-6 text-sm font-bold text-white hover:bg-white/10"
                >
                  Post your requirement <Sparkles className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
};

export default HomeDeferredSections;
