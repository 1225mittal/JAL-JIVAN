/**
 * Direct Multimodal OCR Pipeline for Indian GST Purchase Invoices
 * Primary Engine: Google Gemini Vision directly (gemini-2.5-flash)
 * Fallback: Groq Vision (qwen/qwen3.8-27b)
 */

export const INDIAN_GST_OCR_PROMPT = `Extract all line items and header details from this Indian GST purchase invoice.
Return ONLY valid JSON matching this schema:
{
  "vendor_name": "string",
  "gstin": "string",
  "invoice_no": "string",
  "invoice_date": "YYYY-MM-DD",
  "vendor_grand_total": 0,
  "items": [
    {
      "name": "full product name",
      "hsn": "HSN/SAC code",
      "qty": 0,
      "unit": "PCS/NOS/BOX",
      "mrp": 0,
      "rate": 0,
      "discount_pct": 0,
      "gst_pct": 0,
      "cgst_pct": 0,
      "sgst_pct": 0,
      "igst_pct": 0
    }
  ]
}

RULES:
- Extract EVERY row sequentially from row 1 to the final row above the tax totals. Do not truncate.
- For each row, read the discount percentage from 'Disc. %' or 'Disc' column as \`discount_pct\`. If none, 0.
- GST EXTRACTION LOGIC:
  * NEVER default to 18% unless 18% is explicitly printed on that exact item row.
  * Read split tax columns and sum them: Total GST% = CGST% + SGST% (e.g. 2.5% + 2.5% = 5%, 6% + 6% = 12%, 9% + 9% = 18%, 14% + 14% = 28%).
  * If interstate IGST% is printed (e.g. 5%, 12%, 18%), use that exact rate for \`gst_pct\` and \`igst_pct\`.
  * If zero tax or exempted, set \`gst_pct\` to 0.
- Do NOT calculate line totals or taxes in the JSON (the client will compute them).`;

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
  const gstin = (data.gstin || data.vendor_gstin || data.seller?.gst || '').toUpperCase().trim();
  let invoiceNo = (data.invoice_no || data.invoice?.invoice_number || '').toString().trim();
  if (invoiceNo) invoiceNo = invoiceNo.replace(/\s+/g, '');
  const invoiceDate = normalizeIndianDate(data.invoice_date || data.invoice?.invoice_date || '');
  const vendorGrandTotal = Number(data.vendor_grand_total ?? data.grand_total ?? data.totals?.grand_total ?? 0) || 0;

  const rawItems = Array.isArray(data.items) ? data.items : [];
  const normalizedItems = rawItems.map((it, idx) => {
    const rawSn = Number(it.sn);
    const sn = (!isNaN(rawSn) && rawSn > 0) ? rawSn : (idx + 1);
    const name = (it.name || it.item_name || it.description || `Item ${sn}`).toString().trim();
    const rawHsn = (it.hsn ?? it.hsn_code ?? '').toString().trim();
    const qty = Math.max(1, Number(it.qty ?? it.quantity) || 1);
    const unit = (it.unit || 'PCS').toString().toUpperCase().trim();
    const rate = Math.max(0, Number(it.rate ?? it.purchase_price ?? it.price_before_gst) || 0);
    const mrp = Number(it.mrp) || +(rate * 1.25).toFixed(2);
    const discPct = Number(it.discount_pct || 0);

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
    invoice_no: invoiceNo,
    invoice_date: invoiceDate,
    vendor_grand_total: vendorGrandTotal,
    grand_total: vendorGrandTotal,
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
      grand_total: vendorGrandTotal
    }
  };
}

/**
 * Direct Multimodal Extraction using Google Gemini Vision (gemini-2.5-flash)
 */
export async function callGeminiVision(imageBase64, { apiKey = '', mimeType = 'image/jpeg' } = {}) {
  const effectiveKey = apiKey
    || (typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY || process.env?.VITE_GEMINI_API_KEY : '')
    || (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_GEMINI_API_KEY : '');

  if (!effectiveKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const base64Only = imageBase64.startsWith('data:')
    ? imageBase64.split(',')[1]
    : imageBase64;

  const models = ['gemini-2.5-flash', 'gemini-1.5-flash'];
  let lastError = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${effectiveKey}`;
      const payload = {
        contents: [
          {
            parts: [
              { text: `${INDIAN_GST_OCR_PROMPT}\n\nIMPORTANT: Return ONLY valid JSON without markdown formatting or code blocks.` },
              {
                inline_data: {
                  mime_type: mimeType || 'image/jpeg',
                  data: base64Only
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
          maxOutputTokens: 8192
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
        console.warn(lastError.message);
        continue;
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error(`Gemini ${model} returned an empty response`);
      }

      return safeParseJsonResponse(text);
    } catch (err) {
      lastError = err;
      console.warn(`Gemini ${model} extraction failed:`, err.message || err);
    }
  }

  throw lastError || new Error('Gemini Vision extraction failed on all flash models.');
}

/**
 * Fallback Multimodal Extraction using Groq Vision (qwen/qwen3.8-27b)
 */
export async function callGroqVision(imageBase64, { apiKey = '', mimeType = 'image/jpeg' } = {}) {
  const effectiveKey = apiKey
    || (typeof process !== 'undefined' ? process.env?.GROQ_API_KEY || process.env?.VITE_GROQ_API_KEY : '')
    || (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_GROQ_API_KEY : '');

  if (!effectiveKey) {
    throw new Error('GROQ_API_KEY is not configured');
  }

  const cleanImage = imageBase64.startsWith('data:')
    ? imageBase64
    : `data:${mimeType || 'image/jpeg'};base64,${imageBase64}`;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${effectiveKey}`
    },
    body: JSON.stringify({
      model: 'qwen/qwen3.8-27b',
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
      max_tokens: 8192
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

  return safeParseJsonResponse(content);
}

/**
 * Main OCR entry point:
 * Uses Google Gemini Vision directly (gemini-2.5-flash).
 * If backend endpoint is available, calls it; otherwise direct client execution.
 */
export async function processBill(imageBase64, options = {}) {
  // 1. First attempt backend route /api/ocr-ensemble or /api/purchase-ocr if in browser
  if (typeof window !== 'undefined' && !options.useDirectClient) {
    try {
      const endpoint = '/api/ocr-ensemble';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          mimeType: options.mimeType || 'image/jpeg',
          geminiApiKey: options.geminiApiKey || options.apiKey,
          groqApiKey: options.groqApiKey
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result && (Array.isArray(result.items) || result.vendor_name || result.invoice_no)) {
          return normalizeParsedInvoice(result);
        }
      }
    } catch (apiErr) {
      console.warn('Backend OCR route unavailable, proceeding with direct client Gemini Vision:', apiErr.message);
    }
  }

  // 2. Direct Multimodal Extraction: Primary Engine Google Gemini Vision
  try {
    return await callGeminiVision(imageBase64, options);
  } catch (geminiErr) {
    console.warn('Primary Gemini Vision extraction error, checking for Groq Vision fallback:', geminiErr.message);
    const groqKey = options.groqApiKey
      || (typeof process !== 'undefined' ? process.env?.GROQ_API_KEY || process.env?.VITE_GROQ_API_KEY : '')
      || (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_GROQ_API_KEY : '');

    if (groqKey) {
      console.log('Falling back to Groq Vision...');
      return await callGroqVision(imageBase64, { ...options, apiKey: groqKey });
    }

    throw geminiErr;
  }
}

/**
 * Backward compatibility alias for runDualOcrPipeline
 */
export async function runDualOcrPipeline(imageBase64, options = {}) {
  return processBill(imageBase64, options);
}

/**
 * Backward compatibility stub for reconcileOcrOutputs
 */
export function reconcileOcrOutputs(geminiResult, groqResult) {
  if (geminiResult && Array.isArray(geminiResult.items) && geminiResult.items.length > 0) {
    return normalizeParsedInvoice(geminiResult);
  }
  if (groqResult && Array.isArray(groqResult.items) && groqResult.items.length > 0) {
    return normalizeParsedInvoice(groqResult);
  }
  return normalizeParsedInvoice(geminiResult || groqResult || { items: [] });
}

/**
 * Backward compatibility alias for reconcileOrFallback
 */
export function reconcileOrFallback(geminiData, groqData) {
  return reconcileOcrOutputs(geminiData, groqData);
}

export default {
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
};
