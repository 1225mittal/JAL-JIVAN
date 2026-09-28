/**
 * Direct Multimodal OCR Extraction (Google Gemini Vision Primary & Groq Vision)
 * Re-exports clean, robust extraction methods from dualOcrPipeline.js
 */

export {
  INDIAN_GST_OCR_PROMPT,
  callGeminiVision,
  callGroqVision,
  processBill,
  runDualOcrPipeline,
  safeParseJsonResponse,
  normalizeParsedInvoice,
  reconcileOcrOutputs,
  reconcileOrFallback,
  isBuyerPattern,
  cleanVendorName,
  isValidGstin,
  sanitizeItemHsnAndBarcode
} from './dualOcrPipeline.js';

import dualOcrPipeline from './dualOcrPipeline.js';
export default dualOcrPipeline;
