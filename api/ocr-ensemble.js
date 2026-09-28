/**
 * Backend Vision OCR Route for Indian GST B2B Wholesale / FMCG Tax Invoices
 * Primary Engine: Google Gemini Vision directly (gemini-2.5-flash)
 * Fallback: Groq Vision (qwen/qwen3.8-27b)
 */

import {
  INDIAN_GST_OCR_PROMPT,
  callGeminiVision,
  callGroqVision,
  safeParseJsonResponse,
  normalizeParsedInvoice
} from '../src/lib/dualOcrPipeline.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const groqApiKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY || req.body?.groqApiKey;
  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || req.body?.geminiApiKey;

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

    // Demo preview if neither API key is available
    if (!groqApiKey && !geminiApiKey) {
      console.warn('Neither GEMINI_API_KEY nor GROQ_API_KEY configured. Returning demo Indian B2B FMCG invoice.');
      const demoResult = normalizeParsedInvoice({
        vendor_name: 'RUDRAKSH AGENCIES',
        gstin: '09BASPG6346Q1ZQ',
        invoice_no: 'T000820',
        invoice_date: '2026-08-04',
        vendor_grand_total: 5895.00,
        items: [
          {
            name: 'SHAHI PANEER MASALA 100G',
            hsn: '09109100',
            qty: 48,
            unit: 'PCS',
            mrp: 50.00,
            rate: 36.43,
            discount_pct: 0
          },
          {
            name: 'CHANA MASALA 100G',
            hsn: '09109100',
            qty: 36,
            unit: 'PCS',
            mrp: 65.00,
            rate: 48.20,
            discount_pct: 0
          },
          {
            name: 'KASURI METHI 50G BOX',
            hsn: '12119099',
            qty: 60,
            unit: 'BOX',
            mrp: 45.00,
            rate: 34.00,
            discount_pct: 0
          },
          {
            name: 'GARAM MASALA 100G',
            hsn: '09109100',
            qty: 4,
            unit: 'PCS',
            mrp: 70.00,
            rate: 51.10,
            discount_pct: 0
          }
        ]
      });
      demoResult._is_demo_preview = true;
      return res.status(200).json(demoResult);
    }

    // 1. Primary Engine: Google Gemini Vision directly
    if (geminiApiKey) {
      try {
        const result = await callGeminiVision(base64Only, {
          apiKey: geminiApiKey,
          mimeType
        });
        if (result && Array.isArray(result.items)) {
          return res.status(200).json(result);
        }
      } catch (geminiErr) {
        console.warn('Backend Gemini Vision failed, attempting Groq fallback:', geminiErr.message || geminiErr);
      }
    }

    // 2. Fallback: Groq Vision
    if (groqApiKey) {
      try {
        const result = await callGroqVision(cleanImage, {
          apiKey: groqApiKey,
          mimeType
        });
        if (result && Array.isArray(result.items)) {
          return res.status(200).json(result);
        }
      } catch (groqErr) {
        console.warn('Backend Groq Vision fallback failed:', groqErr.message || groqErr);
      }
    }

    return res.status(502).json({
      error: 'Vision OCR extraction failed. Please check your image quality or API credentials.'
    });
  } catch (err) {
    console.error('OCR route handler error:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error during OCR processing' });
  }
}
