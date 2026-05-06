import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { buyerApi } from '@/modules/buyer/services/buyerApi';
import { toast } from '@/components/ui/use-toast';
import CategoryTypeahead from '@/shared/components/CategoryTypeahead';
import { StateDropdown, CityDropdown } from '@/shared/components/LocationSelectors';
import {
  ArrowLeft,
  Building2,
  Loader2,
  Mail,
  MapPin,
  Search,
  Send,
  X,
} from 'lucide-react';

const MIN_REQUIREMENT_LENGTH = 10;

const isLockedFlag = (value) => ['1', 'true', 'yes'].includes(String(value || '').toLowerCase().trim());
const normalizeText = (value) => String(value || '').trim();
const normalizePincode = (value) => String(value || '').replace(/\D/g, '').slice(0, 6);

const formatVendorSearchLabel = (vendor = {}) => {
  const primary =
    normalizeText(vendor?.company_name) ||
    normalizeText(vendor?.owner_name) ||
    normalizeText(vendor?.email) ||
    normalizeText(vendor?.vendor_id) ||
    'Vendor';
  const secondary = [normalizeText(vendor?.email), normalizeText(vendor?.vendor_id)].filter(Boolean).join(' | ');
  return secondary ? `${primary} (${secondary})` : primary;
};

const CreateProposal = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const vendorId = normalizeText(searchParams.get('vendorId') || searchParams.get('vendor_id')) || null;
  const vendorName = normalizeText(searchParams.get('vendorName') || searchParams.get('vendor_name'));
  const productName = normalizeText(searchParams.get('productName') || searchParams.get('product_name'));
  const prefilledCategory = normalizeText(
    searchParams.get('category') || searchParams.get('product_category') || productName
  );
  const lockVendor = isLockedFlag(searchParams.get('lockVendor'));

  const [loading, setLoading] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [vendorQuery, setVendorQuery] = useState(vendorName);
  const [vendorOptions, setVendorOptions] = useState([]);
  const [vendorLookupLoading, setVendorLookupLoading] = useState(false);
  const [showVendorOptions, setShowVendorOptions] = useState(false);
  const vendorSearchRef = useRef(null);

  const [formData, setFormData] = useState({
    category_text: '',
    category_path: '',
    category_slug: '',
    micro_category_id: '',
    sub_category_id: '',
    head_category_id: '',
    quantity: '',
    budget: '',
    state_id: '',
    state: '',
    city_id: '',
    city: '',
    pincode: '',
    description: '',
  });

  const selectedVendorLabel = useMemo(
    () => (selectedVendor ? formatVendorSearchLabel(selectedVendor) : ''),
    [selectedVendor]
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (vendorSearchRef.current && !vendorSearchRef.current.contains(event.target)) {
        setShowVendorOptions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    let active = true;

    const loadLockedVendor = async () => {
      if (!vendorId) return;
      try {
        const vendor = await buyerApi.getProposalTargetVendor(vendorId);
        if (!active) return;
        if (vendor) {
          setSelectedVendor(vendor);
          setVendorQuery(formatVendorSearchLabel(vendor));
          return;
        }
        setVendorQuery(vendorName || vendorId);
      } catch (error) {
        if (!active) return;
        console.warn('Failed to load target vendor:', error);
        setVendorQuery(vendorName || vendorId);
      }
    };

    loadLockedVendor();

    return () => {
      active = false;
    };
  }, [vendorId, vendorName]);

  useEffect(() => {
    if (lockVendor) {
      setVendorOptions([]);
      setShowVendorOptions(false);
      return undefined;
    }

    const term = normalizeText(vendorQuery);
    if (!term || term.length < 2 || (selectedVendorLabel && term === selectedVendorLabel)) {
      setVendorOptions([]);
      setShowVendorOptions(false);
      return undefined;
    }

    const timer = setTimeout(async () => {
      setVendorLookupLoading(true);
      try {
        const results = await buyerApi.searchProposalVendors(term);
        setVendorOptions(results);
        setShowVendorOptions(results.length > 0);
      } catch (error) {
        console.error('Vendor search failed:', error);
        setVendorOptions([]);
        setShowVendorOptions(false);
      } finally {
        setVendorLookupLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [lockVendor, selectedVendorLabel, vendorQuery]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleCategorySelect = (item) => {
    if (!item) {
      setFormData((prev) => ({
        ...prev,
        category_text: '',
        category_path: '',
        category_slug: '',
        micro_category_id: '',
        sub_category_id: '',
        head_category_id: '',
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      category_text: normalizeText(item?.name),
      category_path: normalizeText(item?.path),
      category_slug: normalizeText(item?.slug),
      micro_category_id: normalizeText(item?.type) === 'micro' ? normalizeText(item?.id) : '',
      sub_category_id: normalizeText(item?.sub_id),
      head_category_id: normalizeText(item?.head_id),
    }));
  };

  const handleVendorInputChange = (value) => {
    setVendorQuery(value);
    if (selectedVendor && normalizeText(value) !== selectedVendorLabel) {
      setSelectedVendor(null);
    }
  };

  const selectVendor = (vendor) => {
    setSelectedVendor(vendor);
    setVendorQuery(formatVendorSearchLabel(vendor));
    setVendorOptions([]);
    setShowVendorOptions(false);
  };

  const clearVendorSelection = () => {
    setSelectedVendor(null);
    setVendorQuery('');
    setVendorOptions([]);
    setShowVendorOptions(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;

    const categoryName = normalizeText(formData.category_text);
    const categoryPath = normalizeText(formData.category_path);
    const quantity = normalizeText(formData.quantity);
    const budget = normalizeText(formData.budget);
    const description = normalizeText(formData.description);
    const stateName = normalizeText(formData.state);
    const cityName = normalizeText(formData.city);
    const pincode = normalizePincode(formData.pincode);
    const quantityValue = Number(quantity);
    const budgetValue = Number(budget);

    if (!formData.micro_category_id || !categoryName) {
      toast({
        title: 'Validation Error',
        description: 'Please select an exact micro category from the dropdown.',
        variant: 'destructive',
      });
      return;
    }

    if (!quantity || !budget || !stateName || !cityName || !pincode || !description) {
      toast({
        title: 'Validation Error',
        description: 'Please fill all required fields.',
        variant: 'destructive',
      });
      return;
    }

    if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
      toast({ title: 'Validation Error', description: 'Quantity must be greater than 0.', variant: 'destructive' });
      return;
    }

    if (!Number.isFinite(budgetValue) || budgetValue <= 0) {
      toast({ title: 'Validation Error', description: 'Budget must be greater than 0.', variant: 'destructive' });
      return;
    }

    if (pincode.length !== 6) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a valid 6-digit pincode.',
        variant: 'destructive',
      });
      return;
    }

    if (description.length < MIN_REQUIREMENT_LENGTH) {
      toast({
        title: 'Validation Error',
        description: `Requirement details must be at least ${MIN_REQUIREMENT_LENGTH} characters.`,
        variant: 'destructive',
      });
      return;
    }

    if (!lockVendor && normalizeText(vendorQuery) && !selectedVendor) {
      toast({
        title: 'Vendor Selection Required',
        description: 'Please select a vendor from the suggestions or clear the vendor field for marketplace posting.',
        variant: 'destructive',
      });
      return;
    }

    const effectiveVendor = selectedVendor || null;
    const location = [cityName, stateName].filter(Boolean).join(', ');

    setLoading(true);

    try {
      await buyerApi.createProposal({
        vendor_id: effectiveVendor?.id || vendorId || null,
        vendor_email: normalizeText(effectiveVendor?.email),
        title: productName || categoryName,
        product_name: productName || categoryName,
        category: categoryPath || categoryName,
        category_name: categoryName,
        category_slug: normalizeText(formData.category_slug),
        micro_category_id: normalizeText(formData.micro_category_id),
        sub_category_id: normalizeText(formData.sub_category_id),
        head_category_id: normalizeText(formData.head_category_id),
        quantity: quantityValue,
        budget: budgetValue,
        location,
        state: stateName,
        state_id: normalizeText(formData.state_id),
        city: cityName,
        city_id: normalizeText(formData.city_id),
        pincode,
        description,
      });

      toast({
        title: 'Success',
        description: effectiveVendor?.email
          ? `Requirement has been sent to ${effectiveVendor.email}.`
          : 'Your requirement has been posted successfully.',
        className: 'bg-green-50 border-green-200 text-green-900',
      });

      setTimeout(() => navigate('/buyer/proposals'), 300);
    } catch (error) {
      console.error('Submission failed:', error);
      proposalCaptcha.resetCaptcha();
      toast({
        title: 'Error',
        description: error.message || 'Failed to create proposal. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-3">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-neutral-800">New Proposal</h1>
          <p className="text-gray-500">Post a targeted requirement with micro category, delivery city, and vendor selection.</p>
          {(vendorId || selectedVendor) && (
            <p className="mt-1 text-sm text-[#003D82]">
              {lockVendor ? 'Vendor locked:' : 'Selected vendor:'}{' '}
              {selectedVendor?.company_name || vendorName || selectedVendor?.email || 'Target vendor'}
            </p>
          )}
        </div>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="p-4 pb-2 sm:p-5 sm:pb-3">
          <CardTitle>Requirement Details</CardTitle>
          <CardDescription>Micro category, delivery city, pincode, and optional direct vendor targeting are required for accurate routing.</CardDescription>
          {productName && (
            <p className="text-sm text-gray-600">
              Product interest: <span className="font-medium">{productName}</span>
            </p>
          )}
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="category">Select Micro Category *</Label>
              <CategoryTypeahead
                onSelect={handleCategorySelect}
                defaultValue={prefilledCategory}
                placeholder="Search exact micro category..."
                allowedTypes={['micro']}
              />
              {formData.category_path ? (
                <p className="text-xs text-[#003D82]">{formData.category_path}</p>
              ) : prefilledCategory ? (
                <p className="text-xs text-amber-700">
                  Previous text prefilling hua hai. Submit se pehle exact micro category select karna mandatory hai.
                </p>
              ) : null}
            </div>

            <div className="relative space-y-1.5" ref={vendorSearchRef}>
              <Label htmlFor="vendor-search">Choose Vendor By Email / Company / Vendor ID</Label>
              <div className="relative">
                <Input
                  id="vendor-search"
                  value={vendorQuery}
                  onChange={(event) => handleVendorInputChange(event.target.value)}
                  placeholder="Search vendor email, company name, or vendor ID"
                  className="pr-20"
                  disabled={lockVendor}
                  autoComplete="off"
                  disableAutoSanitize
                />
                <div className="pointer-events-none absolute right-10 top-3 text-slate-400">
                  {vendorLookupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </div>
                {!lockVendor && (selectedVendor || vendorQuery) ? (
                  <button
                    type="button"
                    onClick={clearVendorSelection}
                    className="absolute right-2 top-2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Clear vendor selection"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>

              {selectedVendor ? (
                <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-slate-700">
                  <div className="flex items-center gap-2 font-medium text-[#003D82]">
                    <Building2 className="h-4 w-4" />
                    {selectedVendor.company_name || selectedVendor.owner_name || selectedVendor.vendor_id || 'Selected Vendor'}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                    {selectedVendor.email ? (
                      <span className="inline-flex items-center gap-1">
                        <Mail className="h-3.5 w-3.5" />
                        {selectedVendor.email}
                      </span>
                    ) : null}
                    {selectedVendor.city || selectedVendor.state ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {[selectedVendor.city, selectedVendor.state].filter(Boolean).join(', ')}
                      </span>
                    ) : null}
                    {selectedVendor.vendor_id ? <span>{selectedVendor.vendor_id}</span> : null}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  Is field ko blank chhodoge to requirement marketplace me jayegi. Vendor choose karoge to direct us vendor ko proposal jayega.
                </p>
              )}

              {showVendorOptions && vendorOptions.length > 0 && !lockVendor ? (
                <div className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-white shadow-lg">
                  {vendorOptions.map((vendor) => (
                    <button
                      key={vendor.id}
                      type="button"
                      className="block w-full border-b px-4 py-3 text-left text-sm last:border-b-0 hover:bg-slate-50"
                      onClick={() => selectVendor(vendor)}
                    >
                      <div className="font-medium text-slate-800">
                        {vendor.company_name || vendor.owner_name || vendor.vendor_id || vendor.email}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {[vendor.email, vendor.vendor_id, vendor.city, vendor.state].filter(Boolean).join(' | ')}
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="quantity">Quantity *</Label>
                <div className="flex gap-1.5">
                  <Input
                    id="quantity"
                    type="number"
                    placeholder="e.g. 100"
                    value={formData.quantity}
                    onChange={(event) => handleChange('quantity', event.target.value)}
                  />
                  <div className="flex min-w-[58px] items-center justify-center rounded-md border bg-gray-50 px-3 text-sm text-gray-500">
                    Units
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="budget">Budget (₹) *</Label>
                <Input
                  id="budget"
                  type="number"
                  placeholder="e.g. 50000"
                  value={formData.budget}
                  onChange={(event) => handleChange('budget', event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Delivery Location *</Label>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="state" className="text-xs text-slate-500">
                    State
                  </Label>
                  <StateDropdown
                    value={formData.state_id}
                    onChange={(value, item) =>
                      setFormData((prev) => ({
                        ...prev,
                        state_id: normalizeText(value),
                        state: normalizeText(item?.name),
                        city_id: '',
                        city: '',
                      }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="city" className="text-xs text-slate-500">
                    City
                  </Label>
                  <CityDropdown
                    stateId={formData.state_id}
                    value={formData.city_id}
                    onChange={(value, item) =>
                      setFormData((prev) => ({
                        ...prev,
                        city_id: normalizeText(value),
                        city: normalizeText(item?.name),
                      }))
                    }
                    disabled={!formData.state_id}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pincode" className="text-xs text-slate-500">
                    Pincode
                  </Label>
                  <Input
                    id="pincode"
                    inputMode="numeric"
                    placeholder="6-digit pincode"
                    value={formData.pincode}
                    onChange={(event) => handleChange('pincode', normalizePincode(event.target.value))}
                    maxLength={6}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Detailed Requirement *</Label>
              <Textarea
                id="description"
                placeholder="Describe your requirement in detail (specifications, quality, brands, etc.)"
                className="min-h-[120px]"
                value={formData.description}
                onChange={(event) => handleChange('description', event.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                Cancel
              </Button>
              <Button type="submit" className="min-w-[150px] bg-[#003D82]" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" /> Post Requirement
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateProposal;
