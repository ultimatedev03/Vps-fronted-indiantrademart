import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';
import { Handshake, MapPin, Search, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { dbClient } from '@/lib/dbClient';
import { urlParser } from '@/shared/utils/urlParser';

const slugify = (value) => {
  if (!value) return '';
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

const buildVendorListingUrl = (stateSlug = '', citySlug = '', locationText = '') => {
  const params = new URLSearchParams();
  if (stateSlug) params.set('state', stateSlug);
  if (citySlug) params.set('city', citySlug);
  if (!stateSlug && !citySlug && locationText) {
    params.set('cityText', locationText);
  }

  const query = params.toString();
  return query ? `/directory/vendor?${query}` : '/directory/vendor';
};

// Extract inline location from query like:
// "land survey in delhi" -> { cleanQuery: "land survey", inlineLocation: "delhi" }
const extractInlineLocation = (q = '') => {
  const text = (q || '').trim();
  if (!text) return { cleanQuery: '', inlineLocation: '' };

  // prefer last occurrence of " in " or " near "
  const match = text.match(/\s+(?:in|near)\s+([^,]+)$/i);
  if (!match) return { cleanQuery: text, inlineLocation: '' };

  const inlineLocation = (match[1] || '').trim();
  const cleanQuery = text.slice(0, match.index).trim();
  return { cleanQuery, inlineLocation };
};

// Resolve a free-text location to { stateSlug, citySlug }
// Supports:
// - "Delhi" (state)
// - "West Delhi" (city) -> looks up city, then fetches its state
// - "Katihar, Bihar" (city, state)
const resolveLocationSlugs = async (locationText = '') => {
  const raw = (locationText || '').trim();
  if (!raw) return { stateSlug: '', citySlug: '' };

  // If user typed "City, State"
  if (raw.includes(',')) {
    const [cityPart, statePart] = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const stateSlug = slugify(statePart || '');
    const citySlug = slugify(cityPart || '');
    return { stateSlug, citySlug };
  }

  const maybeSlug = slugify(raw);
  if (!maybeSlug) return { stateSlug: '', citySlug: '' };

  // 1) Try state first
  try {
    const { data: sData } = await dbClient
      .from('states')
      .select('id, slug, name')
      .eq('slug', maybeSlug)
      .maybeSingle();

    if (sData?.slug) {
      return { stateSlug: sData.slug, citySlug: '' };
    }
  } catch (e) {
    // ignore
  }

  // 2) Try city and fetch its state
  try {
    const { data: cData } = await dbClient
      .from('cities')
      .select('slug, state_id, name')
      .eq('slug', maybeSlug)
      .maybeSingle();

    if (cData?.slug && cData?.state_id) {
      const { data: sData } = await dbClient
        .from('states')
        .select('slug')
        .eq('id', cData.state_id)
        .maybeSingle();

      if (sData?.slug) {
        return { stateSlug: sData.slug, citySlug: cData.slug };
      }
    }
  } catch (e) {
    // ignore
  }

  // 3) Try state by name
  try {
    const { data: sData } = await dbClient
      .from('states')
      .select('id, slug, name')
      .ilike('name', raw)
      .limit(1)
      .maybeSingle();

    if (sData?.slug) {
      return { stateSlug: sData.slug, citySlug: '' };
    }
  } catch (e) {
    // ignore
  }

  // 4) Try city by name and resolve its state
  try {
    const { data: cData } = await dbClient
      .from('cities')
      .select('slug, state_id, name')
      .ilike('name', raw)
      .limit(1)
      .maybeSingle();

    if (cData?.slug && cData?.state_id) {
      const { data: sData } = await dbClient
        .from('states')
        .select('slug')
        .eq('id', cData.state_id)
        .maybeSingle();

      if (sData?.slug) {
        return { stateSlug: sData.slug, citySlug: cData.slug };
      }
    }
  } catch (e) {
    // ignore
  }

  return { stateSlug: '', citySlug: '' };
};

const HeroSection = () => {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    const q0 = (query || '').trim();

    // If user typed "... in delhi" inside query and left location empty, extract it.
    let finalLocationText = (location || '').trim();
    let finalQueryText = q0;

    if (!finalLocationText) {
      const { cleanQuery, inlineLocation } = extractInlineLocation(q0);
      if (inlineLocation) {
        finalLocationText = inlineLocation;
        finalQueryText = cleanQuery || q0;
        // update UI (optional, but helps user understand)
        setLocation(inlineLocation);
        setQuery(cleanQuery);
      }
    }

    if (!finalQueryText && !finalLocationText) return;

    const { stateSlug, citySlug } = await resolveLocationSlugs(finalLocationText);

    if (!finalQueryText) {
      navigate(buildVendorListingUrl(stateSlug, citySlug, finalLocationText));
      return;
    }

    const serviceSlug = slugify(finalQueryText);
    if (!serviceSlug) return;

    if (stateSlug || citySlug) {
      navigate(urlParser.createStructuredUrl(serviceSlug, stateSlug, citySlug));
      return;
    }

    if (finalLocationText) {
      const params = new URLSearchParams();
      params.set('q', finalQueryText);
      params.set('loc', finalLocationText);
      navigate(`/directory/search/${serviceSlug}?${params.toString()}`);
      return;
    }

    navigate(urlParser.createStructuredUrl(serviceSlug, '', ''));
  };

  return (
    <section className="relative isolate min-h-[650px] overflow-hidden bg-[#06172b] text-white sm:min-h-[690px] lg:min-h-[720px]">
      <img
        src="/media/itm-marketplace-story.webp"
        alt="Business representatives completing a trusted trade partnership"
        className="absolute inset-0 -z-30 h-full w-full object-cover object-[62%_center] sm:object-center"
        width="1600"
        height="900"
        loading="eager"
        decoding="async"
        fetchPriority="high"
      />
      {!reduceMotion ? (
        <video
          className="pointer-events-none absolute inset-0 -z-20 h-full w-full object-cover object-[62%_center] sm:object-center"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster="/media/itm-marketplace-story.webp"
          disablePictureInPicture
          controlsList="nodownload noplaybackrate noremoteplayback"
          aria-hidden="true"
        >
          <source src="/media/itm-marketplace-story.webm" type="video/webm" />
        </video>
      ) : null}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[#07192b]/45" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(3,19,38,0.96)_0%,rgba(3,19,38,0.8)_46%,rgba(3,19,38,0.28)_78%,rgba(3,19,38,0.4)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-40 bg-[linear-gradient(180deg,transparent,rgba(3,19,38,0.9))]" />

      <div className="relative z-10 mx-auto flex min-h-[650px] w-[92vw] max-w-7xl flex-col justify-center py-12 sm:min-h-[690px] sm:py-16 lg:min-h-[720px]">
        <div className="max-w-3xl">
          <div className="mb-5 inline-flex items-center border-l-2 border-orange-400 bg-black/25 px-3 py-2 text-xs font-bold uppercase tracking-normal text-orange-200 backdrop-blur-sm sm:text-sm">
            India's marketplace for real business intent
          </div>

          <h1 className="max-w-3xl text-balance text-[2.55rem] font-extrabold leading-[1.02] tracking-normal sm:text-6xl lg:text-7xl">
            Trusted Indian trade,
            <span className="block text-orange-400">from search to handshake.</span>
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-200 sm:text-lg sm:leading-8">
            Discover active manufacturers, suppliers, products, and service partners across India, then move from a clear requirement to a confident business conversation.
          </p>
        </div>

        <div className="mt-8 w-full max-w-5xl">
          <form onSubmit={handleSearch} className="flex flex-col gap-2 border border-white/20 bg-[#06172b]/80 p-2 shadow-2xl backdrop-blur-md md:flex-row">
            <div className="flex items-center border border-white/10 bg-white/[0.08] px-4 transition-colors focus-within:border-orange-300/70 md:w-1/3">
              <MapPin className="mr-3 h-5 w-5 flex-shrink-0 text-orange-300" />
              <Input
                className="h-14 !border-0 !bg-transparent !px-0 font-medium text-white caret-orange-300 shadow-none outline-none placeholder:text-slate-300/75 focus-visible:!outline-none focus-visible:!ring-0 focus-visible:!ring-offset-0 focus-visible:!shadow-none"
                placeholder="Location (e.g. Mumbai)"
                aria-label="Search location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>

            <div className="flex flex-1 items-center border border-white/10 bg-white/[0.08] px-4 transition-colors focus-within:border-orange-300/70">
              <Search className="mr-3 h-5 w-5 flex-shrink-0 text-orange-300" />
              <Input
                className="h-14 !border-0 !bg-transparent !px-0 font-medium text-white caret-orange-300 shadow-none outline-none placeholder:text-slate-300/75 focus-visible:!outline-none focus-visible:!ring-0 focus-visible:!ring-offset-0 focus-visible:!shadow-none"
                placeholder="Search products or suppliers"
                aria-label="Search products services or companies"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <Button
              type="submit"
              className="h-14 w-full rounded-none border border-orange-300 bg-orange-500 px-8 text-base font-bold text-slate-950 shadow-none transition-colors hover:bg-orange-400 md:w-auto"
            >
              Search marketplace
            </Button>
          </form>
        </div>

        <div className="mt-6 grid max-w-4xl gap-3 text-sm text-slate-200 sm:grid-cols-3">
          <div className="flex items-center gap-2 border-t border-white/20 pt-3">
            <ShieldCheck className="h-4 w-4 text-orange-300" /> Verified business signals
          </div>
          <div className="flex items-center gap-2 border-t border-white/20 pt-3">
            <MapPin className="h-4 w-4 text-orange-300" /> Pan-India discovery
          </div>
          <div className="flex items-center gap-2 border-t border-white/20 pt-3">
            <Handshake className="h-4 w-4 text-orange-300" /> Direct business enquiries
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
