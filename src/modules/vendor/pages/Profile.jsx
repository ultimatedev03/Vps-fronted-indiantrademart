import React, { useEffect, useState, useCallback } from 'react';
import { vendorApi } from '@/modules/vendor/services/vendorApi';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import PreferencesSection from '@/modules/vendor/components/PreferencesSection';
import SubscriptionBadge from '@/modules/vendor/components/SubscriptionBadge';
import {
  Loader2, Save, Camera, Pencil, MapPin, Phone, Mail,
  Plus, Trash2, Check, ExternalLink, FileText, CheckCircle, X
} from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';

const normalizeVendorProfile = (profile = {}) => ({
  ...profile,
  companyName: profile.companyName || profile.company_name,
  ownerName: profile.ownerName || profile.owner_name,
  gstNumber: profile.gstNumber || profile.gst_number,
  panNumber: profile.panNumber || profile.pan_number,
  aadharNumber: profile.aadharNumber || profile.aadhar_number,
  secondaryEmail: profile.secondaryEmail || profile.secondary_email,
  secondaryPhone: profile.secondaryPhone || profile.secondary_phone,
  landlineNumber: profile.landlineNumber || profile.landline_number,
  websiteUrl: profile.websiteUrl || profile.website_url,
  primaryBusinessType: profile.primaryBusinessType || profile.primary_business_type,
  annualTurnover: profile.annualTurnover || profile.annual_turnover,
  businessDescription: profile.businessDescription || profile.business_description || profile.description,
  cinNumber: profile.cinNumber || profile.cin_number || profile.llpinNumber || profile.llpin_number,
  llpinNumber: profile.llpinNumber || profile.llpin_number,
  iecCode: profile.iecCode || profile.iec_code,
  yearOfEstablishment: profile.yearOfEstablishment ?? profile.year_of_establishment,
  ownerDesignation: profile.ownerDesignation || profile.owner_designation,
});

const INDIA_COUNTRY_CODE = '+91';
const INDIAN_PHONE_RE = /^[6-9]\d{9}$/;
const LANDLINE_NUMBER_RE = /^\d{6,15}$/;
const GST_NUMBER_RE = /^\d{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/;
const PAN_NUMBER_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const AADHAR_NUMBER_RE = /^\d{12}$/;
const IFSC_CODE_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const TAN_NUMBER_RE = /^[A-Z]{4}[0-9]{5}[A-Z]$/;
const IEC_CODE_RE = /^[A-Z0-9]{10}$/;
const CIN_NUMBER_RE = /^[A-Z0-9]{21}$/;
const LLPIN_NUMBER_RE = /^[A-Z0-9]{8}$/;
const ACCOUNT_HOLDER_NAME_RE = /^[A-Za-z][A-Za-z\s.'-]*$/;

const normalizePanNumber = (value = '') =>
  String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);

const normalizeAadharNumber = (value = '') =>
  String(value || '').replace(/\D/g, '').slice(0, 12);

const normalizeIfscCode = (value = '') =>
  String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11);

const normalizeShortText = (value = '', maxLength = 120) =>
  String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);

const normalizeIndianPhoneInput = (value = '') => {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length > 10) {
    digits = digits.slice(2);
  }
  if (digits.length > 10) {
    digits = digits.slice(-10);
  }
  return digits;
};

const normalizeLandlineNumber = (value = '') =>
  String(value || '').replace(/\D/g, '').slice(0, 15);

const normalizeCodeValue = (value = '', maxLength = 32) =>
  String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, maxLength);

const normalizeAccountHolderName = (value = '') =>
  String(value || '')
    .replace(/[^A-Za-z\s.'-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);

const normalizeWebsiteUrl = (value = '') => {
  const text = String(value || '').trim();
  if (!text) return '';

  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`;
  let parsed;

  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new Error('Website URL must be a valid http/https URL.');
  }

  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) {
    throw new Error('Website URL must be a valid http/https URL.');
  }

  return parsed.toString();
};

const normalizeYearOfEstablishment = (value) => {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  const digits = String(value).replace(/\D/g, '').slice(0, 4);
  const year = Number(digits);
  const currentYear = new Date().getFullYear();

  if (!digits || !Number.isInteger(year) || year < 1900 || year > currentYear) {
    throw new Error(`Year of establishment must be between 1900 and ${currentYear}.`);
  }

  return year;
};

const resolveRegistrationNumbers = (value = '') => {
  const normalizedValue = normalizeCodeValue(value, 21);

  if (!normalizedValue) {
    return {
      displayValue: null,
      cinNumber: null,
    };
  }

  if (CIN_NUMBER_RE.test(normalizedValue)) {
    return {
      displayValue: normalizedValue,
      cinNumber: normalizedValue,
    };
  }

  if (LLPIN_NUMBER_RE.test(normalizedValue)) {
    return {
      displayValue: normalizedValue,
      // Persist LLPIN in cin_number because the live schema has no llpin_number column.
      cinNumber: normalizedValue,
    };
  }

  throw new Error('CIN/LLPIN number must be a valid 21-character CIN or 8-character LLPIN.');
};

const validateVendorIdentityDraft = (draft = {}) => {
  const rawPanNumber = String(draft.panNumber || draft.pan_number || '').trim();
  const rawAadharNumber = String(draft.aadharNumber || draft.aadhar_number || '').trim();
  const panNumber = normalizePanNumber(rawPanNumber);
  const aadharNumber = normalizeAadharNumber(rawAadharNumber);

  if (rawPanNumber && !PAN_NUMBER_RE.test(panNumber)) {
    throw new Error('PAN number must be in the format ABCDE1234F.');
  }

  if (rawAadharNumber && !AADHAR_NUMBER_RE.test(aadharNumber)) {
    throw new Error('Aadhar number must contain exactly 12 digits.');
  }

  return {
    panNumber,
    aadharNumber,
  };
};

const validateVendorPrimaryDraft = (draft = {}) => {
  const rawPhone = String(draft.phone || '').trim();
  const phone = normalizeIndianPhoneInput(rawPhone);

  if (rawPhone && !INDIAN_PHONE_RE.test(phone)) {
    throw new Error('Mobile number must be a valid 10-digit Indian number.');
  }

  const rawSecondaryPhone = String(draft.secondaryPhone || draft.secondary_phone || '').trim();
  const secondaryPhone = normalizeIndianPhoneInput(rawSecondaryPhone);

  if (rawSecondaryPhone && !INDIAN_PHONE_RE.test(secondaryPhone)) {
    throw new Error('Second phone number must be a valid 10-digit Indian number.');
  }

  const rawLandline = String(draft.landlineNumber || draft.landline_number || '').trim();
  const landlineNumber = normalizeLandlineNumber(rawLandline);

  if (rawLandline && !LANDLINE_NUMBER_RE.test(landlineNumber)) {
    throw new Error('Landline number must contain 6 to 15 digits.');
  }

  return {
    phone: phone || null,
    secondaryPhone: secondaryPhone || null,
    secondary_phone: secondaryPhone || null,
    landlineNumber: landlineNumber || null,
    landline_number: landlineNumber || null,
  };
};

const validateVendorBusinessDraft = (draft = {}, previous = {}) => {
  const rawGstNumber = String(draft.gstNumber || draft.gst_number || '').trim();
  const gstNumber = normalizeCodeValue(rawGstNumber, 15);
  if (rawGstNumber && !GST_NUMBER_RE.test(gstNumber)) {
    throw new Error('GST number must be a valid 15-character GSTIN.');
  }

  const websiteUrl = normalizeWebsiteUrl(draft.websiteUrl || draft.website_url || '');

  const rawPanNumber = String(draft.panNumber || draft.pan_number || '').trim();
  const panNumber = normalizePanNumber(rawPanNumber);
  const previousPanNumber = normalizePanNumber(previous.panNumber || previous.pan_number || '');
  if (rawPanNumber && panNumber !== previousPanNumber && !PAN_NUMBER_RE.test(panNumber)) {
    throw new Error('PAN number must be in the format ABCDE1234F.');
  }

  const rawAadharNumber = String(draft.aadharNumber || draft.aadhar_number || '').trim();
  const aadharNumber = normalizeAadharNumber(rawAadharNumber);
  const previousAadharNumber = normalizeAadharNumber(previous.aadharNumber || previous.aadhar_number || '');
  if (rawAadharNumber && aadharNumber !== previousAadharNumber && !AADHAR_NUMBER_RE.test(aadharNumber)) {
    throw new Error('Aadhar number must contain exactly 12 digits.');
  }

  const rawTanNumber = String(draft.tanNumber || draft.tan_number || '').trim();
  const tanNumber = normalizeCodeValue(rawTanNumber, 10);
  if (rawTanNumber && !TAN_NUMBER_RE.test(tanNumber)) {
    throw new Error('TAN number must be in the format ABCD12345F.');
  }

  const rawIecCode = String(draft.iecCode || draft.iec_code || '').trim();
  const iecCode = normalizeCodeValue(rawIecCode, 10);
  if (rawIecCode && !IEC_CODE_RE.test(iecCode)) {
    throw new Error('IEC code must contain exactly 10 alphanumeric characters.');
  }

  const registrationNumbers = resolveRegistrationNumbers(
    draft.cinNumber || draft.cin_number || draft.llpinNumber || draft.llpin_number || ''
  );

  const yearOfEstablishment = normalizeYearOfEstablishment(
    draft.yearOfEstablishment ?? draft.year_of_establishment ?? ''
  );

  return {
    gstNumber: gstNumber || null,
    gst_number: gstNumber || null,
    panNumber: panNumber || null,
    pan_number: panNumber || null,
    aadharNumber: aadharNumber || null,
    aadhar_number: aadharNumber || null,
    websiteUrl: websiteUrl || null,
    website_url: websiteUrl || null,
    cinNumber: registrationNumbers.displayValue,
    cin_number: registrationNumbers.displayValue,
    tanNumber: tanNumber || null,
    tan_number: tanNumber || null,
    iecCode: iecCode || null,
    iec_code: iecCode || null,
    yearOfEstablishment,
    year_of_establishment: yearOfEstablishment,
  };
};

const normalizeBankDraft = (bank = {}, index = 0) => {
  const accountNumber = String(bank.account_number || '').replace(/\D/g, '').slice(0, 30);
  const ifscCode = normalizeIfscCode(bank.ifsc_code || '');
  const rawAccountHolder = String(bank.account_holder || '').trim();
  const accountHolder = normalizeAccountHolderName(rawAccountHolder);
  const hasAnyValue = [
    accountNumber,
    ifscCode,
    bank.bank_name,
    bank.branch_name,
    rawAccountHolder,
  ].some((value) => String(value || '').trim());

  if (!hasAnyValue) {
    return null;
  }

  if (!accountNumber) {
    throw new Error(`Bank Account ${index + 1}: account number is required.`);
  }

  if (accountNumber.length < 6) {
    throw new Error(`Bank Account ${index + 1}: account number must contain at least 6 digits.`);
  }

  if (!ifscCode) {
    throw new Error(`Bank Account ${index + 1}: IFSC code is required.`);
  }

  if (!IFSC_CODE_RE.test(ifscCode)) {
    throw new Error(`Bank Account ${index + 1}: IFSC code must be in format ABCD0123456.`);
  }

  if (rawAccountHolder && (!accountHolder || !ACCOUNT_HOLDER_NAME_RE.test(accountHolder))) {
    throw new Error(`Bank Account ${index + 1}: account holder name must contain only letters and spaces.`);
  }

  return {
    account_number: accountNumber,
    ifsc_code: ifscCode,
    bank_name: normalizeShortText(bank.bank_name || ''),
    branch_name: normalizeShortText(bank.branch_name || ''),
    account_holder: accountHolder || null,
    is_primary: bank.is_primary === true,
  };
};

const createTempBankId = () => `temp-${Math.random().toString(36).slice(2, 11)}`;

const createEmptyBankDraft = () => ({
  id: createTempBankId(),
  account_number: '',
  ifsc_code: '',
  bank_name: '',
  branch_name: '',
  account_holder: '',
  is_primary: false,
});

const createBankDrafts = (banks = []) =>
  Array.isArray(banks) && banks.length > 0
    ? banks.map((bank) => ({ ...bank }))
    : [createEmptyBankDraft()];

const Profile = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const initialTab = searchParams.get("tab") || "primary";
  const [activeTab, setActiveTab] = useState(initialTab);

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState({});
  const [draft, setDraft] = useState({});
  const [editingSection, setEditingSection] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState({}); // { profile_image: boolean, banner_image: boolean }

  const [banks, setBanks] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  const [kycStatus, setKycStatus] = useState('PENDING');
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);

  // ✅ keep tab in sync with URL ?tab=
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam && tabParam !== activeTab) setActiveTab(tabParam);
  }, [searchParams, activeTab]);

  const loadData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
    }
    try {
      const [prof, bankList, docList, sub] = await Promise.all([
        vendorApi.auth.me(),
        vendorApi.banking.list(),
        vendorApi.documents.list(),
        vendorApi.subscriptions.getCurrent()
      ]);

      const normalizedProfile = normalizeVendorProfile(prof || {});

      setProfile(normalizedProfile);
      if (!silent) {
        setDraft(normalizedProfile);
      }
      setKycStatus(normalizedProfile.kyc_status || 'PENDING');
      setBanks(bankList || []);
      setDocuments(docList || []);
      setSubscription(sub || null);
    } catch (e) {
      console.error(e);
      toast({
        title: "Error loading profile",
        description: e?.message || "Something went wrong",
        variant: "destructive"
      });
    } finally {
      if (!silent) {
        setLoading(false);
      }
      setSubscriptionLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    let isActive = true;
    let channel = null;

    const setupSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!isActive || !user?.id) return;

      channel = supabase
        .channel('profile_kyc_updates')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'vendors',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            const nextStatus = payload.new?.kyc_status;
            if (!nextStatus) return;
            setKycStatus(nextStatus);
            setProfile((prev) => ({ ...prev, kyc_status: nextStatus }));
            setDraft((prev) => ({ ...prev, kyc_status: nextStatus }));
          }
        )
        .subscribe();
    };

    setupSubscription().catch(() => {});

    return () => {
      isActive = false;
      if (channel) {
        supabase.removeChannel(channel).catch(() => {});
      }
    };
  }, []);

  const refreshProfileData = useCallback(async () => {
    await loadData({ silent: true });
  }, [loadData]);

  // ✅ FIXED: auth-only fields removed, confirmed_at removed
  const handleSave = async () => {
    let normalizedSectionDraft = {};
    try {
      if (editingSection === 'primary') {
        normalizedSectionDraft = validateVendorPrimaryDraft(draft);
      } else if (editingSection === 'additional') {
        normalizedSectionDraft = validateVendorBusinessDraft(draft, profile);
      }
    } catch (validationError) {
      toast({
        title: "Invalid Details",
        description: validationError.message,
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      const normalizedDraft = {
        ...draft,
        ...normalizedSectionDraft,
      };

      // ✅ remove auth-only fields if present (VERY IMPORTANT)
      // eslint-disable-next-line no-unused-vars
      const {
        app_metadata,
        user_metadata,
        aud,
        id,
        created_at,
        cin_number,
        llpinNumber,
        llpin_number,

        confirmed_at,
        email_confirmed_at,
        last_sign_in_at,
        phone_confirmed_at,
        identities,
        factors,
        role,

        description,
        businessDescription,
        business_description,

        ...cleanDraft
      } = normalizedDraft;

      const updates = { ...cleanDraft };

      // map description -> business_description only
      const descValue = businessDescription || business_description || description;
      if (descValue !== undefined) {
        updates.business_description = descValue;
      }

      await vendorApi.auth.updateProfile(updates);

      setProfile(prev => ({ ...prev, ...cleanDraft, business_description: descValue, businessDescription: descValue }));
      setDraft(prev => ({ ...prev, ...cleanDraft, business_description: descValue, businessDescription: descValue }));
      setEditingSection(null);

      window.dispatchEvent(new Event('vendor_profile_updated'));

      toast({
        title: "Profile Updated Successfully",
        className: "bg-green-50 text-green-900 border-green-200"
      });
    } catch (e) {
      console.error(e);
      toast({
        title: "Update Failed",
        description: e?.message || "Please try again",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e, field) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(prev => ({ ...prev, [field]: true }));
    try {
      // ✅ If your vendorApi expects bucket name change here
      const url = await vendorApi.auth.uploadImage(file, 'avatars');

      const updates = { [field]: url };
      await vendorApi.auth.updateProfile(updates);

      setProfile(prev => ({ ...prev, ...updates }));
      setDraft(prev => ({ ...prev, ...updates }));

      window.dispatchEvent(new Event('vendor_profile_updated'));
      toast({ title: "Image Uploaded" });
    } catch (e2) {
      console.error('Image upload error:', e2);
      toast({
        title: "Upload Failed",
        description: e2?.message || "Please check your connection and try again",
        variant: "destructive"
      });
    } finally {
      setUploading(prev => ({ ...prev, [field]: false }));
      try { e.target.value = ""; } catch (_) {}
    }
  };

  const handleImageRemove = async (field) => {
    if (!field || !profile?.[field] || uploading?.[field]) return;

    setUploading((prev) => ({ ...prev, [field]: true }));
    try {
      const updates = { [field]: null };
      await vendorApi.auth.updateProfile(updates);

      setProfile((prev) => ({ ...prev, [field]: '' }));
      setDraft((prev) => ({ ...prev, [field]: '' }));

      window.dispatchEvent(new Event('vendor_profile_updated'));
      toast({ title: "Image Removed" });
    } catch (error) {
      console.error('Image remove error:', error);
      toast({
        title: "Remove Failed",
        description: error?.message || "Could not remove image",
        variant: "destructive"
      });
    } finally {
      setUploading((prev) => ({ ...prev, [field]: false }));
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#003D82]" />
      </div>
    );
  }

  const companyTitle = profile.companyName || profile.company_name || 'My Company';
  const ownerTitle = profile.ownerName || profile.owner_name || '';

  return (
    <div className="bg-slate-50 min-h-screen pb-12 font-sans text-slate-900">
      <style>{`
        html { overflow-y: auto; }
        body { overflow-y: scroll; scrollbar-gutter: stable; }
        ::-webkit-scrollbar { width: 0 !important; }
        ::-webkit-scrollbar-track { background: transparent !important; }
        ::-webkit-scrollbar-thumb { background: transparent !important; }
        * { scrollbar-width: none !important; }
      `}</style>

      <div className="max-w-[1400px] mx-auto p-2 md:p-2 grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* === LEFT SIDEBAR (✅ FIXED: Both cards sticky together) === */}
        <div className="lg:col-span-3 lg:self-start">
          {/* ✅ Sticky wrapper: profile + subscription dono ek saath sticky */}
          <div className="space-y-6 lg:sticky lg:top-6">
            <Card className="border-t-4 border-t-[#003D82] shadow-sm">
              <div className="p-2 text-center border-b border-slate-100">
                <div className="relative inline-block group">
                  <button
                    type="button"
                    onClick={() => {
                      if (!profile.profile_image) return;
                      setImagePreviewOpen(true);
                    }}
                    className={`w-24 h-24 mx-auto bg-white rounded-full border-4 border-slate-100 shadow-sm overflow-hidden flex items-center justify-center ${profile.profile_image ? 'cursor-zoom-in' : 'cursor-default'}`}
                    aria-label="Open profile image preview"
                  >
                    {profile.profile_image ? (
                      <img src={profile.profile_image} className="w-full h-full object-cover" alt="Logo" />
                    ) : (
                      <span className="text-3xl font-bold text-slate-300">{(companyTitle?.[0] || 'M')}</span>
                    )}
                  </button>

                  <label className="absolute bottom-0 right-0 p-1.5 bg-[#003D82] rounded-full cursor-pointer hover:bg-blue-800 transition-colors shadow-sm">
                    {uploading.profile_image ? (
                      <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                    ) : (
                      <Camera className="w-3.5 h-3.5 text-white" />
                    )}
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={e => handleImageUpload(e, 'profile_image')}
                      disabled={!!uploading.profile_image}
                    />
                  </label>

                  {profile.profile_image ? (
                    <button
                      type="button"
                      className="absolute -top-1 -right-1 p-1.5 bg-red-600 rounded-full text-white hover:bg-red-700 disabled:opacity-60 shadow-sm"
                      onClick={() => handleImageRemove('profile_image')}
                      disabled={!!uploading.profile_image}
                      title="Remove profile photo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  ) : null}
                </div>

                <div className="mt-4">
                  <h2 className="text-lg font-bold text-slate-900 leading-tight flex items-center justify-center gap-2">
                    {companyTitle}
                    <Pencil
                      className="w-3 h-3 text-slate-400 cursor-pointer hover:text-[#003D82]"
                      onClick={() => { setActiveTab('primary'); setEditingSection('primary'); navigate(`?tab=primary`, { replace: true }); }}
                    />
                  </h2>
                  <p className="text-sm text-slate-500 font-medium mt-1">{ownerTitle}</p>
                </div>
              </div>

              <div className="p-5 space-y-4">
                <div className="flex items-start gap-3 text-sm">
                  <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <span className="min-w-0 break-words whitespace-normal text-slate-600 leading-relaxed">
                    {profile.address || 'Add Address'} <br />
                    {profile.city || 'City'}, {profile.state || 'State'} - {profile.pincode || 'Pincode'}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-sm">
                  <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-slate-600">{profile.phone || 'Add Phone'}</span>
                </div>

                <div className="flex items-center gap-3 text-sm">
                  <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="min-w-0 break-all text-slate-600">{profile.email || '—'}</span>
                </div>

                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-xs text-blue-600 font-semibold mb-1">Your Vendor ID</p>
                  <p className="text-sm font-bold text-blue-900">
                    {profile.vendorId || profile.vendor_id || 'Generating...'}
                  </p>
                </div>

                {/* KYC Status Badge */}
                <div className="mt-4">
                  {['VERIFIED', 'APPROVED'].includes(kycStatus) ? (
                    <div className="p-3 bg-green-50 rounded-lg border border-green-200 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-green-600 font-semibold">KYC Approved</p>
                        <p className="text-xs text-green-700 mt-0.5">Your account is verified</p>
                      </div>
                    </div>
                  ) : kycStatus === 'REJECTED' ? (
                    <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                      <p className="text-xs text-red-600 font-semibold mb-1">KYC Rejected</p>
                      <p className="text-xs text-red-700">Please resubmit your documents</p>
                    </div>
                  ) : (
                    <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                      <p className="text-xs text-yellow-600 font-semibold mb-1">KYC Pending</p>
                      <p className="text-xs text-yellow-700">Upload documents for verification</p>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Subscription Status Card (✅ Now sticky with profile card) */}
            <Card className="shadow-sm">
              <div className="p-5">
                <p className="text-xs text-slate-500 font-semibold mb-3">Subscription Status</p>
                <SubscriptionBadge subscription={subscription} loading={subscriptionLoading} />
              </div>
            </Card>
          </div>
        </div>

        {/* === MAIN CONTENT === */}
        <div className="lg:col-span-9">
          <Tabs
            value={activeTab}
            onValueChange={(val) => {
              setActiveTab(val);
              navigate(`?tab=${val}`, { replace: true });
            }}
            className="w-full"
          >
            <div className="bg-white rounded-t-lg border-b border-slate-200 shadow-sm">
              <TabsList className="w-full justify-start bg-transparent h-auto p-0 overflow-x-auto scrollbar-hide">
                {[
                  { label: 'Primary Details', value: 'primary' },
                  { label: 'Additional Details', value: 'additional' },
                  { label: 'Bank Details', value: 'bank' },
                  { label: 'Business Preferences', value: 'preferences' },
                  { label: 'KYC Documents', value: 'kyc' },
                ].map(t => (
                  <TabsTrigger
                    key={t.value}
                    value={t.value}
                    className="data-[state=active]:border-b-2 data-[state=active]:border-[#003D82] data-[state=active]:text-[#003D82] rounded-none px-4 py-3.5 h-auto text-slate-600 font-medium whitespace-nowrap text-sm"
                  >
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <div className="bg-white rounded-b-lg border border-t-0 border-slate-200 shadow-sm min-h-[500px]">
              {/* 1. PRIMARY DETAILS */}
              <TabsContent value="primary" className="m-0 p-6">
                <SectionHeader
                  title="Primary Details"
                  editing={editingSection === 'primary'}
                  onEdit={() => setEditingSection('primary')}
                  onCancel={() => { setDraft(profile); setEditingSection(null); }}
                  onSave={handleSave}
                  saving={saving}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Company Name</Label>
                    <Input
                      name="company_name"
                      disabled={editingSection !== 'primary'}
                      value={draft.companyName || draft.company_name || ''}
                      onChange={e => setDraft({ ...draft, companyName: e.target.value, company_name: e.target.value })}
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Owner Name</Label>
                    <Input
                      name="owner_name"
                      disabled={editingSection !== 'primary'}
                      value={draft.ownerName || draft.owner_name || ''}
                      onChange={e => setDraft({ ...draft, ownerName: e.target.value, owner_name: e.target.value })}
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Email (Read-only)</Label>
                    <Input disabled value={draft.email || ''} className="h-9 bg-slate-50" />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Mobile</Label>
                    <div className="flex gap-2">
                      <select
                        value={INDIA_COUNTRY_CODE}
                        disabled={editingSection !== 'primary'}
                        className="h-9 w-28 rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Vendor mobile country code"
                      >
                        <option value={INDIA_COUNTRY_CODE}>India (+91)</option>
                      </select>
                      <Input
                        name="phone"
                        type="tel"
                        inputMode="numeric"
                        disableAutoSanitize
                        maxLength={10}
                        disabled={editingSection !== 'primary'}
                        value={draft.phone || ''}
                        onChange={e => setDraft({ ...draft, phone: normalizeIndianPhoneInput(e.target.value) })}
                        className="h-9"
                        placeholder="10-digit mobile number"
                      />
                    </div>
                  </div>

                  {/* ✅ Secondary Email */}
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Secondary Email</Label>
                    <Input
                      name="secondary_email"
                      type="email"
                      disabled={editingSection !== 'primary'}
                      placeholder="secondary@example.com"
                      value={draft.secondaryEmail || draft.secondary_email || ''}
                      onChange={e => setDraft({ ...draft, secondaryEmail: e.target.value, secondary_email: e.target.value })}
                      className="h-9"
                    />
                  </div>

                  {/* ✅ Secondary Phone */}
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Second Phone Number</Label>
                    <Input
                      name="secondary_phone"
                      type="tel"
                      inputMode="numeric"
                      disableAutoSanitize
                      maxLength={10}
                      disabled={editingSection !== 'primary'}
                      placeholder="Alternate mobile"
                      value={draft.secondaryPhone || draft.secondary_phone || ''}
                      onChange={e => {
                        const secondaryPhone = normalizeIndianPhoneInput(e.target.value);
                        setDraft({ ...draft, secondaryPhone, secondary_phone: secondaryPhone });
                      }}
                      className="h-9"
                    />
                  </div>

                  {/* ✅ Landline */}
                  <div className="space-y-1 md:col-span-2">
                    <Label className="text-xs text-slate-500">Landline Number</Label>
                    <Input
                      name="landline_number"
                      type="tel"
                      inputMode="numeric"
                      disableAutoSanitize
                      maxLength={15}
                      disabled={editingSection !== 'primary'}
                      placeholder="Landline (optional)"
                      value={draft.landlineNumber || draft.landline_number || ''}
                      onChange={e => {
                        const landlineNumber = normalizeLandlineNumber(e.target.value);
                        setDraft({ ...draft, landlineNumber, landline_number: landlineNumber });
                      }}
                      className="h-9"
                    />
                  </div>

                  <div className="col-span-full">
                    <Label className="text-xs text-slate-500">Address</Label>
                    <Input
                      name="address"
                      disabled={editingSection !== 'primary'}
                      value={draft.address || ''}
                      onChange={e => setDraft({ ...draft, address: e.target.value })}
                      className="h-9 mb-4"
                    />

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Input
                        name="city"
                        placeholder="City"
                        disabled={editingSection !== 'primary'}
                        value={draft.city || ''}
                        onChange={e => setDraft({ ...draft, city: e.target.value })}
                        className="h-9"
                      />
                      <Input
                        name="state"
                        placeholder="State"
                        disabled={editingSection !== 'primary'}
                        value={draft.state || ''}
                        onChange={e => setDraft({ ...draft, state: e.target.value })}
                        className="h-9"
                      />
                      <Input
                        name="pincode"
                        inputMode="numeric"
                        placeholder="Pincode"
                        disabled={editingSection !== 'primary'}
                        value={draft.pincode || ''}
                        onChange={e => setDraft({ ...draft, pincode: e.target.value })}
                        className="h-9"
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* 2. ADDITIONAL DETAILS */}
              <TabsContent value="additional" className="m-0 p-6">
                <SectionHeader
                  title="Business & Statutory Details"
                  editing={editingSection === 'additional'}
                  onEdit={() => setEditingSection('additional')}
                  onCancel={() => { setDraft(profile); setEditingSection(null); }}
                  onSave={handleSave}
                  saving={saving}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 mt-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">GST Number</Label>
                    <Input
                      name="gst_number"
                      disabled={editingSection !== 'additional'}
                      maxLength={15}
                      value={draft.gstNumber || draft.gst_number || ''}
                      onChange={e => {
                        const gstNumber = normalizeCodeValue(e.target.value, 15);
                        setDraft({ ...draft, gstNumber, gst_number: gstNumber });
                      }}
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">PAN Number</Label>
                    <Input
                      name="pan_number"
                      disabled={editingSection !== 'additional'}
                      placeholder="ABCDE1234F"
                      maxLength={10}
                      value={draft.panNumber || draft.pan_number || ''}
                      onChange={e => {
                        const panNumber = normalizePanNumber(e.target.value);
                        setDraft({ ...draft, panNumber, pan_number: panNumber });
                      }}
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Aadhar Number</Label>
                    <Input
                      name="aadhar_number"
                      disabled={editingSection !== 'additional'}
                      inputMode="numeric"
                      placeholder="12-digit Aadhar number"
                      maxLength={12}
                      value={draft.aadharNumber || draft.aadhar_number || ''}
                      onChange={e => {
                        const aadharNumber = normalizeAadharNumber(e.target.value);
                        setDraft({ ...draft, aadharNumber, aadhar_number: aadharNumber });
                      }}
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Website URL</Label>
                    <Input
                      name="website_url"
                      type="url"
                      disableAutoSanitize
                      disabled={editingSection !== 'additional'}
                      placeholder="https://example.com"
                      value={draft.websiteUrl || draft.website_url || ''}
                      onChange={e => setDraft({ ...draft, websiteUrl: e.target.value, website_url: e.target.value })}
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Business Type</Label>
                    <Input
                      name="primary_business_type"
                      disabled={editingSection !== 'additional'}
                      value={draft.primaryBusinessType || draft.primary_business_type || ''}
                      onChange={e => setDraft({ ...draft, primaryBusinessType: e.target.value, primary_business_type: e.target.value })}
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Annual Turnover</Label>
                    <Input
                      name="annual_turnover"
                      inputMode="decimal"
                      disabled={editingSection !== 'additional'}
                      value={draft.annualTurnover || draft.annual_turnover || ''}
                      onChange={e => setDraft({ ...draft, annualTurnover: e.target.value, annual_turnover: e.target.value })}
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">CIN/LLPIN Number</Label>
                    <Input
                      name="cin_number"
                      disabled={editingSection !== 'additional'}
                      placeholder="CIN (if company)"
                      maxLength={21}
                      value={draft.cinNumber || draft.cin_number || ''}
                      onChange={e => {
                        const cinNumber = normalizeCodeValue(e.target.value, 21);
                        setDraft({ ...draft, cinNumber, cin_number: cinNumber });
                      }}
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">TAN Number</Label>
                    <Input
                      name="tan_number"
                      disabled={editingSection !== 'additional'}
                      placeholder="TAN Number"
                      maxLength={10}
                      value={draft.tanNumber || draft.tan_number || ''}
                      onChange={e => {
                        const tanNumber = normalizeCodeValue(e.target.value, 10);
                        setDraft({ ...draft, tanNumber, tan_number: tanNumber });
                      }}
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Import Export Code (IEC)</Label>
                    <Input
                      name="iec_code"
                      disabled={editingSection !== 'additional'}
                      placeholder="IEC Code"
                      maxLength={10}
                      value={draft.iecCode || draft.iec_code || ''}
                      onChange={e => {
                        const iecCode = normalizeCodeValue(e.target.value, 10);
                        setDraft({ ...draft, iecCode, iec_code: iecCode });
                      }}
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Year of Establishment</Label>
                    <Input
                      name="year_of_establishment"
                      disabled={editingSection !== 'additional'}
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="e.g. 2015"
                      value={draft.yearOfEstablishment ?? draft.year_of_establishment ?? ''}
                      onChange={e => setDraft({
                        ...draft,
                        yearOfEstablishment: e.target.value === '' ? null : e.target.value.replace(/\D/g, '').slice(0, 4),
                        year_of_establishment: e.target.value === '' ? null : e.target.value.replace(/\D/g, '').slice(0, 4),
                      })}
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-1 md:col-span-2">
                    <Label className="text-xs text-slate-500">Designation of Owner</Label>
                    <Input
                      name="owner_designation"
                      disabled={editingSection !== 'additional'}
                      placeholder="e.g. Proprietor / Director / CEO"
                      value={draft.ownerDesignation || draft.owner_designation || ''}
                      onChange={e => setDraft({ ...draft, ownerDesignation: e.target.value, owner_designation: e.target.value })}
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-1 md:col-span-2">
                    <Label className="text-xs text-slate-500">Business Description</Label>
                    <Textarea
                      disabled={editingSection !== 'additional'}
                      rows={4}
                      placeholder="Describe your products/services, experience, and specialties"
                      value={draft.businessDescription || draft.business_description || ''}
                      onChange={e => setDraft({
                        ...draft,
                        businessDescription: e.target.value,
                        business_description: e.target.value
                      })}
                      className="resize-none"
                    />
                  </div>
                </div>
              </TabsContent>

              {/* 3. BANK DETAILS */}
              <TabsContent value="bank" className="m-0 p-6">
                <BankingSection banks={banks} onRefresh={refreshProfileData} />
              </TabsContent>

              {/* 4. BUSINESS PREFERENCES */}
              <TabsContent value="preferences" className="m-0 p-6">
                <PreferencesSection />
              </TabsContent>

              {/* 5. KYC DOCUMENTS */}
              <TabsContent value="kyc" className="m-0 p-6">
                <DocumentsSection
                  documents={documents}
                  onRefresh={refreshProfileData}
                  kycStatus={kycStatus}
                />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>

      {imagePreviewOpen && profile.profile_image ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4"
          onClick={() => setImagePreviewOpen(false)}
        >
          <div
            className="relative w-full max-w-sm rounded-xl bg-white p-3 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setImagePreviewOpen(false)}
              className="absolute right-2 top-2 rounded-full bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200"
              aria-label="Close preview"
            >
              <X className="h-4 w-4" />
            </button>
            <img
              src={profile.profile_image}
              alt={companyTitle}
              className="w-full max-h-[320px] rounded-lg object-contain bg-slate-50"
            />
            <p className="mt-2 text-sm font-semibold text-slate-900 text-center">
              {companyTitle}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
};

// ---------------- SUB COMPONENTS ----------------

const SectionHeader = ({ title, editing, onEdit, onCancel, onSave, saving }) => (
  <div className="flex justify-between items-center mb-4 border-b pb-2">
    <h3 className="font-bold text-lg text-slate-900">{title}</h3>
    <div className="flex gap-2">
      {editing ? (
        <>
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" className="bg-[#003D82]" onClick={onSave} disabled={saving}>
            {saving ? (
              <Loader2 className="w-3 h-3 animate-spin mr-1" />
            ) : (
              <Save className="w-3 h-3 mr-1" />
            )}
            Save
          </Button>
        </>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          className="text-[#003D82] h-8 text-xs font-semibold hover:bg-blue-50"
          onClick={onEdit}
        >
          <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
        </Button>
      )}
    </div>
  </div>
);

const SectionHeaderWithActions = ({ title, onAdd }) => (
  <div className="flex justify-between items-center mb-4 border-b pb-2">
    <h3 className="font-bold text-lg text-slate-900">{title}</h3>
    {onAdd && (
      <Button
        size="sm"
        variant="ghost"
        className="text-[#003D82] h-8 text-xs font-semibold hover:bg-blue-50"
        onClick={onAdd}
      >
        <Plus className="w-3.5 h-3.5 mr-1" /> Add New
      </Button>
    )}
  </div>
);

const BankingSection = ({ banks, onRefresh }) => {
  const hasSavedBanks = banks.length > 0;
  const [newBanks, setNewBanks] = useState(() => createBankDrafts(banks));
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(() => !hasSavedBanks);

  useEffect(() => {
    setNewBanks(createBankDrafts(banks));
    setEditing(banks.length === 0);
  }, [banks]);

  const resetDraftsFromSavedBanks = useCallback(() => {
    setNewBanks(createBankDrafts(banks));
    setEditing(banks.length === 0);
  }, [banks]);

  const startEditingBanks = useCallback(() => {
    setNewBanks(createBankDrafts(banks));
    setEditing(true);
  }, [banks]);

  const startAddingBank = useCallback(() => {
    setNewBanks((currentBanks) => {
      const baseBanks = editing ? currentBanks : createBankDrafts(banks);
      return [...baseBanks, createEmptyBankDraft()];
    });
    setEditing(true);
  }, [banks, editing]);

  const handleUpdateBank = (index, field, value) => {
    let nextVal = value;
    if (field === 'account_number') {
      nextVal = (value || '').replace(/\D/g, '').slice(0, 30);
    } else if (field === 'ifsc_code') {
      nextVal = normalizeIfscCode(value);
    } else if (field === 'account_holder') {
      nextVal = normalizeAccountHolderName(value);
    } else if (field === 'bank_name' || field === 'branch_name') {
      nextVal = String(value || '').slice(0, 120);
    }
    setNewBanks((currentBanks) =>
      currentBanks.map((bank, bankIndex) =>
        bankIndex === index ? { ...bank, [field]: nextVal } : bank
      )
    );
  };

  const handleRemoveBank = async (index) => {
    const bank = newBanks[index];
    if (bank.id && !bank.id.startsWith('temp-')) {
      if (!window.confirm('Delete this bank account?')) return;
      try {
        await vendorApi.banking.delete(bank.id);
        await onRefresh();
        toast({ title: "Bank Deleted" });
      } catch (e) {
        toast({ title: "Delete failed", description: e?.message || "", variant: "destructive" });
        return;
      }
    }
    const updated = newBanks.filter((_, i) => i !== index);
    setNewBanks(updated.length > 0 ? updated : [createEmptyBankDraft()]);
  };

  const handleSaveAllBanks = async () => {
    setAdding(true);
    try {
      for (let index = 0; index < newBanks.length; index += 1) {
        const bank = newBanks[index];
        const normalizedBank = normalizeBankDraft(bank, index);
        if (!normalizedBank) {
          continue;
        }

        if (bank.id?.startsWith('temp-')) {
          await vendorApi.banking.add(normalizedBank);
        } else {
          await vendorApi.banking.update(bank.id, normalizedBank);
        }
      }
      await onRefresh();
      toast({ title: "Bank accounts saved" });
    } catch (e) {
      toast({ title: "Error saving banks", description: e?.message || "", variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const readOnly = !editing;
  const inputClassName = editing
    ? 'h-9 bg-white'
    : 'h-9 border-slate-200 bg-slate-100 text-slate-700';

  return (
    <div>
      <div className="flex justify-between items-center mb-4 border-b pb-2">
        <div className="flex items-center gap-3">
          <h3 className="font-bold text-lg text-slate-900">Bank Accounts</h3>
          {hasSavedBanks && readOnly ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-[11px] font-semibold text-green-700">
              <CheckCircle className="h-3.5 w-3.5" />
              Saved
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {editing && hasSavedBanks ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs font-semibold text-slate-500 hover:bg-slate-100"
              onClick={resetDraftsFromSavedBanks}
              disabled={adding}
            >
              Cancel
            </Button>
          ) : null}

          {editing ? (
            <Button
              size="sm"
              variant="ghost"
              className="text-[#003D82] h-8 text-xs font-semibold hover:bg-blue-50"
              onClick={startAddingBank}
              disabled={adding}
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Another
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="text-[#003D82] h-8 text-xs font-semibold hover:bg-blue-50"
                onClick={startAddingBank}
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Add New Account
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-[#003D82] h-8 text-xs font-semibold hover:bg-blue-50"
                onClick={startEditingBanks}
              >
                <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
              </Button>
            </>
          )}
        </div>
      </div>

      {hasSavedBanks && readOnly ? (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Bank details saved</p>
            <p className="text-green-700">The saved details are shown below in read-only mode. Use Edit to update them or Add New Account to add another bank.</p>
          </div>
        </div>
      ) : null}

      <div className="space-y-4 max-h-96 overflow-y-auto pr-3" style={{
        scrollbarWidth: 'thin',
        scrollbarColor: '#cbd5e1 #f1f5f9'
      }}>
        {newBanks.map((bank, index) => (
          <div
            key={bank.id}
            className={`rounded-lg border p-4 animate-in fade-in ${
              readOnly ? 'border-slate-200 bg-white' : 'bg-slate-50'
            }`}
          >
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-sm font-bold">Bank Account {index + 1}</h4>
              {editing ? (
                <Trash2
                  className="w-4 h-4 text-slate-400 hover:text-red-500 cursor-pointer"
                  onClick={() => handleRemoveBank(index)}
                />
              ) : null}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                placeholder="Account Number"
                className={inputClassName}
                readOnly={readOnly}
                value={bank.account_number || ''}
                onChange={e => handleUpdateBank(index, 'account_number', e.target.value)}
              />
              <Input
                placeholder="IFSC Code"
                className={inputClassName}
                readOnly={readOnly}
                value={bank.ifsc_code || ''}
                onChange={e => handleUpdateBank(index, 'ifsc_code', e.target.value)}
              />
              <Input
                placeholder="Bank Name"
                className={inputClassName}
                readOnly={readOnly}
                value={bank.bank_name || ''}
                onChange={e => handleUpdateBank(index, 'bank_name', e.target.value)}
              />
              <Input
                placeholder="Branch Name"
                className={inputClassName}
                readOnly={readOnly}
                value={bank.branch_name || ''}
                onChange={e => handleUpdateBank(index, 'branch_name', e.target.value)}
              />
              <Input
                name="account_holder"
                placeholder="Account Holder Name"
                inputMode="text"
                disableAutoSanitize
                className={`${inputClassName} md:col-span-2`}
                readOnly={readOnly}
                value={bank.account_holder || bank.accountHolder || ''}
                onChange={e => handleUpdateBank(index, 'account_holder', e.target.value)}
              />
            </div>
          </div>
        ))}
      </div>

      {editing ? (
        <div className="flex justify-end gap-2 mt-4">
          <Button
            className="bg-[#003D82]"
            onClick={handleSaveAllBanks}
            disabled={adding}
          >
            {adding ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Save Bank Details
          </Button>
        </div>
      ) : null}
    </div>
  );
};

const DocumentsSection = ({ documents, onRefresh, kycStatus }) => {
  const [uploadingType, setUploadingType] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const normalizedKycStatus = String(kycStatus || '').trim().toUpperCase();
  const kycLocked = normalizedKycStatus === 'VERIFIED' || normalizedKycStatus === 'APPROVED';
  const kycApproved = kycLocked;

  const handleUpload = async (e, type) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (kycLocked) {
      toast({
        title: "KYC Locked",
        description: "Approved KYC documents cannot be changed.",
        variant: "destructive"
      });
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: "Please upload a file smaller than 10MB",
        variant: "destructive"
      });
      return;
    }

    setUploadingType(type);
    try {
      await vendorApi.documents.upload(file, type);
      await onRefresh();
      toast({ title: "Document uploaded successfully" });
    } catch (err) {
      console.error('Document upload error:', err);
      toast({
        title: "Upload failed",
        description: err?.message || "Please check your internet connection and try again",
        variant: "destructive"
      });
    } finally {
      setUploadingType(null);
      try { e.target.value = ""; } catch (_) {}
    }
  };

  const handleDelete = async (id) => {
    if (kycLocked) {
      toast({
        title: "KYC Locked",
        description: "Approved KYC documents cannot be changed.",
        variant: "destructive"
      });
      return;
    }
    if (!window.confirm('Delete this document?')) return;
    try {
      await vendorApi.documents.delete(id);
      await onRefresh();
      toast({ title: "Document Deleted" });
    } catch (e) {
      toast({ title: "Delete failed", description: e?.message || "", variant: "destructive" });
    }
  };

  const docTypes = [
    { id: 'GST', label: 'GST Certificate' },
    { id: 'PAN', label: 'PAN Card' },
    { id: 'AADHAR', label: 'Aadhar Card' },
    { id: 'BANK', label: 'Bank Passbook/Cheque Copy' },
  ];
  const uploadedRequiredCount = docTypes.filter((type) =>
    documents.some((doc) => String(doc?.document_type || '').toUpperCase() === type.id)
  ).length;
  const canSubmitKyc = uploadedRequiredCount === docTypes.length;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold text-lg">KYC Documents</h3>
        <Badge>{kycStatus || 'PENDING'}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {docTypes.map(type => {
          const doc = documents.find((d) => String(d?.document_type || '').trim().toUpperCase() === type.id);
          const allowReplacement = Boolean(doc && !kycLocked);

          return (
            <div key={type.id} className="border rounded-lg p-4 flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${doc ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                  {doc ? <Check className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                </div>
                <div>
                  <p className="font-semibold text-sm text-slate-700">{type.label}</p>
                  <p className="text-[10px] text-slate-400">
                    {doc
                      ? `Uploaded ${new Date(doc.uploaded_at).toLocaleDateString()} ${new Date(doc.uploaded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                      : 'Pending Upload'}
                  </p>
                </div>
              </div>

              {doc ? (
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" asChild>
                    <a href={doc.document_url} target="_blank" rel="noreferrer" aria-label={`View ${type.label}`}>
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </Button>
                  {allowReplacement ? (
                    <label className="cursor-pointer">
                      <div className="inline-flex h-9 items-center rounded-md border px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                        {normalizedKycStatus === 'REJECTED' ? 'Re-upload' : 'Replace'}
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                        onChange={e => handleUpload(e, type.id)}
                        disabled={!!uploadingType}
                      />
                    </label>
                  ) : null}
                  {!kycLocked && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-red-400"
                      aria-label={`Delete ${type.label}`}
                      onClick={() => handleDelete(doc.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ) : (
                kycLocked ? (
                  <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">
                    Locked after approval
                  </span>
                ) : (
                  <label className="cursor-pointer">
                    <div className={`px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded ${uploadingType === type.id ? 'opacity-50' : ''}`}>
                      {uploadingType === type.id ? 'Uploading...' : normalizedKycStatus === 'REJECTED' ? 'Re-upload' : 'Upload'}
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                      onChange={e => handleUpload(e, type.id)}
                      disabled={!!uploadingType}
                    />
                  </label>
                )
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-slate-500">
        KYC upload rules: only JPG/PNG, minimum 100KB, maximum 2MB, and exactly 4 required document slots.
      </p>

      {normalizedKycStatus === 'REJECTED' && (
        <p className="mt-2 text-xs text-amber-700">
          Your KYC was rejected. Replace the required documents and submit again.
        </p>
      )}

      <div className="mt-8 flex justify-end border-t pt-4">
        {kycApproved ? (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-right">
            <p className="text-sm font-semibold text-green-800">KYC already approved</p>
            <p className="text-xs text-green-700">Your documents are now locked and cannot be edited.</p>
          </div>
        ) : (
          <Button
            type="button"
            className="bg-[#003D82] px-8"
            disabled={submitting || normalizedKycStatus === 'SUBMITTED' || !canSubmitKyc}
            onClick={async () => {
              setSubmitting(true);
              try {
                await vendorApi.kyc.submit();
                await onRefresh();
                toast({ title: "KYC Submitted" });
              } catch (e) {
                toast({ title: "Submit failed", description: e?.message || "", variant: "destructive" });
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Submitting...
              </>
            ) : (
              (normalizedKycStatus === 'SUBMITTED'
                ? 'Verification In Progress'
                : normalizedKycStatus === 'REJECTED'
                  ? 'Resubmit for Verification'
                  : 'Submit for Verification')
            )}
          </Button>
        )}
      </div>
    </div>
  );
};

export default Profile;
