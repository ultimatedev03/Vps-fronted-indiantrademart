import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin } from 'lucide-react';
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
    <section className="relative isolate overflow-hidden bg-[#0b3f7a] pt-8 pb-11 text-white sm:pt-10 sm:pb-14 lg:pt-12 lg:pb-20">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#0d4f91_0%,#0a3a72_42%,#082f66_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(180deg,transparent,rgba(2,6,23,0.16))]" />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 text-center sm:px-6">
        <div className="mb-4 inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-blue-100 shadow-sm sm:text-sm">
          <span className="mr-2 flex h-2 w-2 rounded-full bg-[#2dd4bf]"></span>
          India's Leading B2B Marketplace
        </div>

        <h1
          className="mx-auto mb-4 max-w-4xl text-balance text-[2.25rem] font-extrabold leading-[1.05] tracking-normal sm:text-5xl lg:text-6xl"
        >
          Connect with Trusted <br className="hidden sm:block" />
          <span className="text-cyan-200">
            Manufacturers & Suppliers
          </span>
        </h1>

        <p
          className="mx-auto mb-6 max-w-2xl text-base leading-7 text-slate-100 sm:text-lg"
        >
          Discover verified business partners, source quality products, and grow your network with confidence on our
          secure platform.
        </p>

        <div
          className="mx-auto w-full max-w-4xl"
        >
          {/* Glassmorphism search form */}
          <form onSubmit={handleSearch} className="flex flex-col gap-2 rounded-2xl border border-cyan-200/20 bg-[#07346b] p-2 shadow-lg md:flex-row">
            {/* Location Input */}
            <div className="flex items-center rounded-xl border border-cyan-100/10 bg-[#123d70] px-4 transition-colors focus-within:border-cyan-300/60 md:w-1/3">
              <MapPin className="h-5 w-5 text-blue-200 mr-3 flex-shrink-0" />
              <Input
                className="!border-0 !bg-transparent !px-0 h-14 text-white caret-cyan-200 placeholder:text-blue-100/55 font-medium shadow-none outline-none focus-visible:!outline-none focus-visible:!ring-0 focus-visible:!ring-offset-0 focus-visible:!shadow-none"
                placeholder="Location (e.g. Mumbai)"
                aria-label="Search location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>

            {/* Keyword Input */}
            <div className="flex flex-1 items-center rounded-xl border border-cyan-100/10 bg-[#123d70] px-4 transition-colors focus-within:border-cyan-300/60">
              <Search className="h-5 w-5 text-blue-200 mr-3 flex-shrink-0" />
              <Input
                className="!border-0 !bg-transparent !px-0 h-14 text-white caret-cyan-200 placeholder:text-blue-100/55 font-medium shadow-none outline-none focus-visible:!outline-none focus-visible:!ring-0 focus-visible:!ring-offset-0 focus-visible:!shadow-none"
                placeholder="Search products or suppliers"
                aria-label="Search products services or companies"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            {/* Search Button */}
            <Button
              type="submit"
              className="h-14 w-full rounded-xl border border-white/10 bg-[#00a699] px-8 text-lg font-bold text-white shadow-sm transition-colors hover:bg-[#048f86] md:w-auto"
            >
              Search
            </Button>
          </form>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-sm text-slate-200 sm:gap-3">
          <span className="font-semibold text-blue-200/80">Trending:</span>
          {['Industrial Machinery', 'Textiles', 'Chemicals', 'Electronics'].map((trend) => (
            <button
              key={trend}
              onClick={() => setQuery(trend)}
              className="rounded-full border border-cyan-100/15 bg-[#123d70] px-3 py-2 text-blue-100 transition-colors hover:border-cyan-300/50 hover:text-white sm:px-4"
            >
              {trend}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
