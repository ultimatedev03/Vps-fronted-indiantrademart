import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/customSupabaseClient';
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
    const { data: sData } = await supabase
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
    const { data: cData } = await supabase
      .from('cities')
      .select('slug, state_id, name')
      .eq('slug', maybeSlug)
      .maybeSingle();

    if (cData?.slug && cData?.state_id) {
      const { data: sData } = await supabase
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
    const { data: sData } = await supabase
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
    const { data: cData } = await supabase
      .from('cities')
      .select('slug, state_id, name')
      .ilike('name', raw)
      .limit(1)
      .maybeSingle();

    if (cData?.slug && cData?.state_id) {
      const { data: sData } = await supabase
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
    <div className="relative bg-slate-900 pt-20 pb-24 lg:pt-32 lg:pb-40 overflow-hidden">
      {/* Professional Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-[#003D82] to-slate-900 opacity-90 z-0"></div>

      {/* Decorative Abstract Shapes with Framer Motion */}
      <motion.div 
        animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
        transition={{ duration: 8, repeat: Infinity }}
        className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-[#00F0FF] opacity-10 blur-[100px]"
      />
      <motion.div 
        animate={{ scale: [1, 1.3, 1], opacity: [0.1, 0.3, 0.1] }}
        transition={{ duration: 10, repeat: Infinity, delay: 2 }}
        className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-[#8A2BE2] opacity-10 blur-[100px]"
      />

      <div className="container mx-auto px-4 relative z-10 text-center">
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium text-blue-200 ring-1 ring-inset ring-white/20 bg-white/5 backdrop-blur-md mb-6 shadow-[0_0_15px_rgba(0,240,255,0.2)]"
        >
          <span className="flex h-2 w-2 rounded-full bg-[#00F0FF] mr-2 shadow-[0_0_8px_#00F0FF]"></span>
          India's Leading B2B Marketplace
        </motion.div>

        <motion.h1 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-4xl md:text-6xl font-extrabold text-white mb-6 tracking-tight"
        >
          Connect with Trusted <br className="hidden md:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00F0FF] to-blue-400 drop-shadow-[0_0_15px_rgba(0,61,130,0.5)]">
            Manufacturers & Suppliers
          </span>
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-lg md:text-xl text-slate-300 mb-10 max-w-2xl mx-auto leading-relaxed"
        >
          Discover verified business partners, source quality products, and grow your network with confidence on our
          secure platform.
        </motion.p>

        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="max-w-4xl mx-auto"
        >
          {/* Glassmorphism search form */}
          <form onSubmit={handleSearch} className="bg-[#082a59]/80 backdrop-blur-xl border border-cyan-200/20 p-2 rounded-2xl shadow-[0_18px_45px_rgba(0,18,48,0.35)] flex flex-col md:flex-row gap-2">
            {/* Location Input */}
            <div className="flex items-center md:w-1/3 px-4 bg-[#123d70]/70 rounded-xl border border-cyan-100/10 focus-within:border-cyan-300/60 focus-within:bg-[#174b82]/85 focus-within:shadow-[0_0_0_1px_rgba(103,232,249,0.18)] transition-all duration-300">
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
            <div className="flex items-center flex-1 px-4 bg-[#123d70]/70 rounded-xl border border-cyan-100/10 focus-within:border-cyan-300/60 focus-within:bg-[#174b82]/85 focus-within:shadow-[0_0_0_1px_rgba(103,232,249,0.18)] transition-all duration-300">
              <Search className="h-5 w-5 text-blue-200 mr-3 flex-shrink-0" />
              <Input
                className="!border-0 !bg-transparent !px-0 h-14 text-white caret-cyan-200 placeholder:text-blue-100/55 font-medium shadow-none outline-none focus-visible:!outline-none focus-visible:!ring-0 focus-visible:!ring-offset-0 focus-visible:!shadow-none"
                placeholder="Search products, services, or companies..."
                aria-label="Search products services or companies"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            {/* Search Button */}
            <Button
              type="submit"
              className="h-14 px-8 bg-gradient-to-r from-[#00A699] to-[#003D82] hover:opacity-90 text-white font-bold text-lg rounded-xl shadow-[0_0_15px_rgba(0,166,153,0.4)] md:w-auto w-full transition-all duration-300 border border-white/10"
            >
              Search
            </Button>
          </form>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="mt-8 flex flex-wrap justify-center items-center gap-4 text-sm text-slate-400"
        >
          <span className="font-semibold text-blue-200/80">Trending:</span>
          {['Industrial Machinery', 'Textiles', 'Chemicals', 'Electronics'].map((trend) => (
            <button
              key={trend}
              onClick={() => setQuery(trend)}
              className="px-4 py-2 rounded-full border border-cyan-100/15 bg-[#123d70]/45 text-blue-100/70 shadow-sm backdrop-blur-sm transition-all hover:border-cyan-300/50 hover:bg-[#145087]/70 hover:text-[#00F0FF]"
            >
              {trend}
            </button>
          ))}
        </motion.div>
      </div>
    </div>
  );
};

export default HeroSection;
