import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import HeroSection from '@/modules/directory/components/HeroSection';
import { toAbsoluteSiteUrl } from '@/lib/siteUrl';
import { HOME_FAQS } from '@/modules/directory/pages/homeStoryContent';

const HomeDeferredSections = lazy(() => import('./HomeDeferredSections'));

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
    let loadFallbackId = null;
    let enabled = false;

    const enable = () => {
      if (enabled) return;
      enabled = true;
      setLoadDeferredSections(true);
    };

    const scheduleIdle = () => {
      if (enabled) return;
      timeoutId = window.setTimeout(() => {
        if (typeof window.requestIdleCallback === 'function') {
          idleId = window.requestIdleCallback(enable, { timeout: 9000 });
          return;
        }
        enable();
      }, 6500);
    };

    const schedule = () => {
      scheduleIdle();
    };

    const interactionEvents = ['scroll', 'pointerdown', 'keydown', 'touchstart'];
    interactionEvents.forEach((eventName) => {
      window.addEventListener(eventName, enable, { once: true, passive: true });
    });

    if (document.readyState === 'complete') {
      schedule();
    } else {
      const onLoad = () => {
        window.removeEventListener('load', onLoad);
        if (loadFallbackId) {
          window.clearTimeout(loadFallbackId);
          loadFallbackId = null;
        }
        schedule();
      };
      window.addEventListener('load', onLoad, { once: true });
      loadFallbackId = window.setTimeout(onLoad, 4500);
    }

    return () => {
      interactionEvents.forEach((eventName) => {
        window.removeEventListener(eventName, enable);
      });
      if (timeoutId) window.clearTimeout(timeoutId);
      if (loadFallbackId) window.clearTimeout(loadFallbackId);
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
      <Suspense fallback={null}>
        {loadDeferredSections ? <HomeDeferredSections /> : null}
      </Suspense>
    </div>
  );
};

export default Home;
