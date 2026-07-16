import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import HeroSection from '@/modules/directory/components/HeroSection';
import { toAbsoluteSiteUrl } from '@/lib/siteUrl';
import { HOME_FAQS } from '@/modules/directory/pages/homeStoryContent';

const HomeDeferredSections = lazy(() => import('./HomeDeferredSections'));

const HomeSectionsFallback = () => (
  <div className="bg-[#fbfaf7] py-12 sm:py-16" aria-hidden="true">
    <div className="mx-auto w-[92vw] max-w-[1400px] animate-pulse">
      <div className="h-3 w-28 bg-orange-200" />
      <div className="mt-4 h-8 w-full max-w-md bg-slate-200" />
      <div className="mt-3 h-4 w-full max-w-xl bg-slate-100" />
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div
            key={`home-section-placeholder-${index}`}
            className="h-32 border border-slate-200 bg-white"
          />
        ))}
      </div>
    </div>
  </div>
);

const HOME_SEO = {
  title: 'B2B Marketplace India | Indian Trade Mart',
  description:
    'Find verified manufacturers, suppliers and exporters across India. Compare products and request free B2B quotations on Indian Trade Mart today.',
  keywords:
    'B2B marketplace India, manufacturers in India, suppliers in India, exporters in India, wholesale marketplace, industrial products, business directory',
};

const PRECONNECT_ORIGINS = [
].filter(Boolean);

const SITE_URL = toAbsoluteSiteUrl('/');
const ORGANIZATION_ID = `${SITE_URL}#organization`;
const WEBSITE_ID = `${SITE_URL}#website`;
const OG_IMAGE_URL = toAbsoluteSiteUrl('/favicon-512x512.png');
const SEARCH_TARGET_URL = toAbsoluteSiteUrl('/directory/search/{search_term_string}');

const STRUCTURED_DATA = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': ORGANIZATION_ID,
      name: 'Indian Trade Mart',
      url: SITE_URL,
      logo: OG_IMAGE_URL,
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
      '@id': WEBSITE_ID,
      url: SITE_URL,
      name: 'Indian Trade Mart',
      description: HOME_SEO.description,
      publisher: { '@id': ORGANIZATION_ID },
      potentialAction: {
        '@type': 'SearchAction',
        target: SEARCH_TARGET_URL,
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@type': ['LocalBusiness', 'Organization'],
      '@id': `${SITE_URL}#localbusiness`,
      name: 'Indian Trade Mart',
      url: SITE_URL,
      image: OG_IMAGE_URL,
      telephone: '+91-7290010051',
      email: 'support@indiantrademart.com',
      priceRange: 'Free registration',
      areaServed: { '@type': 'Country', name: 'India' },
      parentOrganization: { '@id': ORGANIZATION_ID },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${SITE_URL}#breadcrumb`,
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: SITE_URL,
        },
      ],
    },
    {
      '@type': 'FAQPage',
      '@id': `${SITE_URL}#faq`,
      mainEntity: HOME_FAQS.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })),
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
    let enabled = false;

    const enable = () => {
      if (enabled) return;
      enabled = true;
      setLoadDeferredSections(true);
    };

    const interactionEvents = ['scroll', 'pointerdown', 'keydown', 'touchstart'];
    interactionEvents.forEach((eventName) => {
      window.addEventListener(eventName, enable, { once: true, passive: true });
    });

    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(enable, { timeout: 1200 });
    } else {
      timeoutId = window.setTimeout(enable, 180);
    }

    return () => {
      interactionEvents.forEach((eventName) => {
        window.removeEventListener(eventName, enable);
      });
      if (timeoutId) window.clearTimeout(timeoutId);
      if (idleId && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId);
      }
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-[#f6f8f7] font-sans">
      <Helmet>
        <title>{HOME_SEO.title}</title>
        <meta name="description" content={HOME_SEO.description} />
        <meta name="keywords" content={HOME_SEO.keywords} />
        <meta property="og:title" content={HOME_SEO.title} />
        <meta property="og:description" content={HOME_SEO.description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={SITE_URL} />
        <meta property="og:image" content={OG_IMAGE_URL} />
        <meta name="twitter:card" content="summary_large_image" />
        <link rel="canonical" href={SITE_URL} />
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
      <Suspense fallback={<HomeSectionsFallback />}>
        {loadDeferredSections ? <HomeDeferredSections /> : <HomeSectionsFallback />}
      </Suspense>
    </div>
  );
};

export default Home;
