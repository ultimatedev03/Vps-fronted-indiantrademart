const IMAGE_TARGETS = {
  product: { maxWidth: 1600, maxHeight: 1600, maxBytes: 900 * 1024, quality: 0.84 },
  kyc: { maxWidth: 1800, maxHeight: 1800, maxBytes: 1400 * 1024, quality: 0.86 },
  category: { maxWidth: 1400, maxHeight: 1400, maxBytes: 700 * 1024, quality: 0.82 },
  avatar: { maxWidth: 1000, maxHeight: 1000, maxBytes: 700 * 1024, quality: 0.82 },
  general: { maxWidth: 1800, maxHeight: 1800, maxBytes: 2 * 1024 * 1024, quality: 0.86 },
};

const OPTIMIZABLE_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

export const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });

const canvasToBlob = (canvas, type, quality) =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to optimize image'));
      },
      type,
      quality
    );
  });

const loadImage = async (file) => {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      // Fall through to HTMLImageElement for broader browser support.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to read image'));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
};

const getDimensions = (source) => ({
  width: Number(source?.width || source?.naturalWidth || 0),
  height: Number(source?.height || source?.naturalHeight || 0),
});

const drawToBlob = async ({ source, width, height, type, quality }) => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));

  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Image optimizer is not available in this browser');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

  return canvasToBlob(canvas, type, quality);
};

const replaceExtension = (name = 'image', extension = 'jpg') => {
  const base = String(name || 'image').replace(/\.[^/.]+$/, '') || 'image';
  return `${base}.${extension}`;
};

export const optimizeImageFile = async (file, purpose = 'general', options = {}) => {
  if (!file || typeof window === 'undefined' || typeof document === 'undefined') return file;

  const inputType = String(file.type || '').toLowerCase();
  if (!OPTIMIZABLE_IMAGE_TYPES.has(inputType)) return file;

  const target = {
    ...(IMAGE_TARGETS[purpose] || IMAGE_TARGETS.general),
    ...options,
  };

  const outputType = target.outputType || 'image/jpeg';
  const extension = outputType === 'image/webp' ? 'webp' : 'jpg';
  const source = await loadImage(file);
  const { width: originalWidth, height: originalHeight } = getDimensions(source);
  if (!originalWidth || !originalHeight) return file;

  const scale = Math.min(1, target.maxWidth / originalWidth, target.maxHeight / originalHeight);
  let width = originalWidth * scale;
  let height = originalHeight * scale;
  let quality = Number(target.quality || 0.84);
  const minQuality = Number(target.minQuality || 0.62);
  const maxBytes = Number(target.maxBytes || 0);

  let bestBlob = await drawToBlob({ source, width, height, type: outputType, quality });

  while (maxBytes > 0 && bestBlob.size > maxBytes && quality > minQuality) {
    quality = Math.max(minQuality, quality - 0.08);
    bestBlob = await drawToBlob({ source, width, height, type: outputType, quality });
  }

  while (maxBytes > 0 && bestBlob.size > maxBytes && width > 640 && height > 640) {
    width *= 0.88;
    height *= 0.88;
    bestBlob = await drawToBlob({ source, width, height, type: outputType, quality: minQuality });
  }

  if (typeof source.close === 'function') source.close();

  if (bestBlob.size >= Number(file.size || 0) && scale === 1) return file;

  return new File([bestBlob], replaceExtension(file.name, extension), {
    type: outputType,
    lastModified: Date.now(),
  });
};

export const optimizeMediaFile = async (file, purpose = 'general', options = {}) => {
  const type = String(file?.type || '').toLowerCase();
  if (type.startsWith('image/')) {
    return optimizeImageFile(file, purpose, options);
  }
  return file;
};
