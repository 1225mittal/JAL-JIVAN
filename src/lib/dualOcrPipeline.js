/**
 * Direct Multimodal OCR Pipeline for Indian GST Purchase Invoices
 * Exclusively powered by Groq Vision LPU OCR (llama-3.2-11b-vision-preview)
 * Re-exports from groqVisionOcr.js for backward compatibility
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
