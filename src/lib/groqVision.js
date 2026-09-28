/**
 * Direct Groq Vision OCR Extraction
 * Re-exports clean, robust extraction methods from groqVisionOcr.js
 */

export {
  GROQ_VISION_PROMPT,
  GROQ_VISION_PROMPT as INDIAN_GST_OCR_PROMPT,
  callGroqVision,
  callGeminiVision,
  processBill,
  runDualOcrPipeline,
  safeParseJsonResponse,
  normalizeParsedInvoice,
  reconcileOcrOutputs,
  reconcileOrFallback,
  isBuyerPattern,
  cleanVendorName,
  isValidGstin,
  sanitizeItemHsnAndBarcode,
  normalizeIndianDate
} from './groqVisionOcr.js';

import groqVisionOcr from './groqVisionOcr.js';
export default groqVisionOcr;
