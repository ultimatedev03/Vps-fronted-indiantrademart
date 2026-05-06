import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { vendorApi } from '@/modules/vendor/services/vendorApi';
import { MIN_IMAGE_UPLOAD_BYTES, validateImageFile } from '@/shared/utils/fileValidation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from '@/components/ui/use-toast';
import { Upload, FileText, Trash2, Loader2, Eye, Download, CheckCircle, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Helper to get vendor ID
const getVendorId = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data: vendor, error } = await supabase
    .from('vendors')
    .select('id')
    .eq('user_id', user.id)
    .single();
  if (error || !vendor) throw new Error('Vendor not found');
  return vendor.id;
};

const uploadGeneralDocument = async (file) => {
  const vendorId = await getVendorId();
  if (!vendorId) throw new Error('No vendor found');

  if (String(file?.type || '').toLowerCase().startsWith('image/')) {
    validateImageFile(file, {
      minBytes: MIN_IMAGE_UPLOAD_BYTES,
      maxBytes: 10 * 1024 * 1024,
      label: 'Image',
    });
  }

  const documentUrl = await vendorApi.auth.uploadImage(file, 'product-media', {
    uploadPurpose: 'GENERAL_DOCUMENT',
    documentType: 'GENERAL',
  });

  const { data, error } = await supabase
    .from('vendor_documents')
    .insert([{
      vendor_id: vendorId,
      document_type: 'GENERAL',
      document_url: documentUrl,
      original_name: file.name,
      verification_status: 'PENDING'
    }])
    .select()
    .single();
  if (error) throw error;
  return data;
};

const KYC_DOCS = [
  { key: 'gst', apiType: 'GST', label: 'GST' },
  { key: 'pan', apiType: 'PAN', label: 'PAN' },
  { key: 'aadhar', apiType: 'AADHAR', label: 'Aadhar' },
  { key: 'bank_statement', apiType: 'BANK', label: 'Bank Statement' },
];

const PhotosDocs = () => {
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [kycStatus, setKycStatus] = useState('PENDING');

  useEffect(() => {
    const setupSubscription = async () => {
      loadDocs();
      loadKycStatus();
      
      // Subscribe to real-time KYC status updates
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const subscription = supabase
          .channel('kyc_status_updates')
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'vendors',
              filter: `user_id=eq.${user.id}`
            },
            (payload) => {
              if (payload.new?.kyc_status) {
                setKycStatus(payload.new.kyc_status);
              }
            }
          )
          .subscribe();
        
        return () => {
          subscription?.unsubscribe();
        };
      }
    };
    
    setupSubscription();
  }, []);
  
  const loadKycStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data: vendor, error } = await supabase
        .from('vendors')
        .select('kyc_status')
        .eq('user_id', user.id)
        .single();
      
      if (!error && vendor) {
        setKycStatus(vendor.kyc_status);
      }
    } catch (error) {
      console.error('Error loading KYC status:', error);
    }
  };

  const loadDocs = async () => {
    try {
      const data = await vendorApi.documents.list();
      setDocuments(data || []);
    } catch (error) {
      console.error('Error loading documents:', error);
      toast({ title: "Failed to load documents", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e, type) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      if (String(type || '').trim().toUpperCase() === 'GENERAL') {
        await uploadGeneralDocument(file);
        toast({ title: "Upload successful" });
        await loadDocs();
        return;
      }

      await vendorApi.documents.upload(file, type);
      toast({ title: "Upload successful" });
      await loadDocs();
    } catch (error) {
      console.error('Upload error:', error);
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
      try { e.target.value = ''; } catch (_) {}
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure?")) return;
    try {
      await vendorApi.documents.delete(id);
      setDocuments(documents.filter(d => d.id !== id));
      toast({ title: "Deleted successfully" });
    } catch (error) {
      console.error('Delete error:', error);
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    }
  };

  const normalizedKycStatus = String(kycStatus || '').trim().toUpperCase();
  const kycLocked = ['VERIFIED', 'APPROVED'].includes(normalizedKycStatus);
  const kycRejected = normalizedKycStatus === 'REJECTED';
  const kycDocs = useMemo(
    () =>
      documents.filter((doc) =>
        KYC_DOCS.some((item) => item.apiType === String(doc?.document_type || '').trim().toUpperCase())
      ),
    [documents]
  );
  const otherDocs = documents.filter(
    (doc) => !KYC_DOCS.some((item) => item.apiType === String(doc?.document_type || '').trim().toUpperCase())
  );

  if (loading) return <div>Loading documents...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Documents & KYC</h1>
      
      {['VERIFIED', 'APPROVED'].includes(normalizedKycStatus) && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 ml-2">
            <strong>KYC Approved!</strong> Your account has been verified. You now have full access to all features.
          </AlertDescription>
        </Alert>
      )}
      
      {normalizedKycStatus === 'REJECTED' && (
        <Alert className="bg-red-50 border-red-200">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800 ml-2">
            <strong>KYC Rejected</strong> - Please review the feedback and resubmit your documents.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="kyc" className="space-y-6">
        <TabsList>
          <TabsTrigger value="kyc">KYC Documents</TabsTrigger>
          <TabsTrigger value="other">Other Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="kyc" className="space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {KYC_DOCS.map(({ key, apiType, label }) => {
                  const existingDoc = kycDocs.find(
                    (doc) => String(doc?.document_type || '').trim().toUpperCase() === apiType
                  );
                  const docStatus = String(existingDoc?.verification_status || 'PENDING').trim().toUpperCase();
                  const canReplace = Boolean(existingDoc && !kycLocked);
                  return (
                  <Card key={key} className="border-dashed border-2 hover:border-blue-500 transition-colors">
                      <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
                          <div className="bg-blue-50 p-3 rounded-full">
                              <FileText className="w-6 h-6 text-blue-600" />
                          </div>
                          <h3 className="font-semibold capitalize">{label}</h3>
                          
                          {existingDoc ? (
                              <div className="w-full space-y-2">
                                  <Badge variant="success" className="w-full justify-center">
                                    {docStatus === 'REJECTED' ? 'Rejected' : docStatus === 'VERIFIED' ? 'Verified' : 'Uploaded'}
                                  </Badge>
                                  <div className="flex gap-2 justify-center">
                                      <Button size="sm" variant="outline" asChild>
                                          <a
                                            href={existingDoc.document_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            aria-label={`View ${label} document`}
                                          >
                                              <Eye className="w-3 h-3" />
                                          </a>
                                      </Button>
                                      {canReplace ? (
                                        <Button asChild size="sm" variant="secondary" disabled={uploading}>
                                          <label className="cursor-pointer">
                                            <span className="inline-flex items-center gap-1">
                                              {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                                              {kycRejected ? 'Re-upload' : 'Replace'}
                                            </span>
                                            <input
                                              type="file"
                                              className="hidden"
                                              accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                                              onChange={(event) => handleUpload(event, apiType)}
                                            />
                                          </label>
                                        </Button>
                                      ) : null}
                                      {!kycLocked && (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="destructive"
                                        aria-label={`Delete ${label} document`}
                                        onClick={() => handleDelete(existingDoc.id)}
                                      >
                                          <Trash2 className="w-3 h-3" />
                                      </Button>
                                      )}
                                  </div>
                              </div>
                          ) : (
                              <Button asChild className="w-full" disabled={uploading || kycLocked}>
                                  <label className="cursor-pointer">
                                      {uploading ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Upload className="w-3 h-3 mr-2" />}
                                      {kycRejected ? 'Re-upload' : 'Upload'}
                                      <input
                                        type="file"
                                        className="hidden"
                                        accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                                        onChange={(event) => handleUpload(event, apiType)}
                                      />
                                  </label>
                              </Button>
                          )}
                      </CardContent>
                  </Card>
              )})}
           </div>
        </TabsContent>

        <TabsContent value="other" className="space-y-6">
          <div className="flex items-center gap-4">
            <Button asChild className="bg-[#003D82]" disabled={uploading}>
              <label className="cursor-pointer">
                {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Upload General Document
                <input 
                  type="file" 
                  accept=".pdf,.doc,.docx,.jpg,.png" 
                  className="hidden"
                  onChange={(e) => handleUpload(e, 'GENERAL')}
                  disabled={uploading}
                />
              </label>
            </Button>
          </div>

          <div className="space-y-2">
            {otherDocs.map(doc => (
              <div key={doc.id} className="flex items-center justify-between p-4 bg-white border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="bg-gray-100 p-2 rounded">
                    <FileText className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{doc.original_name || 'Document'}</p>
                    <p className="text-xs text-gray-500">{new Date(doc.uploaded_at).toLocaleDateString()} • {doc.document_type}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href={doc.document_url} target="_blank" rel="noreferrer"><Download className="w-4 h-4" /></a>
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="text-red-500 hover:text-red-600" onClick={() => handleDelete(doc.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {otherDocs.length === 0 && (
              <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                <p className="text-gray-500">No additional documents uploaded.</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PhotosDocs;
