import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Loader2 } from 'lucide-react';
import MarketplaceSearchPanel from '@/modules/directory/components/MarketplaceSearchPanel';
import HeadCategoryShowcase from '@/modules/directory/components/HeadCategoryShowcase';
import { categoryApi } from '@/modules/directory/services/categoryApi';

const DIRECTORY_SEO = {
  title: 'Indian Business Directory | Products & Suppliers',
  description:
    'Browse Indian manufacturers, suppliers, products and services by category and city. Compare active businesses and request free quotations on Indian Trade Mart.',
  keywords:
    'Business directory, india business directory, directory of companies, exporter importer directory, companies directory in india, companies database india, business directory in india, business listings, companies directories, online business directory, free directory, Indian companies directory, free business listings in india, free business listings, business directory, companies directory, business to business companies, directory of indian companies, exporters business directory, companies business listings, companies directory india, free indian companies business listings, indiamart',
};

const Directory = () => {
  const [homeCategories, setHomeCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const INITIAL_LIMIT = 4;

  useEffect(() => {
    const load = async () => {
      setLoadingCategories(true);
      try {
        // ✅ Head + Sub + Micro (all from DB) — no hardcode
        const data = await categoryApi.getHomeShowcaseCategories();
        setHomeCategories(data || []);
      } catch (e) {
        console.error('Failed to load directory categories:', e);
      } finally {
        setLoadingCategories(false);
      }
    };
    load();
  }, []);

  const visibleHeads = useMemo(() => {
    if (showAll) return homeCategories;
    return homeCategories.slice(0, INITIAL_LIMIT);
  }, [homeCategories, showAll]);

  const hasMore = homeCategories.length > INITIAL_LIMIT;

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <Helmet>
        <title>{DIRECTORY_SEO.title}</title>
        <meta name="description" content={DIRECTORY_SEO.description} />
        <meta name="keywords" content={DIRECTORY_SEO.keywords} />
      </Helmet>

      <section className="relative isolate overflow-hidden bg-[#14253a] py-14 text-white sm:py-20">
        <img
          src="/media/itm-marketplace-story.webp?v=20260716-directory"
          alt="Indian manufacturers and suppliers in the business directory"
          className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
          width="1600"
          height="900"
          loading="eager"
          decoding="async"
        />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(8,27,47,0.96),rgba(8,27,47,0.72),rgba(8,27,47,0.45))]" />
        <div className="mx-auto w-[92vw] max-w-7xl">
          <p className="text-xs font-extrabold uppercase text-orange-300">The active Indian business catalogue</p>
          <h1 className="itm-display mt-3 max-w-3xl text-4xl leading-tight sm:text-6xl">Find the market behind every requirement.</h1>
          <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-slate-200 sm:text-lg">
            Search products, categories, suppliers, and cities across verified marketplace records, then explore the complete industry hierarchy below.
          </p>
          <div className="mt-8 max-w-5xl text-slate-900">
            <MarketplaceSearchPanel compact />
          </div>
        </div>
      </section>

      {/* ✅ Browse Industries (IndiaMART style showcase) */}
      <div className="mx-auto w-[92vw] max-w-7xl py-12 sm:py-16">
        <div className="flex items-center justify-between gap-4 mb-8">
          <h2 className="itm-display text-3xl text-slate-950 sm:text-4xl">Browse industries</h2>

          {hasMore && !loadingCategories && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="text-sm font-semibold text-blue-700 hover:text-blue-900 underline underline-offset-4"
            >
              {showAll ? 'View less' : 'View more'}
            </button>
          )}
        </div>

        {loadingCategories ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="space-y-8">
            {visibleHeads.map((head) => (
              <HeadCategoryShowcase
                key={head.id}
                head={head}
                subcategories={head.subcategories || []}
                subLimit={9}
                microPreviewLimit={3}
                leftOverlayLimit={5}
              />
            ))}

            {homeCategories.length === 0 && (
              <div className="text-center text-slate-500 py-10">No categories found.</div>
            )}

            {hasMore && (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={() => setShowAll((v) => !v)}
                  className="px-6 py-3 rounded-md bg-white border border-slate-200 hover:border-blue-500 hover:shadow-md transition-all font-semibold text-slate-800"
                >
                  {showAll ? 'View less' : `View more (${homeCategories.length - INITIAL_LIMIT})`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Directory;
