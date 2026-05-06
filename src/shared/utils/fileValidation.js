export const MIN_IMAGE_UPLOAD_BYTES = 10 * 1024;

export const formatFileSize = (bytes = 0) => {
  const size = Number(bytes || 0);
  if (!Number.isFinite(size) || size <= 0) return '0B';
  if (size >= 1024 * 1024) return `${Math.round((size / (1024 * 1024)) * 10) / 10}MB`;
  if (size >= 1024) return `${Math.round(size / 1024)}KB`;
  return `${Math.round(size)}B`;
};

export const validateImageFile = (file, options = {}) => {
  if (!file) {
    throw new Error('No file selected');
  }

  const minBytes = Number(options.minBytes ?? MIN_IMAGE_UPLOAD_BYTES);
  const maxBytes = Number(options.maxBytes ?? 0);
  const label = String(options.label || 'Image').trim() || 'Image';
  const mime = String(file.type || '').toLowerCase();
  const allowedMimePrefixes = Array.isArray(options.allowedMimePrefixes)
    ? options.allowedMimePrefixes
    : ['image/'];
  const allowedMimeTypes = Array.isArray(options.allowedMimeTypes) ? options.allowedMimeTypes : null;

  if (allowedMimeTypes?.length) {
    if (mime && !allowedMimeTypes.includes(mime)) {
      throw new Error(options.mimeMessage || `${label} type is not supported`);
    }
  } else if (
    allowedMimePrefixes?.length &&
    mime &&
    !allowedMimePrefixes.some((prefix) => mime.startsWith(String(prefix || '').toLowerCase()))
  ) {
    throw new Error(options.mimeMessage || `${label} type is not supported`);
  }

  const size = Number(file.size || 0);
  if (minBytes > 0 && size < minBytes) {
    throw new Error(`${label} too small (minimum ${formatFileSize(minBytes)})`);
  }
  if (maxBytes > 0 && size > maxBytes) {
    throw new Error(`${label} too large (maximum ${formatFileSize(maxBytes)})`);
  }

  return true;
};
