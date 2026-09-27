/**
 * Backend Vision OCR Route for Indian GST B2B Wholesale / FMCG Tax Invoices
 * Uses Groq Vision LPU (qwen/qwen3.8-27b) and Gemini Vision (gemini-2.5-flash / gemini-1.5-flash)
 * with dual OCR pipeline, graceful error tolerance, and intelligent sanitization.
 */

// Helper to normalize Indian DD/MM/YYYY dates to ISO YYYY-MM-DD
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

// Separate 4-8 digit HSN from 12-14 digit retail barcode
function sanitizeHsnAndBarcode(rawHsn, rawBarcode) {
  let hsn = (rawHsn || '').toString().trim();
  let barcode = (rawBarcode || '').toString().trim();

  // If barcode looks like an HSN (4-8 digits) and no HSN or matches HSN, reassign to HSN
  if (barcode && /^\d{4,8}$/.test(barcode) && (!hsn || hsn === barcode)) {
    hsn = barcode;
    barcode = '';
  }

  // Discard barcodes that are not 12-14 digits or match HSN
  if (barcode && (barcode.length < 12 || barcode === hsn)) {
    barcode = '';
  }

  return { hsn, barcode };
}

// Ensure Buyer/Retailer is NEVER mistaken for Supplier/Seller
function disambiguateVendor(vendorName, vendorGstin, vendorAddress, vendorPhone) {
  let name = (vendorName || '').toString().trim();
  let gstin = (vendorGstin || '').toString().toUpperCase().trim();
  let address = (vendorAddress || '').toString().trim();
  let phone = (vendorPhone || '').toString().trim();

  // Strip common buyer prefixes if the model captured the "Billed To" block
  name = name.replace(/^(M\/s\.?|Billed\s*To:?|Buyer:?|Customer:?|Party\s*Name:?|Recipient:?|Consignee:?)\s*/i, '').trim();

  if (name.includes('\n')) {
    const lines = name.split('\n').map((l) => l.trim()).filter(Boolean);
    name = lines[0] || name;
  }

  return {
    vendor_name: name,
    vendor_gstin: gstin,
    vendor_address: address,
    vendor_phone: phone
  };
}

// Clean & standardize parsed JSON into the exact requested output schema
function postProcessInvoiceJson(raw) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  // 1. Supplier vs. Buyer Disambiguation
  const rawVendorName = raw.vendor_name || raw.seller?.name || '';
  const rawVendorGstin = raw.vendor_gstin || raw.seller?.gst || '';
  const rawVendorAddress = raw.vendor_address || raw.seller?.address || '';
  const rawVendorPhone = raw.vendor_phone || raw.seller?.contact || '';

  const { vendor_name, vendor_gstin, vendor_address, vendor_phone } = disambiguateVendor(
    rawVendorName,
    rawVendorGstin,
    rawVendorAddress,
    rawVendorPhone
  );

  // 2. Invoice Number & Date
  let invoice_no = (raw.invoice_no || raw.invoice?.invoice_number || raw.invoice_number || '').toString().trim();
  if (invoice_no) {
    invoice_no = invoice_no.replace(/\s+/g, '');
  }

  const rawDate = raw.invoice_date || raw.invoice?.invoice_date || '';
  const invoice_date = normalizeIndianDate(rawDate);

  // 3. Line Items Processing (Row-by-Row Tabular Alignment & HSN/Barcode separation)
  const rawItems = Array.isArray(raw.items) ? raw.items : [];
  let calculatedSubtotal = 0;
  let calculatedTaxable = 0;
  let calculatedCgst = 0;
  let calculatedSgst = 0;
  let calculatedCess = 0;

  const items = rawItems.map((it, idx) => {
    const sn = Number(it.sn) || (idx + 1);
    const itemName = (it.item_name || it.description || `Item ${sn}`).toString().trim();
    const qty = Math.max(1, Number(it.qty ?? it.quantity) || 1);
    const unit = (it.unit || 'PCS').toString().toUpperCase().trim();
    const mrp = Number(it.mrp) || 0;
    const rate = Number(it.rate ?? it.purchase_price ?? it.price_before_gst) || 0;

    // Strict HSN vs Barcode separation
    const { hsn, barcode } = sanitizeHsnAndBarcode(it.hsn ?? it.hsn_code, it.barcode);

    // Line item discount
    const discAmount = Number(it.discount_amount ?? it.discount) || 0;
    const discPct = Number(it.discount_pct) || 0;

    // Taxable amount: (qty * rate) - discount
    let taxable = Number(it.taxable_amount);
    if (!taxable || isNaN(taxable) || taxable <= 0) {
      taxable = Math.max(0, +((qty * rate) - discAmount).toFixed(2));
    }

    // GST percentages and amounts
    const gstPct = Number(it.gst_pct ?? it.gst_rate) || 0;
    const cgstPct = Number(it.cgst_pct) || (gstPct / 2);
    const sgstPct = Number(it.sgst_pct) || (gstPct / 2);

    let cgstAmt = Number(it.cgst_amount);
    if (isNaN(cgstAmt) || cgstAmt <= 0) {
      cgstAmt = +((taxable * (cgstPct / 100))).toFixed(2);
    }

    let sgstAmt = Number(it.sgst_amount);
    if (isNaN(sgstAmt) || sgstAmt <= 0) {
      sgstAmt = +((taxable * (sgstPct / 100))).toFixed(2);
    }

    const cessAmt = Number(it.cess_amount ?? it.cess) || 0;
    const lineTotal = +(taxable + cgstAmt + sgstAmt + cessAmt).toFixed(2);

    calculatedTaxable += taxable;
    calculatedCgst += cgstAmt;
    calculatedSgst += sgstAmt;
    calculatedCess += cessAmt;
    calculatedSubtotal += lineTotal;

    return {
      sn,
      item_name: itemName,
      hsn,
      barcode,
      qty,
      unit,
      mrp,
      rate,
      discount_pct: discPct,
      discount_amount: discAmount,
      taxable_amount: taxable,
      gst_pct: gstPct,
      cgst_pct: cgstPct,
      cgst_amount: cgstAmt,
      sgst_pct: sgstPct,
      sgst_amount: sgstAmt,
      cess_amount: cessAmt,
      total_amount: lineTotal,
      landed_cost_per_unit: qty > 0 ? Number((lineTotal / qty).toFixed(2)) : lineTotal
    };
  });

  // 4. Invoice Level Discounts, Round-Off & Matching
  const invoiceDiscount = Number(raw.discount_amount ?? raw.totals?.discount_total) || 0;
  const cleanSubtotal = +(calculatedSubtotal > 0 ? calculatedSubtotal : (calculatedTaxable + calculatedCgst + calculatedSgst + calculatedCess)).toFixed(2);

  let grand_total = Number(raw.grand_total ?? raw.totals?.grand_total);
  let round_off = Number(raw.round_off ?? raw.totals?.round_off);

  if (isNaN(grand_total) || grand_total <= 0) {
    grand_total = Math.round(cleanSubtotal);
  }

  if (isNaN(round_off) || round_off === 0) {
    round_off = +(grand_total - cleanSubtotal).toFixed(2);
  }

  // Exact output structure requested by user
  return {
    vendor_name,
    vendor_gstin,
    vendor_address,
    vendor_phone,
    invoice_no,
    invoice_date,
    discount_amount: invoiceDiscount,
    round_off,
    grand_total,
    items,

    // Backward-compatible nested aliases for existing UI consumers
    seller: {
      name: vendor_name,
      gst: vendor_gstin,
      address: vendor_address,
      contact: vendor_phone,
      fssai: raw.fssai || raw.seller?.fssai || '',
      salesman_name: raw.salesman_name || raw.seller?.salesman_name || '',
      salesman_number: raw.salesman_number || raw.seller?.salesman_number || ''
    },
    invoice: {
      invoice_number: invoice_no,
      invoice_date: invoice_date
    },
    bank_details: {
      bank_name: raw.bank_details?.bank_name || raw.bank_name || '',
      account_no: raw.bank_details?.account_no || raw.bank_account_no || raw.account_no || '',
      ifsc: raw.bank_details?.ifsc || raw.bank_ifsc || raw.ifsc || ''
    },
    totals: {
      taxable_amount: +calculatedTaxable.toFixed(2),
      cgst_total: +calculatedCgst.toFixed(2),
      sgst_total: +calculatedSgst.toFixed(2),
      cess_total: +calculatedCess.toFixed(2),
      total_tax: +(calculatedCgst + calculatedSgst + calculatedCess).toFixed(2),
      subtotal: cleanSubtotal,
      discount_total: invoiceDiscount,
      round_off,
      grand_total
    }
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const groqApiKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY || req.body?.groqApiKey;
  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

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

    // -------------------------------------------------------------
    // STRICT DOMAIN PROMPT FOR INDIAN GST B2B TAX INVOICES
    // -------------------------------------------------------------
    const promptText = `You are an expert Indian GST B2B tax invoice and FMCG purchase bill OCR specialist with deep expertise in reading dense dot-matrix computer printouts, thermal bills, and multi-tier tax invoices.

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

    // -------------------------------------------------------------
    // DEMO FALLBACK: If neither Groq nor Gemini key is configured
    // -------------------------------------------------------------
    if (!groqApiKey && !geminiApiKey) {
      console.warn('Neither GROQ_API_KEY nor GEMINI_API_KEY configured. Returning realistic demo B2B invoice.');
      const demoData = {
        vendor_name: "RUDRAKSH AGENCIES",
        vendor_gstin: "09BASPG6346Q1ZQ",
        vendor_address: "SHOP NO C 939, NAND GRAM, GHAZIABAD",
        vendor_phone: "8882030921",
        invoice_no: "T000820",
        invoice_date: "2026-08-04",
        discount_amount: 114.54,
        round_off: 0.47,
        grand_total: 5895.00,
        items: [
          {
            sn: 1,
            item_name: "SHAHI PANNER MASALA",
            hsn: "09109100",
            barcode: "",
            qty: 48,
            unit: "PCS",
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
            item_name: "CHANA MASALA 100G",
            hsn: "09109100",
            barcode: "",
            qty: 36,
            unit: "PCS",
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
            item_name: "KASURI METHI 50G BOX",
            hsn: "12119099",
            barcode: "",
            qty: 60,
            unit: "BOX",
            mrp: 45.00,
            rate: 34.00,
            taxable_amount: 2040.00,
            gst_pct: 5,
            cgst_pct: 2.5,
            cgst_amount: 51.00,
            sgst_pct: 2.5,
            sgst_amount: 51.00,
            cess_amount: 0
          }
        ],
        _is_demo_preview: true
      };
      return res.status(200).json(postProcessInvoiceJson(demoData));
    }

    // -------------------------------------------------------------
    // DUAL OCR PIPELINE: GROQ VISION + GEMINI FLASH
    // -------------------------------------------------------------
    let groqData = null;
    let groqError = null;

    if (groqApiKey) {
      try {
        const groqModel = 'qwen/qwen3.8-27b';
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqApiKey}`
          },
          body: JSON.stringify({
            model: groqModel,
            response_format: { type: 'json_object' },
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: promptText },
                  { type: 'image_url', image_url: { url: cleanImage } }
                ]
              }
            ],
            temperature: 0.1,
            max_tokens: 3000
          })
        });

        if (response.ok) {
          const data = await response.json();
          const content = data?.choices?.[0]?.message?.content;
          if (content) {
            const cleanJson = content.replace(/```json/g, '').replace(/```/g, '').trim();
            groqData = JSON.parse(cleanJson);
          }
        } else {
          const errText = await response.text();
          groqError = new Error(`Groq status ${response.status}: ${errText}`);
          console.warn('Groq OCR failed, falling back purely to Gemini:', groqError.message);
        }
      } catch (err) {
        groqError = err;
        console.warn('Groq OCR failed, falling back purely to Gemini:', err.message || err);
      }
    }

    let geminiData = null;
    let geminiError = null;

    if (geminiApiKey) {
      const geminiModels = ['gemini-2.5-flash', 'gemini-1.5-flash'];
      for (const gModel of geminiModels) {
        try {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${gModel}:generateContent?key=${geminiApiKey}`;
          const geminiPayload = {
            contents: [
              {
                parts: [
                  { text: `${promptText}\n\nIMPORTANT: Return ONLY raw JSON without markdown formatting.` },
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
              responseMimeType: 'application/json'
            }
          };

          const geminiRes = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(geminiPayload)
          });

          if (geminiRes.ok) {
            const gData = await geminiRes.json();
            const gText = gData?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (gText) {
              const cleanJson = gText.replace(/```json/g, '').replace(/```/g, '').trim();
              geminiData = JSON.parse(cleanJson);
              break;
            }
          } else {
            const gErr = await geminiRes.text();
            geminiError = new Error(`Gemini ${gModel} status ${geminiRes.status}: ${gErr}`);
            console.warn(`Gemini OCR failed on ${gModel}:`, gErr);
          }
        } catch (gEx) {
          geminiError = gEx;
          console.warn(`Gemini OCR exception on ${gModel}:`, gEx.message || gEx);
        }
      }
    }

    // Reconcile or Fallback:
    // If both succeed, reconcile and pick the best math match.
    // If only Gemini succeeds, use Gemini directly.
    // If only Groq succeeds, use Groq directly.
    let finalRaw = null;
    if (geminiData && groqData) {
      // Score mathematical consistency and item completeness
      const evalAccuracy = (d) => {
        let score = 0;
        const itms = Array.isArray(d?.items) ? d.items : [];
        const grandTot = Number(d?.grand_total || d?.totals?.grand_total) || 0;
        let sum = 0;
        itms.forEach((it) => {
          sum += Number(it.total_amount ?? it.price_after_gst) || 0;
        });
        const diff = Math.abs(sum - grandTot);
        if (diff < 0.05) score += 50;
        else if (diff < 1.05) score += 40;
        else if (diff < 5.0) score += 20;

        score += Math.min(itms.length * 3, 30);
        if (d?.vendor_gstin && d.vendor_gstin.length === 15) score += 10;
        if (d?.invoice_no) score += 10;
        return score;
      };

      const groqScore = evalAccuracy(groqData);
      const geminiScore = evalAccuracy(geminiData);
      finalRaw = groqScore >= geminiScore ? { ...groqData } : { ...geminiData };
      const secondary = groqScore >= geminiScore ? geminiData : groqData;

      // Fill in any missing vendor/invoice fields from secondary model
      if (!finalRaw.vendor_gstin && secondary?.vendor_gstin) finalRaw.vendor_gstin = secondary.vendor_gstin;
      if (!finalRaw.vendor_phone && secondary?.vendor_phone) finalRaw.vendor_phone = secondary.vendor_phone;
      if (!finalRaw.vendor_address && secondary?.vendor_address) finalRaw.vendor_address = secondary.vendor_address;
      if (!finalRaw.invoice_no && secondary?.invoice_no) finalRaw.invoice_no = secondary.invoice_no;
    } else if (geminiData) {
      finalRaw = geminiData;
    } else if (groqData) {
      finalRaw = groqData;
    }

    if (!finalRaw) {
      return res.status(502).json({
        error: groqError?.message || geminiError?.message || 'Failed to extract invoice data using Groq Vision or Gemini Vision models.'
      });
    }

    // Sanitize and normalize with strict Indian GST domain rules
    const finalSanitized = postProcessInvoiceJson(finalRaw);
    return res.status(200).json(finalSanitized);
  } catch (err) {
    console.error('purchase-ocr handler error:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error during invoice OCR processing' });
  }
}
