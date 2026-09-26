import * as pdfjsLib from 'pdfjs-dist';

// Ensure worker is configured for browser usage
if (typeof window !== 'undefined') {
  try {
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      // Use standard CDN matching the pdf.js build version
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.0.379'}/pdf.worker.min.mjs`;
    }
  } catch (e) {
    console.warn('PDF.js worker setup note:', e);
  }
}

/**
 * Renders the first page of a PDF file to a high-resolution JPEG Data URL
 * @param {File|Blob|ArrayBuffer} pdfInput 
 * @param {number} scale Default 2.0 for crisp OCR text recognition
 * @returns {Promise<{ dataUrl: string, base64: string, width: number, height: number }>}
 */
export async function renderPdfFirstPageToImage(pdfInput, scale = 2.0) {
  let arrayBuffer;
  if (pdfInput instanceof ArrayBuffer) {
    arrayBuffer = pdfInput;
  } else if (pdfInput instanceof Blob || (typeof File !== 'undefined' && pdfInput instanceof File)) {
    arrayBuffer = await pdfInput.arrayBuffer();
  } else {
    throw new Error('Unsupported PDF input type. Must be File, Blob, or ArrayBuffer.');
  }

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/cmaps/',
    cMapPacked: true
  });

  const pdfDoc = await loadingTask.promise;
  const page = await pdfDoc.getPage(1);

  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  // Fill with white background
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);

  const renderContext = {
    canvasContext: context,
    viewport: viewport
  };

  await page.render(renderContext).promise;

  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  const base64 = dataUrl.replace(/^data:image\/[a-z]+;base64,/, '');

  return {
    dataUrl,
    base64,
    width: canvas.width,
    height: canvas.height
  };
}
