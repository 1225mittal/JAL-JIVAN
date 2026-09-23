const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

export async function extractOrderFromSlip(file) {
  if (!file) {
    throw new Error('No image file provided for OCR extraction.');
  }

  try {
    const base64Data = await fileToBase64(file);

    const response = await fetch('/api/gemini-ocr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageBase64: base64Data,
        mimeType: file.type || 'image/jpeg',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server returned error status ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('OCR Extraction Failed:', error);
    throw error;
  }
}
