import React, { startTransition, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { PREMIUM_BRANDS, getPremiumBrandTargetPath } from '@/modules/directory/lib/premiumBrands';

const preloadVendorProfilePage = () => import('@/modules/directory/pages/VendorProfile');

const PremiumBrandsSection = () => {
  const navigate = useNavigate();
  const visibleBrands = useMemo(
    () => PREMIUM_BRANDS.filter((brand) => brand.id !== 'itm'),
    []
  );
  const items = useMemo(() => [...visibleBrands, ...visibleBrands], [visibleBrands]);
  const [pendingBrandSlug, setPendingBrandSlug] = useState('');

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void preloadVendorProfilePage();
    }, 150);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const handleOpenBrand = (brandSlug) => {
    setPendingBrandSlug(brandSlug);
    void preloadVendorProfilePage();
    startTransition(() => {
      navigate(getPremiumBrandTargetPath(brandSlug));
    });
  };

  return (
    <section className="min-h-[228px] overflow-x-hidden border-b border-slate-200 bg-[#f4f6f5] py-16">
      <style>{`
        @keyframes brand-marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .marquee-wrap {
          overflow: hidden;
          width: 100%;
          position: relative;
        }
        .marquee-track {
          display: flex;
          width: max-content;
          animation: brand-marquee 35s linear infinite;
          will-change: transform;
        }
        .marquee-wrap:hover .marquee-track {
          animation-play-state: paused;
        }
        @media (prefers-reduced-motion: reduce) {
          .marquee-track { animation: none; transform: translateX(0); }
        }
      `}</style>

      <div className="mx-auto w-[92vw] max-w-7xl overflow-x-hidden">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-gray-900">
            Explore products from <span className="text-orange-700">Premium Brands</span>
          </h2>
        </div>

        <div className="marquee-wrap">
          <div className="marquee-track items-center gap-4 py-1 md:gap-5 lg:gap-6">
            {items.map((brand, idx) => (
              <button
                type="button"
                key={`${brand.id}-${idx}`}
                className={`relative flex h-20 min-w-[88px] flex-none cursor-pointer items-center justify-center border-0 bg-transparent px-3 py-1 transition-transform duration-300 hover:scale-105 md:min-w-[96px] md:px-4 ${pendingBrandSlug === brand.slug ? 'pointer-events-none' : ''}`}
                title={brand.name}
                aria-label={`Open ${brand.name} brand page`}
                aria-busy={pendingBrandSlug === brand.slug}
                onMouseEnter={() => {
                  void preloadVendorProfilePage();
                }}
                onFocus={() => {
                  void preloadVendorProfilePage();
                }}
                onClick={() => handleOpenBrand(brand.slug)}
              >
                <img
                  src={brand.logo_url}
                  alt={brand.name}
                  width="160"
                  height="64"
                  sizes="(min-width: 1024px) 176px, (min-width: 768px) 160px, 144px"
                  className={`max-h-12 w-auto w-[8vw] object-contain md:max-h-14 md:w-[9vw] lg:max-h-16 lg:w-[10vw] ${pendingBrandSlug === brand.slug ? 'opacity-35' : ''}`}
                  loading="lazy"
                  decoding="async"
                  onError={(event) => {
                    event.currentTarget.style.display = 'none';
                  }}
                />
                {pendingBrandSlug === brand.slug && (
                  <span className="absolute inset-0 flex items-center justify-center gap-2 text-sm font-medium text-slate-700">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Opening...
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default PremiumBrandsSection;
