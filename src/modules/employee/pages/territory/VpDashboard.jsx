import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Loader2, RefreshCw } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { territoryApi } from '@/modules/employee/services/territoryApi';
import { locationService } from '@/shared/services/locationService';

const ALL_STATES_VALUE = 'all';
const ALL_CITIES_VALUE = 'all';
const normalizeId = (value) => String(value || '').trim();
const normalizeName = (value) => String(value || '').trim().toLowerCase();

const VpDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const [managers, setManagers] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [statesLoading, setStatesLoading] = useState(false);
  const [citiesLoading, setCitiesLoading] = useState(false);

  const [selectedManager, setSelectedManager] = useState('');
  const [selectedDivisionIds, setSelectedDivisionIds] = useState([]);
  const [selectedStateId, setSelectedStateId] = useState(ALL_STATES_VALUE);
  const [selectedCityId, setSelectedCityId] = useState(ALL_CITIES_VALUE);

  const stateLookup = useMemo(() => {
    const idByName = new Map();
    const nameById = new Map();
    const options = (states || [])
      .map((state) => {
        const id = normalizeId(state?.id);
        if (!id) return null;
        const name = String(state?.name || 'State N/A').trim() || 'State N/A';
        nameById.set(id, name);
        const normalizedName = normalizeName(name);
        if (normalizedName) idByName.set(normalizedName, id);
        return { id, name };
      })
      .filter(Boolean)
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));

    return { options, idByName, nameById };
  }, [states]);

  const cityLookup = useMemo(() => {
    const idByName = new Map();
    const nameById = new Map();
    const options = (cities || [])
      .map((city) => {
        const id = normalizeId(city?.id);
        if (!id) return null;
        const name = String(city?.name || 'City N/A').trim() || 'City N/A';
        nameById.set(id, name);
        const normalizedName = normalizeName(name);
        if (normalizedName) idByName.set(normalizedName, id);
        return { id, name };
      })
      .filter(Boolean)
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));

    return { options, idByName, nameById };
  }, [cities]);

  const filteredDivisions = useMemo(() => {
    const term = String(search || '').trim().toLowerCase();
    return (divisions || []).filter((d) => {
      const divisionStateId = normalizeId(
        d?.state_id || d?.state?.id || stateLookup.idByName.get(normalizeName(d?.state?.name))
      );
      const divisionCityId = normalizeId(
        d?.city_id || d?.city?.id || cityLookup.idByName.get(normalizeName(d?.city?.name))
      );

      if (selectedStateId !== ALL_STATES_VALUE && divisionStateId !== selectedStateId) return false;
      if (selectedCityId !== ALL_CITIES_VALUE && divisionCityId !== selectedCityId) return false;
      if (!term) return true;
      return [d?.name, d?.city?.name, d?.state?.name, d?.district_name, d?.subdistrict_name, d?.pincode_count]
        .filter(Boolean)
        .some((x) => String(x).toLowerCase().includes(term));
    });
  }, [cityLookup.idByName, divisions, search, selectedCityId, selectedStateId, stateLookup.idByName]);

  const stateOptions = useMemo(() => {
    const optionsById = new Map(stateLookup.options.map((state) => [state.id, state]));

    (divisions || []).forEach((division) => {
      const stateId = normalizeId(
        division?.state_id || division?.state?.id || stateLookup.idByName.get(normalizeName(division?.state?.name))
      );
      if (!stateId || optionsById.has(stateId)) return;

      const stateName =
        String(division?.state?.name || stateLookup.nameById.get(stateId) || 'State N/A').trim() || 'State N/A';
      optionsById.set(stateId, { id: stateId, name: stateName });
    });

    return Array.from(optionsById.values()).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [divisions, stateLookup.idByName, stateLookup.nameById, stateLookup.options]);

  const cityOptions = useMemo(() => {
    const optionsById = new Map(cityLookup.options.map((city) => [city.id, city]));

    (divisions || []).forEach((division) => {
      const divisionStateId = normalizeId(
        division?.state_id || division?.state?.id || stateLookup.idByName.get(normalizeName(division?.state?.name))
      );
      if (selectedStateId !== ALL_STATES_VALUE && divisionStateId !== selectedStateId) return;

      const cityId = normalizeId(
        division?.city_id || division?.city?.id || cityLookup.idByName.get(normalizeName(division?.city?.name))
      );
      if (!cityId || optionsById.has(cityId)) return;

      const cityName =
        String(division?.city?.name || cityLookup.nameById.get(cityId) || 'City N/A').trim() || 'City N/A';
      optionsById.set(cityId, { id: cityId, name: cityName });
    });

    return Array.from(optionsById.values()).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [
    cities,
    cityLookup.idByName,
    cityLookup.nameById,
    cityLookup.options,
    divisions,
    selectedStateId,
    stateLookup.idByName,
  ]);

  const managerById = useMemo(() => {
    const map = new Map();
    (managers || []).forEach((m) => map.set(m.user_id, m));
    return map;
  }, [managers]);

  const loadBase = async () => {
    try {
      setLoading(true);
      const [managerRows, divisionRows, allocationRows] = await Promise.all([
        territoryApi.getEmployees('MANAGER'),
        territoryApi.getDivisions({ include_pincodes: 'true' }),
        territoryApi.getVpManagerAllocations({ active: 'true' }),
      ]);
      setManagers(managerRows || []);
      setDivisions(divisionRows || []);
      setAllocations(allocationRows || []);
    } catch (error) {
      toast({
        title: 'Failed to load territory data',
        description: error?.message || 'Unable to load VP territory controls',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBase();
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadStates = async () => {
      try {
        setStatesLoading(true);
        const rows = await locationService.getStates();
        if (mounted) {
          setStates(rows || []);
        }
      } catch (error) {
        if (mounted) {
          toast({
            title: 'Failed to load states',
            description: error?.message || 'Unable to load available states',
            variant: 'destructive',
          });
        }
      } finally {
        if (mounted) {
          setStatesLoading(false);
        }
      }
    };

    loadStates();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedManager) {
      setSelectedDivisionIds([]);
      return;
    }

    const assigned = (allocations || [])
      .filter((a) => a.manager_user_id === selectedManager && a.allocation_status === 'ACTIVE')
      .map((a) => a.division_id)
      .filter(Boolean);
    setSelectedDivisionIds(assigned);
  }, [allocations, selectedManager]);

  useEffect(() => {
    setSelectedCityId(ALL_CITIES_VALUE);
  }, [selectedStateId]);

  useEffect(() => {
    let mounted = true;

    const loadCities = async () => {
      if (selectedStateId === ALL_STATES_VALUE) {
        setCitiesLoading(false);
        setCities([]);
        return;
      }

      try {
        setCitiesLoading(true);
        const rows = await locationService.getCities(selectedStateId);
        if (mounted) {
          setCities(rows || []);
        }
      } catch (error) {
        if (mounted) {
          setCities([]);
          toast({
            title: 'Failed to load cities',
            description: error?.message || 'Unable to load cities for the selected state',
            variant: 'destructive',
          });
        }
      } finally {
        if (mounted) {
          setCitiesLoading(false);
        }
      }
    };

    loadCities();
    return () => {
      mounted = false;
    };
  }, [selectedStateId]);

  const toggleDivision = (divisionId, checked) => {
    setSelectedDivisionIds((prev) => {
      const set = new Set(prev || []);
      if (checked) set.add(divisionId);
      else set.delete(divisionId);
      return [...set];
    });
  };

  const saveAllocations = async () => {
    if (!selectedManager) {
      toast({ title: 'Select manager first', variant: 'destructive' });
      return;
    }

    try {
      setSaving(true);
      await territoryApi.saveVpManagerAllocations({
        manager_user_id: selectedManager,
        division_ids: selectedDivisionIds,
        mode: 'REPLACE',
      });
      toast({ title: 'Manager allocation saved' });
      const rows = await territoryApi.getVpManagerAllocations({ active: 'true' });
      setAllocations(rows || []);
    } catch (error) {
      toast({
        title: 'Failed to save allocations',
        description: error?.message || 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const managerStats = useMemo(() => {
    const grouped = new Map();
    (allocations || []).forEach((a) => {
      if (a.allocation_status !== 'ACTIVE') return;
      const key = a.manager_user_id;
      grouped.set(key, (grouped.get(key) || 0) + 1);
    });
    return grouped;
  }, [allocations]);

  const isStateScoped = selectedStateId !== ALL_STATES_VALUE;
  const citySelectDisabled = !isStateScoped || (citiesLoading && cityOptions.length === 0);

  if (loading) {
    return (
      <div className="h-64 grid place-items-center text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">VP Territory Dashboard</h1>
          <p className="text-sm text-slate-600">Allocate city divisions to managers without changing existing sales flow.</p>
        </div>
        <Button variant="outline" onClick={loadBase}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Managers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{managers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Divisions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{divisions.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active Allocations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(allocations || []).filter((a) => a.allocation_status === 'ACTIVE').length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Manager Allocation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select value={selectedManager} onValueChange={setSelectedManager}>
              <SelectTrigger className="h-10 pr-10">
                <SelectValue placeholder="Select manager" />
              </SelectTrigger>
              <SelectContent>
                {(managers || []).map((manager) => (
                  <SelectItem key={manager.user_id} value={manager.user_id}>
                    {manager.full_name || manager.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedStateId} onValueChange={setSelectedStateId} disabled={statesLoading}>
              <SelectTrigger className="h-10 pr-10">
                <SelectValue placeholder="Filter by state" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value={ALL_STATES_VALUE}>All states</SelectItem>
                {stateOptions.map((state) => (
                  <SelectItem key={state.id} value={state.id}>
                    {state.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select value={selectedCityId} onValueChange={setSelectedCityId} disabled={citySelectDisabled}>
              <SelectTrigger className="h-10 pr-10">
                <SelectValue placeholder={isStateScoped ? 'Filter by city' : 'Select a state first'} />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value={ALL_CITIES_VALUE}>All cities</SelectItem>
                {cityOptions.map((city) => (
                  <SelectItem key={city.id} value={city.id}>
                    {city.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="space-y-2">
              <Label htmlFor="vp-division-search">Search divisions</Label>
              <Input
                id="vp-division-search"
                type="search"
                name="vp-division-search"
                autoComplete="off"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search division, city, state or pincode"
              />
            </div>
          </div>

          {!selectedManager ? (
            <div className="text-sm text-slate-500">Choose a manager to allocate divisions.</div>
          ) : (
            <div className="max-h-72 overflow-y-auto border rounded-lg p-3 space-y-2">
              {filteredDivisions.length ? (
                filteredDivisions.map((division) => {
                  const checked = selectedDivisionIds.includes(division.id);
                  const pincodeRows = Array.isArray(division.division_pincodes) ? division.division_pincodes : [];
                  const pincodePreview = pincodeRows
                    .map((x) => String(x?.pincode || '').trim())
                    .filter(Boolean)
                    .slice(0, 3);
                  const remainingPincodes = Math.max(0, pincodeRows.length - pincodePreview.length);
                  return (
                    <label key={division.id} className="flex items-start gap-3 p-2 rounded hover:bg-slate-50">
                      <Checkbox checked={checked} onCheckedChange={(v) => toggleDivision(division.id, Boolean(v))} />
                      <div className="min-w-0">
                        <div className="font-medium text-sm">{division.name}</div>
                        <div className="text-xs text-slate-500">
                          {division.city?.name || 'City N/A'} • {division.state?.name || 'State N/A'}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                          <Badge variant="outline">{division.pincode_count || 0} pincodes</Badge>
                          {(division.district_name || division.subdistrict_name) ? (
                            <span>
                              {[division.district_name, division.subdistrict_name].filter(Boolean).join(' / ')}
                            </span>
                          ) : null}
                        </div>
                        {pincodePreview.length ? (
                          <div className="mt-1 text-[11px] text-slate-500">
                            Pincodes: {pincodePreview.join(', ')}{remainingPincodes ? ` +${remainingPincodes}` : ''}
                          </div>
                        ) : null}
                      </div>
                    </label>
                  );
                })
              ) : (
                <div className="rounded border border-dashed px-3 py-6 text-center text-sm text-slate-500">
                  No divisions match the current filters.
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={saveAllocations} disabled={saving || !selectedManager}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save Allocation
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Manager Coverage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(managers || []).map((manager) => (
            <div key={manager.user_id} className="flex items-center justify-between rounded border p-2">
              <div className="text-sm">{manager.full_name || manager.email}</div>
              <Badge variant="outline">{managerStats.get(manager.user_id) || 0} divisions</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default VpDashboard;
