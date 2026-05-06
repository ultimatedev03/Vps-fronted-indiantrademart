import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import HeroSection from '@/modules/directory/components/HeroSection';

const HomeDeferredSections = lazy(() => import('./HomeDeferredSections'));

const HOME_SEO = {
  title: 'Indian Trade Mart | B2B Marketplace for Manufacturers, Suppliers & Exporters in India',
  description:
    'Find verified manufacturers, suppliers, exporters and B2B service providers across India on Indian Trade Mart, the online marketplace for sourcing and business growth.',
  keywords:
    'online B2B marketplace, online B2B platform, Business directory, business directory in India, business e-commerce, business listings, B2C online marketplaces in India, Digital commerce platform, business website, business marketplace, companies business listings, companies database india, companies directory, companies directory india, directory of companies, directory of indian companies, service provider, e-commerce in india, trade & commerce, exporter importer directory, exporters business directory, exporters in india, free business listings, free business listings in india, free business marketplace, free indian companies business listings, free manufacturers directory india, importers, india business directory, india export import, india importers, Indian Trade Mart, indian business, Indian companies directory, indian exporters, indian exporters directory, indian manufacturers directory, indian market, indian service providers, manufacturers directory, manufacturers in india, online business directory, suppliers directory, yellow pages, Properties, Builder & Real Estate, Survey & Soil Investigation, Engineering Services, Construction Materials & Machines, Construction Materials & Machines, Electrical Equipment, Electronics & Electrical, R & D and Testing Labs, Business & Audit Services, Product Rental & Leasing, Product Rental & Leasing, Hand & Machine Tools, Mechanical Parts & Spares, Industrial Supplies, Industrial Plants & Machinery, Food & Beverages, Apparel & Garments, Packaging Machines & Goods, Chemicals, Dyes & Solvents, Lab Instruments & Supplies, Furniture & Supplies, Automobile, Parts & Spares, Housewares & Supplies, Metals, Alloys & Minerals, Handicrafts & Decorative, Kitchen Utensils & Appliances, Textiles, Yarn & Fabrics, Books & Stationery, Cosmetics & Personal Care, Home Textile & Furnishing, Drugs & Pharmaceuticals, Gems, Jewelry & Astrology, Computer & IT Solutions, Fashion Accessories & Gear, Herbal & Ayurvedic Product, Security Systems & Services, Sports Goods, Toys & Games, Paper & Paper Products, Bags, Belts & Wallets, Media, PR & Publishing, Marble, Granite & Stones, Event Planner & Organizer, IT & Telecom Services, Transportation & Logistics, Financial & Legal Services, Education & Training, Travel, Tourism & Hotels, Call Center & BPO Services, Bicycle, Rickshaw & Spares, Hospital & Diagnostics, HR Planning & Recruitment, Rail, Shipping & Aviation, House Keeping Services, Leather Products, Misc Contractors & Freelancers, Electronics Components, Hospital, Clinic & Consultation, Construction & Infrastructural Consultant, Album, Movies, Commercial Ads',
};

const getSupabaseOrigin = () => {
  const raw = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
  if (!raw) return '';

  try {
    return new URL(raw).origin;
  } catch {
    return '';
  }
};

const PRECONNECT_ORIGINS = [
  getSupabaseOrigin(),
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
  'https://images.unsplash.com',
  'https://eimager.com',
].filter(Boolean);

const STRUCTURED_DATA = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://indiantrademart.com/#organization',
      name: 'Indian Trade Mart',
      url: 'https://indiantrademart.com/',
      logo: 'https://indiantrademart.com/favicon-512x512.png',
      description: HOME_SEO.description,
      sameAs: [
        'https://www.facebook.com/IndianTradeMart/',
        'https://www.linkedin.com/company/indian-trade-mart-itm/',
        'https://www.instagram.com/indiantrademart/',
        'https://www.youtube.com/@itm-Indian-Trade-Mart',
      ],
      contactPoint: [
        {
          '@type': 'ContactPoint',
          contactType: 'customer support',
          email: 'support@indiantrademart.com',
          telephone: '+91-7290010051',
          areaServed: 'IN',
          availableLanguage: ['en', 'hi'],
        },
      ],
    },
    {
      '@type': 'WebSite',
      '@id': 'https://indiantrademart.com/#website',
      url: 'https://indiantrademart.com/',
      name: 'Indian Trade Mart',
      description: HOME_SEO.description,
      publisher: { '@id': 'https://indiantrademart.com/#organization' },
      potentialAction: {
        '@type': 'SearchAction',
        target: 'https://indiantrademart.com/directory/search/{search_term_string}',
        'query-input': 'required name=search_term_string',
      },
    },
  ],
};

const Home = () => {
  const [loadDeferredSections, setLoadDeferredSections] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setLoadDeferredSections(true);
      return undefined;
    }

    let timeoutId = null;
    let idleId = null;

    const enable = () => setLoadDeferredSections(true);
    const schedule = () => {
      if (typeof window.requestIdleCallback === 'function') {
        idleId = window.requestIdleCallback(enable, { timeout: 2500 });
        return;
      }
      timeoutId = window.setTimeout(enable, 800);
    };

    if (document.readyState === 'complete') {
      schedule();
    } else {
      const onLoad = () => {
        window.removeEventListener('load', onLoad);
        schedule();
      };
      window.addEventListener('load', onLoad, { once: true });
      timeoutId = window.setTimeout(onLoad, 1500);
    }

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      if (idleId && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId);
      }
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col font-sans bg-slate-50">
      <Helmet>
        <title>{HOME_SEO.title}</title>
        <meta name="description" content={HOME_SEO.description} />
        <meta name="keywords" content={HOME_SEO.keywords} />
        <meta property="og:title" content={HOME_SEO.title} />
        <meta property="og:description" content={HOME_SEO.description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://indiantrademart.com/" />
        <meta property="og:image" content="https://indiantrademart.com/favicon-512x512.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <link rel="canonical" href="https://indiantrademart.com/" />
        {PRECONNECT_ORIGINS.map((origin) => (
          <link
            key={`preconnect-${origin}`}
            rel="preconnect"
            href={origin}
            crossOrigin="anonymous"
          />
        ))}
        {PRECONNECT_ORIGINS.map((origin) => (
          <link key={`dns-${origin}`} rel="dns-prefetch" href={origin} />
        ))}
        <script type="application/ld+json">{JSON.stringify(STRUCTURED_DATA)}</script>
      </Helmet>

      <HeroSection />
      <Suspense fallback={<div className="min-h-[960px] bg-slate-50" aria-hidden="true" />}>
        {loadDeferredSections ? (
          <HomeDeferredSections />
        ) : (
          <div className="min-h-[960px] bg-slate-50" aria-hidden="true" />
        )}
      </Suspense>
    </div>
  );
};

export default Home;
