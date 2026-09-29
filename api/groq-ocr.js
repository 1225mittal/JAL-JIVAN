/**
 * Serverless Backend Endpoint: /api/groq-ocr
 * Directly processes Indian B2B FMCG Tax Invoices via Groq Multimodal Vision LPU
 * Private key read exclusively from process.env.GROQ_API_KEY
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

function cleanVendorName(name) {
  if (!name) return '';
  let cleaned = name.toString().trim();
  cleaned = cleaned.replace(/^(M\/s\.?|Billed\s*To:?|Buyer:?|Customer:?|Party\s*Name:?|Recipient:?|Consignee:?|Ship\s*To:?)\s*/i, '').trim();
  if (cleaned.includes('\n')) {
    cleaned = cleaned.split('\n').map((l) => l.trim()).filter(Boolean)[0] || cleaned;
  }
  return cleaned;
}

function normalizeIndianDate(dateStr) {
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

function sanitizeItemHsnAndBarcode(rawHsn, rawBarcode) {
  let hsn = (rawHsn || '').toString().trim();
  let barcode = (rawBarcode || '').toString().trim();

  if (barcode && /^\d{4,8}$/.test(barcode)) {
    if (!hsn || hsn === barcode) {
      hsn = barcode;
    }
    barcode = '';
  }

  if (barcode && (!/^\d{12,14}$/.test(barcode) || barcode === hsn)) {
    barcode = '';
  }

  return { hsn, barcode };
}

function safeParseJsonResponse(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return { items: [] };
  }

  let cleaned = rawText.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    try {
      const sanitized = cleaned.replace(/,\s*([\]}])/g, '$1');
      return JSON.parse(sanitized);
    } catch {
      return { items: [] };
    }
  }
}

function normalizeInvoice(parsed) {
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'GROQ_API_KEY is not configured in backend environment variables.'
    });
  }

  try {
    const { imageBase64, image, imageUrl, dataUrl, mimeType = 'image/jpeg' } = req.body || {};
    const rawSource = imageBase64 || image || dataUrl || imageUrl;
    if (!rawSource) {
      return res.status(400).json({ error: 'Missing imageBase64 or image in request body.' });
    }

    let cleanImage = rawSource;
    if (cleanImage.startsWith('data:')) {
      // already a data URL
    } else if (cleanImage.startsWith('http://') || cleanImage.startsWith('https://')) {
      try {
        const fetchRes = await fetch(cleanImage);
        if (fetchRes.ok) {
          const arrayBuf = await fetchRes.arrayBuffer();
          const base64Only = Buffer.from(arrayBuf).toString('base64');
          const contentType = fetchRes.headers.get('content-type') || mimeType;
          cleanImage = `data:${contentType};base64,${base64Only}`;
        }
      } catch (urlFetchErr) {
        console.warn('Notice: Remote image URL could not be pre-fetched:', urlFetchErr.message);
      }
    } else {
      cleanImage = `data:${mimeType};base64,${cleanImage}`;
    }

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
            'Authorization': `Bearer ${apiKey}`
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
          lastError = new Error(`Groq Vision (${model}) [${response.status}]: ${errText}`);
          console.warn(lastError.message);
          continue;
        }

        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content;
        if (!content) {
          throw new Error(`Groq Vision (${model}) returned an empty content body.`);
        }

        const rawJson = safeParseJsonResponse(content);
        const normalized = normalizeInvoice(rawJson);
        return res.status(200).json(normalized);
      } catch (err) {
        lastError = err;
        console.warn(`Groq Vision ${model} attempt failed:`, err.message || err);
      }
    }

    return res.status(502).json({
      error: lastError?.message || 'Groq Vision OCR extraction failed across all models.'
    });
  } catch (err) {
    console.error('Groq OCR endpoint error:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error during Groq Vision OCR' });
  }
}
