import React, { useEffect, useState, useCallback } from 'react';
import { fetchWithCsrf } from '@/lib/fetchWithCsrf';
import { apiUrl } from '@/lib/apiBase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/Card';
import { toast } from '@/components/ui/use-toast';

const Settings = () => {
  const [settings, setSettings] = useState({
    commissionRate: 5,
    maxUploadSize: 10,
    maintenanceMode: false,
    allowVendorRegistration: true,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetchWithCsrf(apiUrl('/api/admin/system-config'));
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.error || 'Failed to load system settings');
      }

      const data = payload?.config || null;
      if (data) {
        setSettings((prev) => ({
          ...prev,
          commissionRate:
            typeof data.commission_rate === 'number'
              ? data.commission_rate
              : Number(data.commission_rate ?? prev.commissionRate) || prev.commissionRate,
          maxUploadSize:
            typeof data.max_upload_size_mb === 'number'
              ? data.max_upload_size_mb
              : Number(data.max_upload_size_mb ?? prev.maxUploadSize) || prev.maxUploadSize,
          maintenanceMode: data.maintenance_mode === true,
          allowVendorRegistration:
            typeof data.allow_vendor_registration === 'boolean'
              ? data.allow_vendor_registration
              : prev.allowVendorRegistration,
        }));
      } else {
        // Row not found -> keep defaults
        console.log('[Admin Settings] No system config row found');
      }
    } catch (err) {
      console.error('[Admin Settings] Failed to fetch settings:', err);
      toast({
        title: 'Error',
        description: err?.message || 'Failed to load system settings.',
        variant: 'destructive',
      });
    }
  }, []);

  useEffect(() => {
    console.log('[Admin Settings] Mounted');
    (async () => {
      setLoading(true);
      await fetchSettings();
      setLoading(false);
    })();
  }, [fetchSettings]);

  const handleChange = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      const payload = {
        maintenance_mode: settings.maintenanceMode === true,
        allow_vendor_registration: settings.allowVendorRegistration === true,
        commission_rate: Number(settings.commissionRate) || 0,
        max_upload_size_mb: Number(settings.maxUploadSize) || 0,
      };

      const response = await fetchWithCsrf(apiUrl('/api/admin/system-config'), {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || json?.success === false) {
        throw new Error(json?.error || 'Failed to save settings');
      }

      await fetchSettings();

      toast({
        title: 'Settings Saved',
        description: 'System configuration has been updated.',
      });
    } catch (err) {
      console.error('[Admin Settings] Failed to save settings:', err);
      toast({
        title: 'Error',
        description: err?.message || 'Failed to save settings. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="py-10 text-sm text-neutral-500">Loading settings...</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-neutral-800">System Settings</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>General Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="commission">Default Commission Rate (%)</Label>
              <Input
                type="number"
                id="commission"
                value={settings.commissionRate}
                onChange={(e) => handleChange('commissionRate', e.target.value)}
              />
            </div>

            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="uploadSize">Max File Upload Size (MB)</Label>
              <Input
                type="number"
                id="uploadSize"
                value={settings.maxUploadSize}
                onChange={(e) => handleChange('maxUploadSize', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Feature Toggles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between space-x-2">
              <Label htmlFor="maintenance-mode" className="flex flex-col space-y-1">
                <span>Maintenance Mode</span>
                <span className="font-normal leading-snug text-muted-foreground">
                  Disable access for all non-admin users.
                </span>
              </Label>
              <Switch
                id="maintenance-mode"
                checked={settings.maintenanceMode}
                onCheckedChange={(checked) => handleChange('maintenanceMode', checked)}
              />
            </div>

            <div className="flex items-center justify-between space-x-2">
              <Label htmlFor="vendor-reg" className="flex flex-col space-y-1">
                <span>Allow Vendor Registration</span>
                <span className="font-normal leading-snug text-muted-foreground">
                  Open public registration for new vendors.
                </span>
              </Label>
              <Switch
                id="vendor-reg"
                checked={settings.allowVendorRegistration}
                onCheckedChange={(checked) => handleChange('allowVendorRegistration', checked)}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={handleSave} className="bg-[#003D82]" disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
};

export default Settings;
