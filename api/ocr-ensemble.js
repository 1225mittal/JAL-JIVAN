/**
 * Backend Vision OCR Route for Indian GST B2B Wholesale / FMCG Tax Invoices
 * Exclusively powered by Groq Vision LPU OCR (llama-3.2-11b-vision-preview)
 */

import {
  GROQ_VISION_PROMPT,
  callGroqVision,
  safeParseJsonResponse,
  normalizeParsedInvoice
} from '../src/lib/groqVisionOcr.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const groqApiKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY || req.body?.groqApiKey;

  try {
    const { imageBase64, imageUrl, mimeType = 'image/jpeg' } = req.body || {};
    const rawSource = imageBase64 || imageUrl;
    if (!rawSource) {
      return res.status(400).json({ error: 'Missing imageBase64 or imageUrl in request body.' });
    }

    let cleanImage = rawSource;
    let base64Only = '';

    if (cleanImage.startsWith('data:')) {
      base64Only = cleanImage.split(',')[1] || '';
    } else if (cleanImage.startsWith('http://') || cleanImage.startsWith('https://')) {
      try {
        const fetchRes = await fetch(cleanImage);
        if (fetchRes.ok) {
          const arrayBuf = await fetchRes.arrayBuffer();
          base64Only = Buffer.from(arrayBuf).toString('base64');
          const contentType = fetchRes.headers.get('content-type') || mimeType;
          cleanImage = `data:${contentType};base64,${base64Only}`;
        }
      } catch (urlFetchErr) {
        console.warn('Notice: Remote image URL could not be pre-fetched:', urlFetchErr.message);
      }
    } else {
      base64Only = cleanImage;
      cleanImage = `data:${mimeType};base64,${cleanImage}`;
    }

    // Demo preview if Groq API key is not configured
    if (!groqApiKey) {
      console.warn('GROQ_API_KEY not configured. Returning demo Indian B2B FMCG invoice.');
      const demoResult = normalizeParsedInvoice({
        vendor_name: 'RUDRAKSH AGENCIES',
        vendor_gstin: '09BASPG6346Q1ZQ',
        invoice_no: 'T000820',
        invoice_date: '2026-08-04',
        grand_total: 5895.00,
        items: [
          {
            sn: 1,
            item_name: 'SHAHI PANEER MASALA 100G',
            hsn: '09109100',
            qty: 48,
            unit: 'PCS',
            mrp: 50.00,
            rate: 36.43,
            discount_pct: 0,
            cgst_pct: 2.5,
            sgst_pct: 2.5,
            gst_pct: 5
          },
          {
            sn: 2,
            item_name: 'CHANA MASALA 100G',
            hsn: '09109100',
            qty: 36,
            unit: 'PCS',
            mrp: 65.00,
            rate: 48.20,
            discount_pct: 0,
            cgst_pct: 2.5,
            sgst_pct: 2.5,
            gst_pct: 5
          },
          {
            sn: 3,
            item_name: 'KASURI METHI 50G BOX',
            hsn: '12119099',
            qty: 60,
            unit: 'BOX',
            mrp: 45.00,
            rate: 34.00,
            discount_pct: 0,
            cgst_pct: 2.5,
            sgst_pct: 2.5,
            gst_pct: 5
          },
          {
            sn: 4,
            item_name: 'GARAM MASALA 100G',
            hsn: '09109100',
            qty: 4,
            unit: 'PCS',
            mrp: 70.00,
            rate: 51.10,
            discount_pct: 0,
            cgst_pct: 2.5,
            sgst_pct: 2.5,
            gst_pct: 5
          }
        ]
      });
      demoResult._is_demo_preview = true;
      return res.status(200).json(demoResult);
    }

    // Direct extraction via Groq Vision LPU exclusively
    const result = await callGroqVision(cleanImage, {
      apiKey: groqApiKey,
      mimeType
    });

    if (result && Array.isArray(result.items)) {
      return res.status(200).json(result);
    }

    return res.status(502).json({
      error: 'Groq Vision OCR extraction failed to parse line items.'
    });
  } catch (err) {
    console.error('Groq OCR route error:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error during Groq OCR processing' });
  }
}
