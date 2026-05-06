import React, { useEffect, useMemo, useState } from 'react';
import { vendorApi } from '@/modules/vendor/services/vendorApi';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { Loader2, X, Save } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';

const dedupeCities = (rows = []) => {
  const cityMap = new Map();
  (rows || []).forEach((city) => {
    const key = String(city?.id || '').trim();
    if (!key || cityMap.has(key)) return;
    cityMap.set(key, city);
  });
  return Array.from(cityMap.values()).sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')));
};

const DEFAULT_LIMITS = { states: 2, cities: 20, categories: 5 };
const normalizeId = (value) => String(value ?? '').trim();
const readLimit = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const buildLookupMap = (rows = []) =>
  new Map(
    (rows || [])
      .map((row) => [normalizeId(row?.id), row])
      .filter(([id]) => id)
  );

const parsePreferenceLimits = (planObj) => {
  if (!planObj) return DEFAULT_LIMITS;
  let features = planObj?.features || {};
  if (typeof features === 'string') {
    try {
      features = JSON.parse(features);
    } catch {
      features = {};
    }
  }

  const coverage = features?.coverage && typeof features.coverage === 'object'
    ? features.coverage
    : {};

  return {
    states: readLimit(coverage.states_limit ?? features.states_limit, DEFAULT_LIMITS.states),
    cities: readLimit(coverage.cities_limit ?? features.cities_limit, DEFAULT_LIMITS.cities),
    categories: readLimit(features.categories_limit, DEFAULT_LIMITS.categories),
  };
};

const PreferencesSection = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const [preferences, setPreferences] = useState({
    preferred_micro_categories: [],
    preferred_states: [],
    preferred_cities: [],
    min_budget: 0,
    max_budget: 999999,
    auto_lead_filter: true
  });

  const [allStates, setAllStates] = useState([]);
  const [allCities, setAllCities] = useState([]);
  const [allHeadCategories, setAllHeadCategories] = useState([]);
  const [selectionLimits, setSelectionLimits] = useState(DEFAULT_LIMITS);

  const [selectedStateId, setSelectedStateId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedCityId, setSelectedCityId] = useState('');
  const MAX_STATES = selectionLimits.states;
  const MAX_CITIES = selectionLimits.cities;
  const MAX_CATEGORIES = selectionLimits.categories;

  const stateMap = useMemo(() => buildLookupMap(allStates), [allStates]);
  const cityMap = useMemo(() => buildLookupMap(allCities), [allCities]);
  const categoryMap = useMemo(() => buildLookupMap(allHeadCategories), [allHeadCategories]);
  const preferencesSnapshot = useMemo(() => JSON.stringify(preferences), [preferences]);
  const hasUnsavedChanges = preferencesSnapshot !== savedSnapshot;

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadCitiesForPreferredStates = async () => {
      const stateIds = Array.from(new Set((preferences.preferred_states || []).map((id) => String(id || '').trim()).filter(Boolean)));
      if (stateIds.length === 0) {
        if (!cancelled) {
          setAllCities([]);
          setPreferences((prev) => (
            (prev.preferred_cities || []).length > 0
              ? { ...prev, preferred_cities: [] }
              : prev
          ));
        }
        return;
      }

      try {
        const cityBuckets = await Promise.all(
          stateIds.map((stateId) => vendorApi.locations.getCities(stateId).catch(() => []))
        );
        if (cancelled) return;

        const mergedCities = dedupeCities(cityBuckets.flat());
        const allowedCityIds = new Set(mergedCities.map((city) => String(city?.id || '').trim()).filter(Boolean));

        setAllCities(mergedCities);
        setPreferences((prev) => {
          const nextPreferredCities = (prev.preferred_cities || []).filter((cityId) =>
            allowedCityIds.has(String(cityId || '').trim())
          );
          if (nextPreferredCities.length === (prev.preferred_cities || []).length) return prev;
          return { ...prev, preferred_cities: nextPreferredCities };
        });
      } catch (error) {
        if (!cancelled) {
          console.error('Error loading cities for preferred states:', error);
        }
      }
    };

    loadCitiesForPreferredStates();

    return () => {
      cancelled = true;
    };
  }, [preferences.preferred_states]);

  useEffect(() => {
    let cancelled = false;

    const hydrateMissingPreferredCities = async () => {
      const unresolvedCityIds = Array.from(
        new Set(
          (preferences.preferred_cities || [])
            .map((cityId) => normalizeId(cityId))
            .filter((cityId) => cityId && !cityMap.has(cityId))
        )
      );

      if (!unresolvedCityIds.length) return;

      try {
        const { data, error } = await supabase
          .from('cities')
          .select('id, name, state_id')
          .in('id', unresolvedCityIds);

        if (error) throw error;
        if (cancelled || !Array.isArray(data) || !data.length) return;

        setAllCities((prev) => dedupeCities([...(prev || []), ...data]));
      } catch (error) {
        if (!cancelled) {
          console.error('Error resolving preferred city names:', error);
        }
      }
    };

    hydrateMissingPreferredCities();

    return () => {
      cancelled = true;
    };
  }, [cityMap, preferences.preferred_cities]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statesRes, categoriesRes, prefsRes, activeSub] = await Promise.all([
        supabase
          .from('states')
          .select('id, name')
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('head_categories')
          .select('id, name')
          .eq('is_active', true)
          .order('name'),
        vendorApi.preferences.get(),
        vendorApi.subscriptions.getCurrent().catch(() => null),
      ]);

      if (statesRes.error) throw statesRes.error;
      if (categoriesRes.error) {
        console.error('Error loading head categories:', categoriesRes.error);
      }

      const nextStates = statesRes.data || [];
      const nextCategories = categoriesRes.data || [];
      const prefs = prefsRes || {
        preferred_micro_categories: [],
        preferred_states: [],
        preferred_cities: [],
        min_budget: 0,
        max_budget: 999999,
        auto_lead_filter: true,
      };
      const limits = parsePreferenceLimits(activeSub?.plan);

      const normalizedPreferences = {
        ...prefs,
        preferred_states: (prefs?.preferred_states || []).map((id) => normalizeId(id)).filter(Boolean).slice(0, limits.states),
        preferred_cities: (prefs?.preferred_cities || []).map((id) => normalizeId(id)).filter(Boolean).slice(0, limits.cities),
        preferred_micro_categories: (prefs?.preferred_micro_categories || []).map((id) => normalizeId(id)).filter(Boolean).slice(0, limits.categories),
      };

      setAllStates(nextStates);
      setAllHeadCategories(nextCategories);
      setSelectionLimits(limits);
      setPreferences(normalizedPreferences);
      setSavedSnapshot(JSON.stringify(normalizedPreferences));

      if ((!prefs?.preferred_states || prefs.preferred_states.length === 0) && nextStates.length > 0) {
        setSelectedStateId(normalizeId(nextStates[0].id));
      }
    } catch (e) {
      console.error('Error loading preferences data:', e);
      toast({
        title: 'Error loading preferences',
        description: e?.message || 'Something went wrong',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddState = async () => {
    const stateId = normalizeId(selectedStateId);
    if (!stateId) return;
    if ((preferences.preferred_states || []).some((id) => normalizeId(id) === stateId)) {
      toast({ title: 'Already added', variant: 'destructive' });
      return;
    }
    if (preferences.preferred_states.length >= MAX_STATES) {
      toast({ title: `Maximum ${MAX_STATES} states allowed`, variant: 'destructive' });
      return;
    }

    setPreferences(prev => ({
      ...prev,
      preferred_states: [...(prev.preferred_states || []), stateId]
    }));
    setSelectedStateId('');
  };

  const handleAddCity = async () => {
    const cityId = normalizeId(selectedCityId);
    if (!cityId) return;
    if ((preferences.preferred_cities || []).some((id) => normalizeId(id) === cityId)) {
      toast({ title: 'Already added', variant: 'destructive' });
      return;
    }
    if (preferences.preferred_cities.length >= MAX_CITIES) {
      toast({ title: `Maximum ${MAX_CITIES} cities allowed`, variant: 'destructive' });
      return;
    }

    setPreferences(prev => ({
      ...prev,
      preferred_cities: [...(prev.preferred_cities || []), cityId]
    }));
    setSelectedCityId('');
  };

  const handleAddCategory = async () => {
    const categoryId = normalizeId(selectedCategoryId);
    if (!categoryId) return;
    if ((preferences.preferred_micro_categories || []).some((id) => normalizeId(id) === categoryId)) {
      toast({ title: 'Already added', variant: 'destructive' });
      return;
    }
    if (preferences.preferred_micro_categories.length >= MAX_CATEGORIES) {
      toast({ title: `Maximum ${MAX_CATEGORIES} categories allowed`, variant: 'destructive' });
      return;
    }

    setPreferences(prev => ({
      ...prev,
      preferred_micro_categories: [...(prev.preferred_micro_categories || []), categoryId]
    }));
    setSelectedCategoryId('');
  };

  const handleRemoveState = (id) => {
    const normalizedId = normalizeId(id);
    setPreferences(prev => ({
      ...prev,
      preferred_states: (prev.preferred_states || []).filter((stateId) => normalizeId(stateId) !== normalizedId),
      preferred_cities: (prev.preferred_cities || []).filter((cityId) => {
        const city = cityMap.get(normalizeId(cityId));
        return normalizeId(city?.state_id) !== normalizedId;
      })
    }));
  };

  const handleRemoveCity = (id) => {
    const normalizedId = normalizeId(id);
    setPreferences(prev => ({
      ...prev,
      preferred_cities: (prev.preferred_cities || []).filter((cityId) => normalizeId(cityId) !== normalizedId)
    }));
  };

  const handleRemoveCategory = (id) => {
    const normalizedId = normalizeId(id);
    setPreferences(prev => ({
      ...prev,
      preferred_micro_categories: (prev.preferred_micro_categories || []).filter((categoryId) => normalizeId(categoryId) !== normalizedId)
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await vendorApi.preferences.update(preferences);
      setSavedSnapshot(preferencesSnapshot);
      toast({
        title: 'Preferences Updated',
        className: 'bg-green-50 text-green-900 border-green-200'
      });
    } catch (e) {
      console.error(e);
      toast({
        title: 'Update Failed',
        description: e?.message,
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  // Removed getCategoryName - now using inline rendering for all lists

  return (
    <div className="space-y-6">
      {/* States */}
      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Preferred States (Max {MAX_STATES})</h3>
            <p className="text-sm text-gray-500 mb-4">Select up to {MAX_STATES} states where you operate or want to receive leads from</p>
          </div>

          <div className="flex gap-2">
            <select
              value={selectedStateId}
              onChange={(e) => setSelectedStateId(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
              disabled={MAX_STATES === 0 || preferences.preferred_states.length >= MAX_STATES}
            >
              <option value="">Select a state</option>
              {allStates && allStates.length > 0 ? (
                allStates.map(state => (
                  <option key={state.id} value={state.id}>{state.name}</option>
                ))
              ) : (
                <option disabled>No states available</option>
              )}
            </select>
            <Button onClick={handleAddState} variant="outline" disabled={!selectedStateId || MAX_STATES === 0 || preferences.preferred_states.length >= MAX_STATES}>Add</Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {preferences.preferred_states.map(stateId => {
              const stateName = stateMap.get(normalizeId(stateId))?.name || 'Unknown state';
              return (
                <Badge key={stateId} variant="secondary" className="flex items-center gap-2 px-3 py-1">
                  {stateName}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => handleRemoveState(stateId)} />
                </Badge>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Cities */}
      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Preferred Cities (Max {MAX_CITIES})</h3>
            <p className="text-sm text-gray-500 mb-4">Select up to {MAX_CITIES} cities for more targeted leads</p>
          </div>

          <div className="flex gap-2">
            <select
              value={selectedCityId}
              onChange={(e) => setSelectedCityId(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
              disabled={MAX_CITIES === 0 || preferences.preferred_cities.length >= MAX_CITIES || allCities.length === 0}
            >
              <option value="">Select a city</option>
              {allCities && allCities.length > 0 ? (
                allCities.map(city => (
                  <option key={city.id} value={city.id}>{city.name}</option>
                ))
              ) : (
                <option disabled>No cities available - add preferred states first</option>
              )}
            </select>
            <Button onClick={handleAddCity} variant="outline" disabled={!selectedCityId || MAX_CITIES === 0 || preferences.preferred_cities.length >= MAX_CITIES}>Add</Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {preferences.preferred_cities.map(cityId => {
              const cityName = cityMap.get(normalizeId(cityId))?.name || 'Loading city...';
              return (
                <Badge key={cityId} variant="secondary" className="flex items-center gap-2 px-3 py-1">
                  {cityName}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => handleRemoveCity(cityId)} />
                </Badge>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Categories */}
      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Product Categories (Max {MAX_CATEGORIES})</h3>
            <p className="text-sm text-gray-500 mb-4">Select up to {MAX_CATEGORIES} main categories your business deals in</p>
          </div>

          <div className="flex gap-2">
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
              disabled={MAX_CATEGORIES === 0 || preferences.preferred_micro_categories.length >= MAX_CATEGORIES}
            >
              <option value="">Select a category</option>
              {allHeadCategories && allHeadCategories.length > 0 ? (
                allHeadCategories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))
              ) : (
                <option disabled>No categories available</option>
              )}
            </select>
            <Button onClick={handleAddCategory} variant="outline" disabled={!selectedCategoryId || MAX_CATEGORIES === 0 || preferences.preferred_micro_categories.length >= MAX_CATEGORIES}>Add</Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {preferences.preferred_micro_categories.map(catId => {
              const catName = categoryMap.get(normalizeId(catId))?.name || 'Unknown category';
              return (
                <Badge key={catId} variant="secondary" className="flex items-center gap-2 px-3 py-1">
                  {catName}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => handleRemoveCategory(catId)} />
                </Badge>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Budget Range */}
      <Card className="p-6">
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900">Budget Range (₹)</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Minimum Budget</Label>
              <Input
                type="number"
                value={preferences.min_budget}
                onChange={(e) => setPreferences(prev => ({ ...prev, min_budget: parseInt(e.target.value) || 0 }))}
                placeholder="0"
              />
            </div>
            <div>
              <Label>Maximum Budget</Label>
              <Input
                type="number"
                value={preferences.max_budget}
                onChange={(e) => setPreferences(prev => ({ ...prev, max_budget: parseInt(e.target.value) || 999999 }))}
                placeholder="999999"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Auto Filter */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Auto Lead Filter</h3>
            <p className="text-sm text-gray-500">Automatically filter leads based on your preferences</p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.auto_lead_filter}
              onChange={(e) => setPreferences(prev => ({ ...prev, auto_lead_filter: e.target.checked }))}
              className="w-5 h-5"
            />
          </label>
        </div>
      </Card>

      {/* Save Button */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-gray-500">
          {hasUnsavedChanges ? 'You have unsaved preference changes.' : 'Preferences are saved.'}
        </p>
        <Button
          onClick={handleSave}
          disabled={saving || !hasUnsavedChanges}
          className="bg-[#003D82] hover:bg-[#003D82]/90 flex items-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving...' : 'Save Preferences'}
        </Button>
      </div>
    </div>
  );
};

export default PreferencesSection;
