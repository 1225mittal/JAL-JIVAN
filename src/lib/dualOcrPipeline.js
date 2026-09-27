/**
 * Dual OCR Pipeline (Groq Vision + Google Gemini Flash)
 * Provides fault-tolerant, resilient OCR extraction for Indian GST B2B tax invoices.
 *
 * Rules:
 * 1. Groq active vision model: qwen/qwen3.8-27b
 * 2. Gemini active vision models: gemini-2.5-flash, gemini-1.5-flash
 * 3. Graceful degradation: If Groq fails, falls back purely to Gemini without crashing.
 * 4. Reconciliation: If both succeed, compares mathematical consistency & completeness.
 */

import { sanitizeIndianInvoiceOcr } from './groqOcr.js';

export const INDIAN_GST_OCR_PROMPT = `You are an expert Indian GST B2B tax invoice and FMCG purchase bill OCR specialist with deep expertise in reading dense dot-matrix computer printouts, thermal bills, and multi-tier tax invoices.

Extract all data from this Indian purchase bill / tax invoice image with extreme numerical precision according to these STRICT DOMAIN RULES:

1. SUPPLIER (SELLER) vs. BUYER (RECIPIENT) DISAMBIGUATION:
   - Identify the Supplier (Seller):
     * The Supplier is ALWAYS the issuing agency, distributor, or company printed at the very TOP / HEADER (e.g., "RUDRAKSH AGENCIES").
     * The Supplier's GSTIN (15-character alphanumeric, e.g. "09BASPG6346Q1ZQ"), address, and phone numbers are located at the top banner or agency letterhead.
     * Extract: "vendor_name", "vendor_gstin", "vendor_address", "vendor_phone".
   - Identify the Billed-To Party (Buyer/Retailer):
     * The entity listed under "M/s", "Billed To", "Customer", "Buyer", "Recipient", "Party Name", "Consignee", or "Ship To" (e.g., "MITTAL DEPARTMENTAL STORE") is the BUYER, NEVER the seller.
     * CRITICAL: Do NOT extract the buyer's name, GSTIN, or address into the vendor/seller fields!

2. ROW-BY-ROW TABULAR ALIGNMENT (DOT-MATRIX / TABULAR INVOICES):
   - Indian FMCG invoices often use dense dot-matrix tables. Read line items STRICTLY row by horizontal row.
   - Anchor each line item using the Serial Number (SN: 1, 2, 3... 14):
     * Do NOT skip any rows or merge adjacent rows.
     * Match each item's name, quantity, MRP, rate, and taxable amount along the exact same horizontal baseline.
   - Handwritten corrections: If a line has a hand-written strike-through or pen note (e.g., blue ink revising qty or rate), extract the legible line data or respect the pen revision.

3. HSN vs. BARCODE STRICT SEPARATION:
   - Do NOT map the 4-to-8 digit HSN/SAC code (e.g. "09109100", "2201", "1905") into the "barcode" field! Set "hsn": "09109100".
   - Leave "barcode" as an empty string "" unless an explicit 12-to-13 digit retail barcode (EAN-13, starting with 890... in India) is printed on the bill.

4. DATE & BILL NUMBER FORMATTING:
   - Dates on Indian bills are formatted as DD/MM/YYYY (e.g., "04/08/2026" is 4th August 2026, NOT 8th April). Parse into standard ISO "YYYY-MM-DD" (e.g., "2026-08-04").
   - Distinguish letters from numbers in Bill Numbers (e.g., uppercase "T000820", not "10006320" or "T00082O").

5. LINE ITEM & INVOICE LEVEL DISCOUNT HANDLING:
   - Extract cash discounts or trade discounts (e.g., "Discount 2%", "Cash Disc", "Trade Disc"):
     * Include "discount_pct": number and "discount_amount": number.
     * Deduct discount from taxable base before computing SGST, CGST, and Roundoff.

6. REQUIRED JSON OUTPUT SCHEMA:
Return ONLY a valid JSON object matching EXACTLY this structure with no markdown or additional text:
{
  "vendor_name": "RUDRAKSH AGENCIES",
  "vendor_gstin": "09BASPG6346Q1ZQ",
  "vendor_address": "SHOP NO C 939, NAND GRAM, GHAZIABAD",
  "vendor_phone": "8882030921",
  "invoice_no": "T000820",
  "invoice_date": "2026-08-04",
  "discount_amount": 114.54,
  "round_off": 0.47,
  "grand_total": 5895.00,
  "items": [
    {
      "sn": 1,
      "item_name": "SHAHI PANNER MASALA",
      "hsn": "09109100",
      "barcode": "",
      "qty": 48,
      "unit": "PCS",
      "mrp": 50.00,
      "rate": 36.43,
      "taxable_amount": 1748.64,
      "gst_pct": 5,
      "cgst_pct": 2.5,
      "cgst_amount": 43.72,
      "sgst_pct": 2.5,
      "sgst_amount": 43.72,
      "cess_amount": 0
    }
  ]
}`;

/**
 * Call Groq Vision using official active model: qwen/qwen3.8-27b
 */
export async function callGroqVision(imageBase64, { apiKey = '', mimeType = 'image/jpeg' } = {}) {
  const effectiveKey = apiKey || (typeof process !== 'undefined' ? process.env?.GROQ_API_KEY || process.env?.VITE_GROQ_API_KEY : '') || (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_GROQ_API_KEY : '');
  if (!effectiveKey) {
    throw new Error('GROQ_API_KEY is not configured');
  }

  const cleanImage = imageBase64.startsWith('data:')
    ? imageBase64
    : `data:${mimeType};base64,${imageBase64}`;

  // Official active Groq vision model
  const activeModel = 'qwen/qwen3.8-27b';

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${effectiveKey}`
    },
    body: JSON.stringify({
      model: activeModel,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: INDIAN_GST_OCR_PROMPT },
            { type: 'image_url', image_url: { url: cleanImage } }
          ]
        }
      ],
      temperature: 0.1,
      max_tokens: 3000
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq Vision Error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Groq Vision returned an empty response.');
  }

  const cleanJson = content.replace(/```json/g, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(cleanJson);
  return sanitizeIndianInvoiceOcr(parsed);
}

/**
 * Call Gemini Vision using active models: gemini-2.5-flash or gemini-1.5-flash
 */
export async function callGeminiVision(imageBase64, { apiKey = '', mimeType = 'image/jpeg' } = {}) {
  const effectiveKey = apiKey || (typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY || process.env?.VITE_GEMINI_API_KEY : '') || (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_GEMINI_API_KEY : '');
  if (!effectiveKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const base64Only = imageBase64.startsWith('data:')
    ? imageBase64.split(',')[1]
    : imageBase64;

  const geminiModels = ['gemini-2.5-flash', 'gemini-1.5-flash'];
  let lastError = null;

  for (const model of geminiModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${effectiveKey}`;
      const payload = {
        contents: [
          {
            parts: [
              { text: `${INDIAN_GST_OCR_PROMPT}\n\nIMPORTANT: Return ONLY a valid raw JSON object without markdown formatting.` },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Only
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json'
        }
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errText = await response.text();
        lastError = new Error(`Gemini ${model} Error (${response.status}): ${errText}`);
        continue;
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        return sanitizeIndianInvoiceOcr(parsed);
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Gemini Vision extraction failed on all flash models.');
}

/**
 * Reconcile between Gemini & Groq data, picking the best mathematical & structural match.
 */
export function reconcileOrFallback(geminiData, groqData) {
  // If neither succeeded
  if (!geminiData && !groqData) {
    throw new Error('Both Groq and Gemini OCR extraction failed. Please review image quality or enter details manually.');
  }

  // If only Gemini succeeded
  if (geminiData && !groqData) {
    return { ...geminiData, _ocr_source: 'gemini' };
  }

  // If only Groq succeeded
  if (!geminiData && groqData) {
    return { ...groqData, _ocr_source: 'groq' };
  }

  // Both succeeded: Reconcile and select the one with best mathematical accuracy & line items count
  const evalModel = (data) => {
    let score = 0;
    const items = Array.isArray(data?.items) ? data.items : [];
    const grandTotal = Number(data?.grand_total || data?.totals?.grand_total) || 0;

    // Line totals sum
    let calculatedLineSum = 0;
    items.forEach((it) => {
      calculatedLineSum += Number(it.total_amount ?? it.price_after_gst) || 0;
    });

    const mathDiff = Math.abs(calculatedLineSum - grandTotal);
    // Lower mathDiff is better; give up to 50 points for exact match
    if (mathDiff < 0.05) score += 50;
    else if (mathDiff < 1.05) score += 40;
    else if (mathDiff < 5.0) score += 20;

    // More items extracted along horizontal baseline (up to 30 points)
    score += Math.min(items.length * 3, 30);

    // Vendor GSTIN present and valid 15-char format (10 points)
    if (data?.vendor_gstin && data.vendor_gstin.length === 15) score += 10;

    // Invoice number present (10 points)
    if (data?.invoice_no) score += 10;

    return { score, mathDiff, itemsCount: items.length };
  };

  const geminiEval = evalModel(geminiData);
  const groqEval = evalModel(groqData);

  const winner = groqEval.score >= geminiEval.score ? { ...groqData, _ocr_source: 'groq' } : { ...geminiData, _ocr_source: 'gemini' };
  const secondary = groqEval.score >= geminiEval.score ? geminiData : groqData;

  // Cross-pollinate missing fields from secondary model if winner missed them
  if (!winner.vendor_gstin && secondary?.vendor_gstin) {
    winner.vendor_gstin = secondary.vendor_gstin;
    if (winner.seller) winner.seller.gst = secondary.vendor_gstin;
  }
  if (!winner.vendor_phone && secondary?.vendor_phone) {
    winner.vendor_phone = secondary.vendor_phone;
    if (winner.seller) winner.seller.contact = secondary.vendor_phone;
  }
  if (!winner.vendor_address && secondary?.vendor_address) {
    winner.vendor_address = secondary.vendor_address;
    if (winner.seller) winner.seller.address = secondary.vendor_address;
  }
  if (!winner.invoice_no && secondary?.invoice_no) {
    winner.invoice_no = secondary.invoice_no;
    if (winner.invoice) winner.invoice.invoice_number = secondary.invoice_no;
  }

  return winner;
}

/**
 * Run Dual OCR Pipeline with graceful fallback
 */
export async function runDualOcrPipeline(imageBase64, options = {}) {
  let groqData = null;
  try {
    groqData = await callGroqVision(imageBase64, options);
  } catch (err) {
    console.warn('Groq OCR failed, falling back purely to Gemini:', err);
  }

  let geminiData = null;
  try {
    geminiData = await callGeminiVision(imageBase64, options);
  } catch (err) {
    console.warn('Gemini OCR failed:', err);
  }

  // If both succeed, reconcile and pick the best math match.
  // If only Gemini succeeds, use Gemini directly.
  // If only Groq succeeds, use Groq directly.
  const finalResult = reconcileOrFallback(geminiData, groqData);
  return finalResult;
}

export default {
  INDIAN_GST_OCR_PROMPT,
  callGroqVision,
  callGeminiVision,
  reconcileOrFallback,
  runDualOcrPipeline
};
