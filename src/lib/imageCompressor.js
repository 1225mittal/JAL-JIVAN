/**
 * Client-side Image Compression Utility
 * Prevents "413 Payload Too Large" errors by resizing mobile camera uploads
 * (8MB - 20MB+) down to ~150KB - 300KB before sending to OCR & storage endpoints.
 */

/**
 * Compresses an image File, Blob, or base64 data URL using HTML5 Canvas.
 * 
 * @param {File|Blob|string} input - The source image file, blob, or data URL
 * @param {Object} [options]
 * @param {number} [options.maxDimension=1280] - Max width or height in pixels
 * @param {number} [options.quality=0.75] - JPEG quality from 0.1 to 1.0
 * @param {string} [options.outputType='image/jpeg'] - Output MIME type
 * @returns {Promise<{base64: string, file: File, blob: Blob, width: number, height: number}>}
 */
export async function compressImage(input, options = {}) {
  const {
    maxDimension = 1280,
    quality = 0.75,
    outputType = 'image/jpeg'
  } = options;

  if (!input) {
    throw new Error('compressImage: No image input provided');
  }

  // 1. Resolve source URL
  let objectUrl = null;
  let src = '';

  if (typeof input === 'string') {
    src = input;
  } else if (input instanceof Blob || input instanceof File) {
    objectUrl = URL.createObjectURL(input);
    src = objectUrl;
  } else {
    throw new Error('compressImage: Unsupported input format');
  }

  // 2. Load into HTML Image
  const img = await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = (err) => reject(new Error('Failed to load image for compression: ' + err));
    image.src = src;
  });

  // Clean up temporary object URL if created
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
  }

  // 3. Calculate target dimensions maintaining aspect ratio
  let width = img.naturalWidth || img.width;
  let height = img.naturalHeight || img.height;

  if (width > maxDimension || height > maxDimension) {
    if (width > height) {
      height = Math.round((height * maxDimension) / width);
      width = maxDimension;
    } else {
      width = Math.round((width * maxDimension) / height);
      height = maxDimension;
    }
  }

  // Ensure minimum dimensions
  width = Math.max(1, width);
  height = Math.max(1, height);

  // 4. Render to canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas 2D context is not supported in this browser.');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Draw background white in case of transparent PNG converted to JPEG
  if (outputType === 'image/jpeg') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
  }

  ctx.drawImage(img, 0, 0, width, height);

  // 5. Generate compressed base64
  const base64 = canvas.toDataURL(outputType, quality);

  // 6. Generate compressed Blob & File
  const blob = await new Promise((resolve) => {
    canvas.toBlob(
      (b) => {
        resolve(b);
      },
      outputType,
      quality
    );
  });

  const fileName =
    input instanceof File && input.name
      ? input.name.replace(/\.[^/.]+$/, '') + '.jpg'
      : 'compressed_image.jpg';

  const file = new File([blob || new Blob([])], fileName, {
    type: outputType,
    lastModified: Date.now()
  });

  return {
    base64,
    file,
    blob: blob || new Blob([]),
    width,
    height
  };
}

/**
 * Helper to compress and return just the base64 string.
 */
export async function compressImageToBase64(input, options = {}) {
  const result = await compressImage(input, options);
  return result.base64;
}

/**
 * Helper to compress and return a File object.
 */
export async function compressImageToFile(input, options = {}) {
  const result = await compressImage(input, options);
  return result.file;
}
