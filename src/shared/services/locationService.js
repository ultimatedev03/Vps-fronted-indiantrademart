import { supabase } from '@/lib/customSupabaseClient';

const LOCATION_CACHE_TTL_MS = 5 * 60 * 1000;
const statesCache = { data: null, expiresAt: 0 };
const citiesCache = new Map();
const locationBySlugCache = new Map();

const isFresh = (expiresAt = 0) => expiresAt > Date.now();
const rememberStates = (rows = []) => {
  statesCache.data = rows || [];
  statesCache.expiresAt = Date.now() + LOCATION_CACHE_TTL_MS;
};
const rememberCities = (stateId, rows = []) => {
  citiesCache.set(String(stateId || '').trim(), {
    data: rows || [],
    expiresAt: Date.now() + LOCATION_CACHE_TTL_MS,
  });
};
const rememberLocation = (key, value) => {
  locationBySlugCache.set(key, {
    data: value,
    expiresAt: Date.now() + LOCATION_CACHE_TTL_MS,
  });
};

export const locationService = {
  // Fetch all states
  getStates: async () => {
    if (isFresh(statesCache.expiresAt) && Array.isArray(statesCache.data)) {
      return statesCache.data;
    }

    const { data, error } = await supabase
      .from('states')
      .select('*')
      .eq('is_active', true)
      .order('name');
    
    if (error) {
      console.error('Error fetching states (is_active filter):', error);
    }

    if (Array.isArray(data) && data.length > 0) {
      rememberStates(data);
      return data;
    }

    const { data: fallback, error: fallbackError } = await supabase
      .from('states')
      .select('*')
      .order('name');

    if (fallbackError) {
      console.error('Error fetching states:', fallbackError);
      return [];
    }
    rememberStates(fallback || []);
    return fallback || [];
  },

  // Fetch cities for a specific state
  getCities: async (stateId) => {
    if (!stateId) return [];

    const cacheKey = String(stateId || '').trim();
    const cached = citiesCache.get(cacheKey);
    if (cached && isFresh(cached.expiresAt)) {
      return cached.data || [];
    }
    
    const { data, error } = await supabase
      .from('cities')
      .select('*')
      .eq('state_id', stateId)
      .eq('is_active', true)
      .order('name');
      
    if (error) {
      console.error('Error fetching cities (is_active filter):', error);
    }

    if (Array.isArray(data) && data.length > 0) {
      rememberCities(cacheKey, data);
      return data;
    }

    const { data: fallback, error: fallbackError } = await supabase
      .from('cities')
      .select('*')
      .eq('state_id', stateId)
      .order('name');

    if (fallbackError) {
      console.error('Error fetching cities:', fallbackError);
      return [];
    }
    rememberCities(cacheKey, fallback || []);
    return fallback || [];
  },

  // Fetch cities by state slug for nearby navigation
  getCitiesByStateSlug: async (stateSlug) => {
    if (!stateSlug) return [];

    try {
      const states = await locationService.getStates();
      const stateData = (states || []).find((state) => String(state?.slug || '').trim() === String(stateSlug || '').trim());
      if (!stateData?.id) return [];

      const cities = await locationService.getCities(stateData.id);
      
      // Add fake cities if none exist (for demo purposes if DB is empty)
      if (cities.length === 0) {
         return [
            { id: '101', name: 'Gurugram', slug: 'gurugram' },
            { id: '102', name: 'Noida', slug: 'noida' },
            { id: '103', name: 'Faridabad', slug: 'faridabad' },
            { id: '104', name: 'Ghaziabad', slug: 'ghaziabad' },
            { id: '105', name: 'Rohtak', slug: 'rohtak' },
         ];
      }

      return cities;
    } catch (e) {
      console.error("Error fetching nearby cities", e);
      return [];
    }
  },

  // Helper to find location details by slug
  getLocationBySlug: async (stateSlug, citySlug) => {
    const cacheKey = `${String(stateSlug || '').trim()}::${String(citySlug || '').trim()}`;
    const cached = locationBySlugCache.get(cacheKey);
    if (cached && isFresh(cached.expiresAt)) {
      return cached.data || { state: null, city: null };
    }

    let state = null;
    let city = null;

    const normalizedStateSlug = String(stateSlug || '').trim();
    const normalizedCitySlug = String(citySlug || '').trim();

    if (normalizedStateSlug) {
      try {
        const states = await locationService.getStates();
        state = (states || []).find((row) => String(row?.slug || '').trim() === normalizedStateSlug) || null;
      } catch (error) {
        console.error('State lookup failed', error);
      }
    }

    if (normalizedCitySlug && state?.id) {
      try {
        const scopedCities = await locationService.getCities(state.id);
        city = (scopedCities || []).find((row) => String(row?.slug || '').trim() === normalizedCitySlug) || null;
      } catch (error) {
        console.error('City lookup failed (state scoped)', error);
      }
    }

    if (normalizedCitySlug && !city) {
      try {
        const { data: cityFallback } = await supabase
          .from('cities')
          .select('*')
          .eq('slug', normalizedCitySlug)
          .maybeSingle();
        city = cityFallback || null;
      } catch (error) {
        console.error('City lookup failed', error);
      }
    }

    if (!state && city?.state_id) {
      try {
        const { data: stateFallback } = await supabase
          .from('states')
          .select('*')
          .eq('id', city.state_id)
          .maybeSingle();
        state = stateFallback || null;
      } catch (error) {
        console.error('State fallback lookup failed', error);
      }
    }

    const resolved = { state, city };
    rememberLocation(cacheKey, resolved);
    return resolved;
  },

  seedLocations: async () => {
      return true;
  }
};
