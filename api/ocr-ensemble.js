/**
 * Backend Ensemble Vision OCR Route for Indian GST B2B Wholesale / FMCG Tax Invoices
 * Runs Google Gemini and Groq Vision concurrently, and resolves discrepancies via
 * the pure JavaScript consensus & reconciliation arbiter.
 */

import {
  INDIAN_GST_OCR_PROMPT,
  reconcileOcrOutputs,
  autoChunkLongBillIfNeeded,
  fetchGroqContinuation,
  fetchGeminiContinuation
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
      console.warn('Neither GROQ_API_KEY nor GEMINI_API_KEY configured. Returning demo Indian B2B FMCG invoice.');
      const demoGroq = {
        vendor_name: 'RUDRAKSH AGENCIES',
        vendor_gstin: '09BASPG6346Q1ZQ',
        vendor_address: 'SHOP NO C 939, NAND GRAM, GHAZIABAD',
        vendor_phone: '8882030921',
        invoice_no: 'T000820',
        invoice_date: '2026-08-04',
        discount_pct: 2,
        discount_amount: 114.54,
        round_off: 0.58,
        grand_total: 5895.00,
        items: [
          {
            sn: 2,
            item_name: 'CHANA MASALA 100G',
            hsn: '09109100',
            barcode: '',
            qty: 36,
            unit: 'PCS',
            mrp: 65.00,
            rate: 48.20,
            taxable_amount: 1735.20,
            gst_pct: 5,
            cgst_pct: 2.5,
            cgst_amount: 43.38,
            sgst_pct: 2.5,
            sgst_amount: 43.38,
            cess_amount: 0
          },
          {
            sn: 3,
            item_name: 'KASURI METHI 50G BOX',
            hsn: '12119099',
            barcode: '',
            qty: 60,
            unit: 'BOX',
            mrp: 45.00,
            rate: 34.00,
            taxable_amount: 2040.00,
            gst_pct: 5,
            cgst_pct: 2.5,
            cgst_amount: 51.00,
            sgst_pct: 2.5,
            sgst_amount: 51.00,
            cess_amount: 0
          },
          {
            sn: 4,
            item_name: 'GARAM MASALA 100G',
            hsn: '09109100',
            barcode: '',
            qty: 4,
            unit: 'PCS',
            mrp: 70.00,
            rate: 51.10,
            taxable_amount: 204.40,
            gst_pct: 5,
            cgst_pct: 2.5,
            cgst_amount: 2.26,
            sgst_pct: 2.5,
            sgst_amount: 2.26,
            cess_amount: 0
          }
        ]
      };
      const demoGemini = {
        vendor_name: 'MITTAL DEPARTMENTAL STORE',
        vendor_gstin: '09AABCU9603R1ZM',
        vendor_address: 'SHOP NO C 939, NAND GRAM, GHAZIABAD',
        vendor_phone: '8882030921',
        invoice_no: 'T000820',
        invoice_date: '2026-08-04',
        discount_pct: 2,
        discount_amount: 114.54,
        round_off: 0.58,
        grand_total: 5895.00,
        items: [
          {
            sn: 1,
            item_name: 'SHAHI PANNER MASALA',
            hsn: '09109100',
            barcode: '09109100',
            qty: 48,
            unit: 'PCS',
            mrp: 50.00,
            rate: 36.43,
            taxable_amount: 1748.64,
            gst_pct: 5,
            cgst_pct: 2.5,
            cgst_amount: 43.72,
            sgst_pct: 2.5,
            sgst_amount: 43.72,
            cess_amount: 0
          },
          {
            sn: 2,
            item_name: 'CHANA MASALA 100G',
            hsn: '09109100',
            barcode: '',
            qty: 36,
            unit: 'PCS',
            mrp: 65.00,
            rate: 48.20,
            taxable_amount: 1735.20,
            gst_pct: 5,
            cgst_pct: 2.5,
            cgst_amount: 43.38,
            sgst_pct: 2.5,
            sgst_amount: 43.38,
            cess_amount: 0
          },
          {
            sn: 3,
            item_name: 'KASURI METHI 50G BOX',
            hsn: '12119099',
            barcode: '',
            qty: 60,
            unit: 'BOX',
            mrp: 45.00,
            rate: 34.00,
            taxable_amount: 2040.00,
            gst_pct: 5,
            cgst_pct: 2.5,
            cgst_amount: 51.00,
            sgst_pct: 2.5,
            sgst_amount: 51.00,
            cess_amount: 0
          },
          {
            sn: 4,
            item_name: 'GARAM MASALA 100G',
            hsn: '09109100',
            barcode: '',
            qty: 4,
            unit: 'PCS',
            mrp: 70.00,
            rate: 51.10,
            taxable_amount: 204.40,
            gst_pct: 5,
            cgst_pct: 2.5,
            cgst_amount: 2.26,
            sgst_pct: 2.5,
            sgst_amount: 2.26,
            cess_amount: 0
          }
        ]
      };
      const demoResult = reconcileOcrOutputs(demoGemini, demoGroq);
      demoResult._is_demo_preview = true;
      return res.status(200).json(demoResult);
    }

    // -------------------------------------------------------------
    // PARALLEL EXECUTION: REQUEST A (Gemini) + REQUEST B (Groq)
    // -------------------------------------------------------------
    const callGemini = async () => {
      if (!geminiApiKey) return null;
      const models = ['gemini-2.5-flash', 'gemini-1.5-flash'];
      for (const m of models) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${geminiApiKey}`;
          const payload = {
            contents: [
              {
                parts: [
                  { text: `${INDIAN_GST_OCR_PROMPT}\n\nIMPORTANT: Return ONLY raw JSON without markdown formatting.` },
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
              responseMimeType: 'application/json',
              maxOutputTokens: 8192
            }
          };

          const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (resp.ok) {
            const data = await resp.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
              const initialResult = JSON.parse(clean);
              return autoChunkLongBillIfNeeded(initialResult, (startSno, highestSno) => {
                return fetchGeminiContinuation(base64Only, mimeType, startSno, highestSno, geminiApiKey);
              });
            }
          }
        } catch (gErr) {
          console.warn(`Gemini ${m} call failed:`, gErr.message || gErr);
        }
      }
      return null;
    };

    const callGroq = async () => {
      if (!groqApiKey) return null;
      try {
        const activeModel = 'qwen/qwen3.8-27b';
        const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqApiKey}`
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
            max_tokens: 8192
          })
        });

        if (resp.ok) {
          const data = await resp.json();
          const content = data?.choices?.[0]?.message?.content;
          if (content) {
            const clean = content.replace(/```json/g, '').replace(/```/g, '').trim();
            const initialResult = JSON.parse(clean);
            return autoChunkLongBillIfNeeded(initialResult, (startSno, highestSno) => {
              return fetchGroqContinuation(cleanImage, startSno, highestSno, groqApiKey);
            });
          }
        } else {
          const errText = await resp.text();
          console.warn(`Groq Vision returned error ${resp.status}:`, errText);
        }
      } catch (qErr) {
        console.warn('Groq Vision exception:', qErr.message || qErr);
      }
      return null;
    };

    // Concurrently trigger both models
    const [geminiSettled, groqSettled] = await Promise.allSettled([
      callGemini(),
      callGroq()
    ]);

    const geminiData = geminiSettled.status === 'fulfilled' ? geminiSettled.value : null;
    const groqData = groqSettled.status === 'fulfilled' ? groqSettled.value : null;

    if (!geminiData && !groqData) {
      return res.status(502).json({
        error: 'Both Google Gemini and Groq Vision failed to extract invoice data. Check image quality or API credentials.'
      });
    }

    // Run reconciliation and consensus engine
    const finalEnsemble = reconcileOcrOutputs(geminiData, groqData);
    return res.status(200).json(finalEnsemble);
  } catch (err) {
    console.error('Ensemble OCR handler error:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error during ensemble OCR processing' });
  }
}
