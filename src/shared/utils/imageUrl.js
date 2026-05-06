const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
};

const safeUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return null;

  try {
    return new URL(raw);
  } catch {
    return null;
  }
};

/**
 * Build Cloudinary transformation segment.
 * e.g. "f_auto,q_72,w_400,h_300,c_limit"
 */
const buildCloudinaryTransform = ({ width, height, quality }) => {
  const parts = ['f_auto'];
  if (quality) parts.push(`q_${quality}`);
  if (width) parts.push(`w_${width}`);
  if (height) parts.push(`h_${height}`);
  if (width || height) parts.push('c_limit');
  return parts.join(',');
};

/**
 * Inject transformations into an existing Cloudinary URL.
 * Cloudinary URLs follow: /image/upload/[transforms]/[public_id]
 */
const optimizeCloudinaryUrl = (url, transform) => {
  const raw = url.toString();
  const uploadIdx = raw.indexOf('/upload/');
  if (uploadIdx === -1) return raw;

  const before = raw.slice(0, uploadIdx + '/upload/'.length);
  const after = raw.slice(uploadIdx + '/upload/'.length);

  // Check if transforms already exist (starts with a segment like f_auto, w_, etc.)
  const hasTransforms = /^[a-z]_/.test(after);
  if (hasTransforms) {
    // Replace existing transform segment
    const slashIdx = after.indexOf('/');
    if (slashIdx === -1) return raw;
    return `${before}${transform}/${after.slice(slashIdx + 1)}`;
  }

  return `${before}${transform}/${after}`;
};

export const optimizeImageUrl = (value, options = {}) => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const url = safeUrl(raw);
  if (!url) return raw;

  const width = toNumber(options.width);
  const height = toNumber(options.height);
  const quality = toNumber(options.quality) || 72;
  const host = String(url.hostname || '').toLowerCase();

  if (host.includes('images.unsplash.com')) {
    url.searchParams.set('auto', 'format');
    url.searchParams.set('fit', 'crop');
    if (width) url.searchParams.set('w', String(width));
    if (height) url.searchParams.set('h', String(height));
    url.searchParams.set('q', String(quality));
    return url.toString();
  }

  if (host.includes('res.cloudinary.com')) {
    const transform = buildCloudinaryTransform({ width, height, quality });
    return optimizeCloudinaryUrl(url, transform);
  }

  // Supabase storage — return raw URL without any render/transform params.
  // This avoids triggering Supabase image transformation quotas.
  if (host.includes('.supabase.co') && url.pathname.includes('/storage/v1/object/public/')) {
    return raw.split('?')[0];
  }

  return raw;
};
