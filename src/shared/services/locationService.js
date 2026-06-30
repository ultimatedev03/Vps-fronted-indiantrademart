import { dbClient } from '@/lib/dbClient';

const LOCATION_CACHE_TTL_MS = 5 * 60 * 1000;
const statesCache = { data: null, expiresAt: 0 };
const districtsCache = new Map();
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
const rememberDistricts = (stateId, rows = []) => {
  districtsCache.set(String(stateId || '').trim(), {
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

    const { data, error } = await dbClient
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

    const { data: fallback, error: fallbackError } = await dbClient
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

  getDistricts: async (stateId) => {
    if (!stateId) return [];
    const cacheKey = String(stateId || '').trim();
    const cached = districtsCache.get(cacheKey);
    if (cached && isFresh(cached.expiresAt)) return cached.data || [];

    const { data, error } = await dbClient
      .from('districts')
      .select('*')
      .eq('state_id', stateId)
      .eq('is_active', true)
      .order('name');
    if (error) console.error('Error fetching districts:', error);
    const rows = Array.isArray(data) ? data : [];
    rememberDistricts(cacheKey, rows);
    return rows;
  },

  // Fetch cities for a specific state and optional district
  getCities: async (stateId, districtId = '') => {
    if (!stateId) return [];

    const cacheKey = `${String(stateId || '').trim()}::${String(districtId || '').trim()}`;
    const cached = citiesCache.get(cacheKey);
    if (cached && isFresh(cached.expiresAt)) {
      return cached.data || [];
    }
    
    let query = dbClient
      .from('cities')
      .select('*')
      .eq('state_id', stateId)
      .eq('is_active', true);
    if (districtId) query = query.eq('district_id', districtId);
    query = query.order('name');
    const { data, error } = await query;
      
    if (error) {
      console.error('Error fetching cities (is_active filter):', error);
    }

    if (Array.isArray(data) && data.length > 0) {
      rememberCities(cacheKey, data);
      return data;
    }

    let fallbackQuery = dbClient
      .from('cities')
      .select('*')
      .eq('state_id', stateId);
    if (districtId) fallbackQuery = fallbackQuery.eq('district_id', districtId);
    fallbackQuery = fallbackQuery.order('name');
    const { data: fallback, error: fallbackError } = await fallbackQuery;

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

      return locationService.getCities(stateData.id);
    } catch (e) {
      console.error("Error fetching nearby cities", e);
      return [];
    }
  },

  // Helper to find location details by slug
  getLocationBySlug: async (stateSlug, citySlug, districtSlug = '') => {
    const cacheKey = `${String(stateSlug || '').trim()}::${String(districtSlug || '').trim()}::${String(citySlug || '').trim()}`;
    const cached = locationBySlugCache.get(cacheKey);
    if (cached && isFresh(cached.expiresAt)) {
      return cached.data || { state: null, district: null, city: null };
    }

    let state = null;
    let district = null;
    let city = null;

    const normalizedStateSlug = String(stateSlug || '').trim();
    const normalizedCitySlug = String(citySlug || '').trim();
    const normalizedDistrictSlug = String(districtSlug || '').trim();

    if (normalizedStateSlug) {
      try {
        const states = await locationService.getStates();
        state = (states || []).find((row) => String(row?.slug || '').trim() === normalizedStateSlug) || null;
      } catch (error) {
        console.error('State lookup failed', error);
      }
    }

    if (normalizedDistrictSlug && state?.id) {
      try {
        const districts = await locationService.getDistricts(state.id);
        district = (districts || []).find((row) => String(row?.slug || '').trim() === normalizedDistrictSlug) || null;
      } catch (error) {
        console.error('District lookup failed', error);
      }
    }

    if (normalizedCitySlug && state?.id) {
      try {
        const scopedCities = await locationService.getCities(state.id, district?.id || '');
        city = (scopedCities || []).find((row) => String(row?.slug || '').trim() === normalizedCitySlug) || null;
      } catch (error) {
        console.error('City lookup failed (state scoped)', error);
      }
    }

    // Only use the global city fallback when a state was not resolved.
    // If a state is resolved but the city slug is not inside that state, keep
    // the search state-scoped instead of accidentally picking the same city
    // slug from another state.
    if (normalizedCitySlug && !city && !state?.id) {
      try {
        const { data: cityFallback } = await dbClient
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
        const { data: stateFallback } = await dbClient
          .from('states')
          .select('*')
          .eq('id', city.state_id)
          .maybeSingle();
        state = stateFallback || null;
      } catch (error) {
        console.error('State fallback lookup failed', error);
      }
    }

    if (!district && city?.district_id) {
      try {
        const districts = await locationService.getDistricts(state?.id || city?.state_id);
        district = (districts || []).find((row) => String(row?.id || '') === String(city.district_id)) || null;
      } catch (error) {
        console.error('District fallback lookup failed', error);
      }
    }

    const resolved = { state, district, city };
    rememberLocation(cacheKey, resolved);
    return resolved;
  },

  seedLocations: async () => {
      return true;
  }
};
