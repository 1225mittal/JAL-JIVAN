/**
 * Groq Vision LPU OCR Service for Indian B2B FMCG Purchase Invoices
 * Exclusively uses Groq Multimodal Vision (llama-3.2-11b-vision-preview)
 * Pure raw printed data extraction into JSON; zero client-side arithmetic hallucination
 */

export const GROQ_VISION_PROMPT = `You are an expert Indian B2B FMCG tax invoice digitizer. 
Extract ONLY the raw printed data into JSON. DO NOT perform arithmetic calculations.

CRITICAL EXTRACTION RULES:
1. SELLER vs BUYER:
   - VENDOR/SELLER: Extract agency/distributor at top header (Name, GSTIN, Address, Phone).
   - BUYER: Ignore recipient name (e.g. 'Mittal Departmental Store', 'Billed To', 'Consignee').
2. ITEM EXTRACTION:
   - Extract all rows sequentially: \`name\`, \`hsn\`, \`qty\`, \`unit\` (PCS, KG, PACK, etc.), \`mrp\`, \`rate\` (wholesale purchase rate), \`discount_pct\` (or discount_amt).
   - TAX RATE: Look at the CGST and SGST columns. If CGST is 2.5% and SGST is 2.5%, set \`gst_pct: 5\`. If 6% + 6%, set \`gst_pct: 12\`. If 9% + 9%, set \`gst_pct: 18\`. If 14% + 14%, set \`gst_pct: 28\`. DO NOT default to 18%.
   - Put 4-8 digit tax codes strictly into \`hsn\`. Leave \`barcode\` empty unless an explicit 12-13 digit EAN barcode is printed.
3. TOTALS:
   - Extract printed \`invoice_no\`, \`invoice_date\` (YYYY-MM-DD), \`discount_total\`, \`round_off\`, and printed \`grand_total\`.

Return pure JSON:
{
  "vendor_name": "",
  "vendor_gstin": "",
  "vendor_phone": "",
  "vendor_address": "",
  "invoice_no": "",
  "invoice_date": "",
  "grand_total": 0.00,
  "discount_total": 0.00,
  "round_off": 0.00,
  "items": [
    { "sn": 1, "item_name": "", "hsn": "", "barcode": "", "qty": 1, "unit": "PCS", "mrp": 0.00, "rate": 0.00, "discount_pct": 0, "gst_pct": 5 }
  ]
}`;

/**
 * Standardize Indian DD/MM/YYYY date strings into ISO YYYY-MM-DD
 */
export function normalizeIndianDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return '';
  const trimmed = dateStr.trim();
  const ddmmyyyy = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (ddmmyyyy) {
    const day = ddmmyyyy[1].padStart(2, '0');
    const month = ddmmyyyy[2].padStart(2, '0');
    const year = ddmmyyyy[3];
    return `${year}-${month}-${day}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  return trimmed;
}

/**
 * Clean vendor name by stripping residual buyer/billed-to prefixes
 */
export function cleanVendorName(name) {
  if (!name) return '';
  let cleaned = name.toString().trim();
  cleaned = cleaned.replace(/^(M\/s\.?|Billed\s*To:?|Buyer:?|Customer:?|Party\s*Name:?|Recipient:?|Consignee:?|Ship\s*To:?)\s*/i, '').trim();
  if (cleaned.includes('\n')) {
    cleaned = cleaned.split('\n').map((l) => l.trim()).filter(Boolean)[0] || cleaned;
  }
  return cleaned;
}

/**
 * Check if a name matches customer/buyer patterns
 */
export function isBuyerPattern(name) {
  if (!name || typeof name !== 'string') return false;
  const upper = name.toUpperCase().trim();
  if (/^(M\/S\.?|BILLED\s*TO:?|BUYER:?|CUSTOMER:?|RECIPIENT:?|CONSIGNEE:?|PARTY\s*NAME:?|SHIP\s*TO:?)/i.test(upper)) {
    return true;
  }
  if (upper.includes('MITTAL DEPARTMENTAL') || upper.includes('MITTAL STORE') || upper.includes('DEPARTMENTAL STORE')) {
    return true;
  }
  return false;
}

/**
 * Validate standard 15-character Indian GSTIN format
 */
export function isValidGstin(gstin) {
  if (!gstin || typeof gstin !== 'string') return false;
  const clean = gstin.trim().toUpperCase();
  if (clean.length !== 15) return false;
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(clean);
}

/**
 * Separate 4-8 digit HSN from 12-14 digit retail barcode
 */
export function sanitizeItemHsnAndBarcode(rawHsn, rawBarcode) {
  let hsn = (rawHsn || '').toString().trim();
  let barcode = (rawBarcode || '').toString().trim();

  // If barcode looks like an HSN (4-8 digits) and no HSN or matches HSN
  if (barcode && /^\d{4,8}$/.test(barcode)) {
    if (!hsn || hsn === barcode) {
      hsn = barcode;
    }
    barcode = '';
  }

  // Barcode MUST be an explicit 12-14 digit retail barcode (e.g. EAN-13 starting with 890)
  if (barcode && (!/^\d{12,14}$/.test(barcode) || barcode === hsn)) {
    barcode = '';
  }

  return { hsn, barcode };
}

/**
 * Safe JSON parsing:
 * - Strip markdown code fences if wrapped in ```json ... ```
 * - Never throw a hard error if an optional field is missing
 * - Default items: [] if null
 */
export function safeParseJsonResponse(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return normalizeParsedInvoice({ items: [] });
  }

  let cleaned = rawText.trim();
  // Strip code fences: ```json ... ``` or ``` ... ```
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  // If text contains markdown or extra content, find the outermost { ... }
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  let parsed = {};
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    console.warn('Initial JSON.parse failed, attempting to sanitize JSON string:', err.message);
    try {
      // Remove trailing commas before closing braces/brackets
      const sanitized = cleaned.replace(/,\s*([\]}])/g, '$1');
      parsed = JSON.parse(sanitized);
    } catch (e2) {
      console.error('Safe JSON parse failed:', e2.message);
      parsed = {};
    }
  }

  return normalizeParsedInvoice(parsed);
}

/**
 * Normalize parsed invoice fields into standard schema while ensuring items is an array
 */
export function normalizeParsedInvoice(parsed) {
  const data = (parsed && typeof parsed === 'object') ? parsed : {};

  const vendorName = cleanVendorName(data.vendor_name || data.seller?.name || '');
  const gstin = (data.vendor_gstin || data.gstin || data.seller?.gst || '').toUpperCase().trim();
  let invoiceNo = (data.invoice_no || data.invoice?.invoice_number || '').toString().trim();
  if (invoiceNo) invoiceNo = invoiceNo.replace(/\s+/g, '');
  const invoiceDate = normalizeIndianDate(data.invoice_date || data.invoice?.invoice_date || '');
  const vendorGrandTotal = Number(data.grand_total ?? data.vendor_grand_total ?? data.totals?.grand_total ?? 0) || 0;
  const discountTotal = Number(data.discount_total ?? data.discount_amount ?? data.totals?.discount_total ?? 0) || 0;
  const roundOff = Number(data.round_off ?? data.totals?.round_off ?? 0) || 0;

  const rawItems = Array.isArray(data.items) ? data.items : [];
  const normalizedItems = rawItems.map((it, idx) => {
    const rawSn = Number(it.sn);
    const sn = (!isNaN(rawSn) && rawSn > 0) ? rawSn : (idx + 1);
    const name = (it.item_name || it.name || it.description || `Item ${sn}`).toString().trim();
    const rawHsn = (it.hsn ?? it.hsn_code ?? '').toString().trim();
    const qty = Math.max(1, Number(it.qty ?? it.quantity) || 1);
    const unit = (it.unit || 'PCS').toString().toUpperCase().trim();
    const rate = Math.max(0, Number(it.rate ?? it.purchase_price ?? it.price_before_gst) || 0);
    const mrp = Number(it.mrp) || +(rate * 1.25).toFixed(2);
    const discPct = Number(it.discount_pct || 0);
    const discAmt = Number(it.discount_amt || it.discount_amount || 0);

    // Split tax columns & GST extraction logic (Stop defaulting to 18%)
    const cgst = Number(it.cgst_pct || it.cgst_rate || it.cgst || 0);
    const sgst = Number(it.sgst_pct || it.sgst_rate || it.sgst || 0);
    const igst = Number(it.igst_pct || it.igst_rate || it.igst || 0);
    let totalGst = Number(it.gst_pct ?? it.gst_percentage ?? it.gst_rate ?? 0);
    if (totalGst === 0 && (cgst > 0 || sgst > 0)) {
      totalGst = +(cgst + sgst).toFixed(2);
    } else if (totalGst === 0 && igst > 0) {
      totalGst = igst;
    }

    const { hsn, barcode } = sanitizeItemHsnAndBarcode(rawHsn, it.barcode);

    return {
      sn,
      name,
      item_name: name,
      hsn,
      hsn_code: hsn,
      barcode,
      qty,
      quantity: qty,
      unit,
      mrp,
      rate,
      purchase_price: rate,
      price_before_gst: rate,
      discount_pct: discPct,
      discount_amount: discAmt,
      discount_amt: discAmt,
      gst_pct: totalGst,
      gst_rate: totalGst,
      gst_percentage: totalGst,
      cgst_pct: cgst,
      sgst_pct: sgst,
      igst_pct: igst
    };
  });

  return {
    vendor_name: vendorName,
    vendor_gstin: gstin,
    gstin,
    vendor_phone: data.vendor_phone || data.seller?.contact || '',
    vendor_address: data.vendor_address || data.seller?.address || '',
    invoice_no: invoiceNo,
    invoice_date: invoiceDate,
    grand_total: vendorGrandTotal,
    vendor_grand_total: vendorGrandTotal,
    discount_total: discountTotal,
    round_off: roundOff,
    items: normalizedItems,

    // Backward-compatible nested aliases for existing UI consumers
    seller: {
      name: vendorName,
      gst: gstin,
      address: data.vendor_address || data.seller?.address || '',
      contact: data.vendor_phone || data.seller?.contact || ''
    },
    invoice: {
      invoice_number: invoiceNo,
      invoice_date: invoiceDate
    },
    totals: {
      grand_total: vendorGrandTotal,
      discount_total: discountTotal,
      round_off: roundOff
    }
  };
}

/**
 * Direct Groq Vision API Call
 * Endpoint: https://api.groq.com/openai/v1/chat/completions
 * Model: llama-3.2-11b-vision-preview (fallback to llama-3.2-90b-vision-preview / qwen/qwen3.8-27b)
 * Authorization: Bearer ${import.meta.env.VITE_GROQ_API_KEY}
 */
export async function callGroqVision(imageBase64, { apiKey = '', mimeType = 'image/jpeg' } = {}) {
  const effectiveKey = apiKey
    || (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_GROQ_API_KEY : '')
    || (typeof process !== 'undefined' ? process.env?.GROQ_API_KEY || process.env?.VITE_GROQ_API_KEY : '');

  // If no direct client API key is provided, seamlessly route through backend serverless endpoint
  if (!effectiveKey) {
    return processBill(imageBase64, { mimeType });
  }

  const cleanImage = imageBase64.startsWith('data:')
    ? imageBase64
    : `data:${mimeType || 'image/jpeg'};base64,${imageBase64}`;

  // Active Groq Vision models in order of priority
  const visionModels = [
    'llama-3.2-11b-vision-preview',
    'llama-3.2-90b-vision-preview',
    'qwen/qwen3.8-27b'
  ];

  let lastError = null;

  for (const model of visionModels) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${effectiveKey}`
        },
        body: JSON.stringify({
          model,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: GROQ_VISION_PROMPT },
                { type: 'image_url', image_url: { url: cleanImage } }
              ]
            }
          ],
          temperature: 0.1,
          max_tokens: 8192
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        lastError = new Error(`Groq Vision (${model}) Error [${response.status}]: ${errText}`);
        console.warn(lastError.message);
        continue;
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error(`Groq Vision (${model}) returned an empty content body.`);
      }

      return safeParseJsonResponse(content);
    } catch (err) {
      lastError = err;
      console.warn(`Groq Vision ${model} attempt failed:`, err.message || err);
    }
  }

  throw lastError || new Error('Groq Vision extraction failed across all vision models.');
}

/**
 * Primary Bill OCR Entry Point: Exclusively Groq Vision routed via /api/groq-ocr
 */
export async function processBill(imageBase64, options = {}) {
  const cleanImage = imageBase64.startsWith('data:')
    ? imageBase64
    : `data:${options.mimeType || 'image/jpeg'};base64,${imageBase64}`;

  // If a client API key is explicitly provided, we can call directly
  if (options.apiKey || options.useDirectClient) {
    return callGroqVision(cleanImage, options);
  }

  // Primary: Call the backend serverless endpoint /api/groq-ocr
  try {
    const response = await fetch('/api/groq-ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: cleanImage,
        mimeType: options.mimeType || 'image/jpeg'
      })
    });

    if (response.ok) {
      const result = await response.json();
      if (result && (Array.isArray(result.items) || result.vendor_name || result.invoice_no)) {
        return normalizeParsedInvoice(result);
      }
    } else {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Server OCR request failed (${response.status})`);
    }
  } catch (apiErr) {
    if (apiErr.message && !apiErr.message.includes('fetch')) {
      throw apiErr;
    }
    console.warn('/api/groq-ocr call error, checking client fallback:', apiErr.message);
    const clientKey = (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_GROQ_API_KEY : '');
    if (clientKey) {
      return callGroqVision(cleanImage, { apiKey: clientKey, mimeType: options.mimeType });
    }
    throw apiErr;
  }
}

/**
 * Backward compatibility alias for runDualOcrPipeline
 */
export async function runDualOcrPipeline(imageBase64, options = {}) {
  return processBill(imageBase64, options);
}

/**
 * Backward compatibility stubs
 */
export function callGeminiVision(imageBase64, options = {}) {
  console.warn('callGeminiVision redirecting to Groq Vision exclusively per architectural update.');
  return callGroqVision(imageBase64, options);
}

export function reconcileOcrOutputs(geminiResult, groqResult) {
  return normalizeParsedInvoice(groqResult || geminiResult || { items: [] });
}

export function reconcileOrFallback(geminiData, groqData) {
  return reconcileOcrOutputs(geminiData, groqData);
}

export default {
  GROQ_VISION_PROMPT,
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
  sanitizeItemHsnAndBarcode
};
