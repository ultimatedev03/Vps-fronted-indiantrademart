
import { dbClient } from '@/lib/dbClient';
import { fetchWithCsrf } from '@/lib/fetchWithCsrf';
import { apiUrl } from '@/lib/apiBase';
import { resolveBuyerProfile } from '@/modules/buyer/services/buyerSession';
import { MIN_IMAGE_UPLOAD_BYTES, validateImageFile } from '@/shared/utils/fileValidation';
import { fileToDataUrl, optimizeMediaFile } from '@/shared/utils/mediaOptimizer';

export const buyerProfileApi = {
  getProfile: async () => {
    return resolveBuyerProfile({ required: true });
  },

  updateProfile: async (updates) => {
    const res = await fetchWithCsrf(apiUrl('/api/auth/buyer/profile'), {
      method: 'PATCH',
      body: JSON.stringify(updates || {}),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || 'Failed to update profile');
    }
    return json?.buyer || null;
  },

  uploadAvatar: async (file) => {
    if (!file) throw new Error('No file selected');
    const uploadFile = await optimizeMediaFile(file, 'avatar');
    validateImageFile(uploadFile, {
      minBytes: MIN_IMAGE_UPLOAD_BYTES,
      maxBytes: 5 * 1024 * 1024,
      label: 'Image',
    });

    const dataUrl = await fileToDataUrl(uploadFile);

    const res = await fetchWithCsrf(apiUrl('/api/auth/buyer/profile/avatar'), {
      method: 'POST',
      body: JSON.stringify({
        file_name: uploadFile.name,
        content_type: uploadFile.type,
        data_url: dataUrl,
        size: uploadFile.size,
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || 'Failed to upload avatar');
    }

    return json?.publicUrl || null;
  },

  changePassword: async (newPassword) => {
    const { error } = await dbClient.auth.updateUser({
      password: newPassword
    });

    if (error) throw error;
    return true;
  }
};
