import { compressImage } from './imageCompressor';

/**
 * Extract product name, brand, MRP, batch no, and dates from dual package photos (Front and/or Back)
 * using Groq Vision OCR.
 * Automatically compresses images to 1280px / 0.75 JPEG to prevent 413 Payload Too Large errors.
 */
export async function extractPackageDetails({ frontFile, backFile, frontBase64, backBase64 }) {
  if (!frontFile && !backFile && !frontBase64 && !backBase64) {
    throw new Error('Please take or upload at least one photo (Front or Back) of the product.');
  }

  try {
    let finalFrontBase64 = null;
    let finalBackBase64 = null;

    if (frontFile || frontBase64) {
      const compressed = await compressImage(frontFile || frontBase64, {
        maxDimension: 1280,
        quality: 0.75,
        outputType: 'image/jpeg'
      });
      finalFrontBase64 = compressed.base64;
    }

    if (backFile || backBase64) {
      const compressed = await compressImage(backFile || backBase64, {
        maxDimension: 1280,
        quality: 0.75,
        outputType: 'image/jpeg'
      });
      finalBackBase64 = compressed.base64;
    }

    const response = await fetch('/api/damage-ocr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        frontImageBase64: finalFrontBase64,
        backImageBase64: finalBackBase64
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `OCR server error (${response.status})`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Package OCR error:', error);
    throw error;
  }
}
