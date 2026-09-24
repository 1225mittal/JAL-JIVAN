const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

/**
 * Extract product name, brand, MRP, batch no, and dates from dual package photos (Front and/or Back)
 * using Groq Vision OCR.
 */
export async function extractPackageDetails({ frontFile, backFile, frontBase64, backBase64 }) {
  if (!frontFile && !backFile && !frontBase64 && !backBase64) {
    throw new Error('Please take or upload at least one photo (Front or Back) of the product.');
  }

  try {
    let finalFrontBase64 = frontBase64 || null;
    let finalBackBase64 = backBase64 || null;

    if (frontFile && !finalFrontBase64) {
      finalFrontBase64 = await fileToBase64(frontFile);
    }
    if (backFile && !finalBackBase64) {
      finalBackBase64 = await fileToBase64(backFile);
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
