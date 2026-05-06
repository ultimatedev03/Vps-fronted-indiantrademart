import React, { Suspense, lazy, useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TopCitiesSection from '@/modules/directory/components/TopCitiesSection';
import PremiumBrandsSection from '@/modules/directory/components/PremiumBrandsSection';
import HeadCategoryShowcase from '@/modules/directory/components/HeadCategoryShowcase';
import { vendorService } from '@/modules/directory/services/vendorService';
import { Button } from '@/components/ui/button';
import { CheckCircle, MapPin, ChevronRight } from 'lucide-react';
import { categoryApi } from '@/modules/directory/services/categoryApi';
import { getVendorProfilePath } from '@/shared/utils/vendorRoutes';
import { optimizeImageUrl } from '@/shared/utils/imageUrl';

const FEATURED_LIMIT = 8;
const HEAD_INITIAL_LIMIT = 3;
const SUB_INITIAL_LIMIT = 9;
const MICRO_PREVIEW_LIMIT = 3;
const PostRequirementModal = lazy(() => import('@/shared/components/modals/PostRequirementModal'));

const CategorySkeleton = () => (
  <div className="space-y-6" aria-hidden="true">
    {Array.from({ length: 3 }).map((_, index) => (
      <div key={index} className="h-72 rounded-2xl border border-slate-200 bg-slate-100 animate-pulse" />
    ))}
  </div>
);

const VendorGridSkeleton = () => (
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4" aria-hidden="true">
    {Array.from({ length: 4 }).map((_, index) => (
      <div key={index} className="rounded-2xl border border-slate-200/80 bg-white p-2.5 shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
        <div className="mb-3 h-24 rounded-xl bg-slate-100 animate-pulse" />
        <div className="mb-2 h-4 w-3/4 rounded bg-slate-100 animate-pulse" />
        <div className="mb-4 h-3 w-1/2 rounded bg-slate-100 animate-pulse" />
        <div className="h-8 rounded bg-slate-100 animate-pulse" />
      </div>
    ))}
  </div>
);

const VendorImage = ({ src, name }) => {
  const [failed, setFailed] = useState(false);
  const letter = String(name || 'S').trim().charAt(0).toUpperCase() || 'S';
  const optimizedSrc = optimizeImageUrl(src, { width: 640, height: 256, quality: 70 });

  if (!optimizedSrc || failed) {
    return (
      <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-sky-50 to-cyan-50">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_26%_18%,rgba(14,165,233,0.18),transparent_30%),radial-gradient(circle_at_78%_72%,rgba(0,61,130,0.12),transparent_28%)]" />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-white/80 bg-white/80 text-2xl font-extrabold text-[#0b4c8c] shadow-[0_12px_28px_rgba(15,23,42,0.12)]">
          {letter}
        </div>
      </div>
    );
  }

  return (
    <img
      src={optimizedSrc}
      alt={name}
      width="640"
      height="256"
      sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
      onError={() => setFailed(true)}
      loading="lazy"
      decoding="async"
    />
  );
};

const HomeDeferredSections = () => {
  const navigate = useNavigate();
  const [homeCategories, setHomeCategories] = useState([]);
  const [featuredVendors, setFeaturedVendors] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingVendors, setLoadingVendors] = useState(true);
  const [showAllHeads, setShowAllHeads] = useState(false);
  const [hasMoreHeads, setHasMoreHeads] = useState(false);
  const [showPostRequirement, setShowPostRequirement] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoadingCategories(true);
      try {
        const headLimit = showAllHeads ? 0 : HEAD_INITIAL_LIMIT + 1;
        const data = await categoryApi.getHomeShowcaseCategories({
          headLimit: headLimit || undefined,
          subLimit: SUB_INITIAL_LIMIT,
          microLimit: MICRO_PREVIEW_LIMIT,
        });
        const nextCategories = Array.isArray(data) ? data : [];
        setHasMoreHeads(nextCategories.length > HEAD_INITIAL_LIMIT);
        setHomeCategories(nextCategories);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('Failed to load home categories:', error);
        }
        setHasMoreHeads(false);
      } finally {
        setLoadingCategories(false);
      }
    };

    load();
  }, [showAllHeads]);

  useEffect(() => {
    const load = async () => {
      setLoadingVendors(true);
      try {
        const vendors = await vendorService.getFeaturedVendors({ limit: FEATURED_LIMIT });
        setFeaturedVendors(vendors || []);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('Failed to load featured vendors:', error);
        }
      } finally {
        setLoadingVendors(false);
      }
    };

    load();
  }, []);

  const visibleHeads = useMemo(() => {
    if (showAllHeads) return homeCategories;
    return homeCategories.slice(0, HEAD_INITIAL_LIMIT);
  }, [homeCategories, showAllHeads]);

  const visibleFeaturedVendors = useMemo(
    () => (featuredVendors || []).slice(0, FEATURED_LIMIT),
    [featuredVendors]
  );

  return (
    <>
      {showPostRequirement && (
        <Suspense fallback={null}>
          <PostRequirementModal
            isOpen={showPostRequirement}
            onClose={() => setShowPostRequirement(false)}
          />
        </Suspense>
      )}

      <section className="bg-white py-12 shadow-sm relative z-10 -mt-8 rounded-t-3xl border-t border-slate-100 mx-4 lg:mx-0">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
            <div>
              <h2 className="text-3xl font-extrabold text-slate-900 mb-1">Browse by Category</h2>
            </div>

            {hasMoreHeads && (
              <button
                type="button"
                onClick={() => setShowAllHeads((value) => !value)}
                className="text-sm font-semibold text-blue-700 hover:text-blue-900 underline underline-offset-4"
              >
                {showAllHeads ? 'View less' : 'View more'}
              </button>
            )}
          </div>

          {loadingCategories ? (
            <CategorySkeleton />
          ) : (
            <div className="space-y-8">
              {visibleHeads.map((head) => (
                <HeadCategoryShowcase
                  key={head.id}
                  head={head}
                  subcategories={head.subcategories || []}
                  subLimit={SUB_INITIAL_LIMIT}
                  microPreviewLimit={MICRO_PREVIEW_LIMIT}
                  leftOverlayLimit={5}
                />
              ))}

              {homeCategories.length === 0 && (
                <div className="text-center text-slate-500 py-10">No categories found.</div>
              )}

              {hasMoreHeads && (
                <div className="flex justify-center pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAllHeads((value) => !value)}
                    className="px-6 py-3 rounded-md bg-white border border-slate-200 hover:border-blue-500 hover:shadow-md transition-all font-semibold text-slate-800"
                  >
                    {showAllHeads ? 'View less' : 'View more categories'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <TopCitiesSection />
      <PremiumBrandsSection />

      <section className="bg-slate-50 container mx-auto px-4 py-16">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 mb-2">Featured Suppliers</h2>
            <p className="text-slate-500">Trusted partners for your business needs</p>
          </div>

          <Button
            variant="link"
            className="text-blue-600 font-semibold hover:text-blue-800 p-0 h-auto"
            onClick={() => navigate('/directory/vendor')}
          >
            View More Suppliers <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>

        {loadingVendors ? (
          <VendorGridSkeleton />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
            {visibleFeaturedVendors.map((vendor) => (
              <article
                key={vendor.id}
                className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-2.5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] transition-all hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_18px_42px_rgba(15,23,42,0.11)] cursor-pointer"
                role="link"
                tabIndex={0}
                aria-label={`Open ${vendor.name} supplier profile`}
                onClick={() => navigate(getVendorProfilePath(vendor) || '/directory/vendor')}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    navigate(getVendorProfilePath(vendor) || '/directory/vendor');
                  }
                }}
              >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-blue-50/80 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

                <div className="relative h-24 mb-3 overflow-hidden rounded-xl border border-slate-100 bg-slate-100">
                  <VendorImage src={vendor.image} name={vendor.name} />
                  {vendor.verified && (
                    <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full border border-emerald-100 bg-white/95 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 shadow-sm backdrop-blur-sm">
                      <CheckCircle className="w-3 h-3 fill-emerald-100" /> Verified
                    </span>
                  )}
                </div>

                <div className="relative space-y-2 px-0.5">
                  <div>
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-blue-500/80">
                      Supplier Partner
                    </p>
                    <h3 className="min-h-[20px] text-sm font-bold leading-5 text-slate-950 line-clamp-1 transition-colors group-hover:text-[#003D82]">
                      {vendor.name}
                    </h3>
                  </div>

                  <div className="flex min-h-[18px] items-center text-xs text-slate-500">
                    <MapPin className="w-3.5 h-3.5 mr-1.5 text-blue-500/70" /> {vendor.city}, {vendor.state}
                  </div>

                  <Button className="mt-1 h-8 w-full rounded-lg border border-[#003D82]/15 bg-[#003D82] text-xs font-semibold text-white shadow-[0_8px_18px_rgba(0,61,130,0.18)] transition-all hover:bg-[#002B5C] hover:shadow-[0_10px_22px_rgba(0,61,130,0.24)]">
                    Contact Supplier
                  </Button>
                </div>
              </article>
            ))}

            {featuredVendors.length === 0 && (
              <div className="col-span-full text-center text-slate-500 py-10">No featured vendors found.</div>
            )}
          </div>
        )}
      </section>

      <section className="container mx-auto px-4 pb-16">
        <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-gradient-to-br from-slate-950 via-[#0b3c7c] to-sky-700 px-6 py-10 shadow-xl md:px-10">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div className="space-y-4">
              <span className="inline-flex w-fit rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-sky-100">
                Quick Requirement Desk
              </span>
              <div className="space-y-3">
                <h2 className="max-w-2xl text-3xl font-extrabold tracking-tight text-white md:text-4xl">
                  Tell us your requirement and let verified suppliers come to you.
                </h2>
                <p className="max-w-2xl text-sm leading-6 text-sky-100/85 md:text-base">
                  Share your product, quantity, and location once. The marketplace team can route your enquiry to relevant suppliers without making you browse page by page.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  onClick={() => setShowPostRequirement(true)}
                  className="h-12 rounded-full bg-white px-6 text-sm font-semibold text-slate-950 hover:bg-sky-50"
                >
                  Tell Us Your Requirement
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/directory')}
                  className="h-12 rounded-full border-white/30 bg-transparent px-6 text-sm font-semibold text-white hover:bg-white/10"
                >
                  Browse Categories
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-100/70">Step 1</p>
                <p className="mt-2 text-sm font-semibold text-white">Describe what you need</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-100/70">Step 2</p>
                <p className="mt-2 text-sm font-semibold text-white">Add quantity and delivery city</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-100/70">Step 3</p>
                <p className="mt-2 text-sm font-semibold text-white">Receive responses from suppliers</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default HomeDeferredSections;
