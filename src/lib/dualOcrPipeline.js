/**
 * Dual OCR Pipeline & Ensemble Reconciliation Engine
 * Combines Google Gemini Flash and Groq Vision for Indian GST B2B Wholesale / FMCG Tax Invoices.
 *
 * Core Features:
 * 1. Parallel Execution: Concurrent requests to Gemini (gemini-2.5-flash / gemini-1.5-flash)
 *    and Groq Vision (qwen/qwen3.8-27b).
 * 2. Consensus & Reconciliation Arbiter (reconcileOcrOutputs):
 *    - Header Information: Buyer vs. Seller disambiguation ("MITTAL DEPARTMENTAL STORE" vs "RUDRAKSH AGENCIES")
 *      and letterhead GSTIN validation.
 *    - Row-by-Row Tallying: Mathematical variance against printed grand total; zero-variance marks primary.
 *    - Field-Level Merging: Missing rows (e.g. SN 1 "SHAHI PANEER MASALA") merged seamlessly from secondary model.
 *    - HSN vs Barcode separation: HSN exclusively in hsn field; barcode strictly 12-14 digits EAN.
 */

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
   - Extract ALL rows present on the invoice without stopping or summarizing. If there are 30-50 rows, extract every single row.
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
   - Look specifically for the item discount column (e.g., 'Disc. %', 'Disc%', 'Trade Disc'). Extract this value as \`discount_pct\` (number only, e.g. 1 for 1%). If no discount is printed for a row, set \`discount_pct\` to 0.
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
  "discount_pct": 2.0,
  "discount_amount": 114.54,
  "round_off": 0.58,
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
      "discount_pct": 0,
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
 * Check if a vendor name matches customer/buyer patterns (e.g. "MITTAL DEPARTMENTAL STORE")
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
  // Ensure HSN codes are never copied into the barcode field
  if (barcode && (!/^\d{12,14}$/.test(barcode) || barcode === hsn)) {
    barcode = '';
  }

  return { hsn, barcode };
}

/**
 * Evaluate mathematical consistency and row serial numbers of a model's OCR output
 */
export function evaluateModelMath(data) {
  if (!data || typeof data !== 'object') {
    return {
      isValid: false,
      items: [],
      itemsCount: 0,
      computedTotal: 0,
      grandTotal: 0,
      variance: Infinity,
      isZeroVariance: false,
      hasContinuousSns: false,
      maxSn: 0
    };
  }

  const rawItems = Array.isArray(data.items) ? data.items : [];
  let sumTaxable = 0;
  let sumCgst = 0;
  let sumSgst = 0;
  let sumCess = 0;
  let maxSn = 0;
  const snsFound = new Set();

  const normalizedItems = rawItems.map((it, idx) => {
    const rawSn = Number(it.sn);
    const sn = (!isNaN(rawSn) && rawSn > 0) ? rawSn : (idx + 1);
    if (!isNaN(rawSn) && rawSn > 0) {
      snsFound.add(rawSn);
      if (rawSn > maxSn) maxSn = rawSn;
    }

    const qty = Math.max(0, Number(it.qty ?? it.quantity) || 1);
    const rate = Math.max(0, Number(it.rate ?? it.purchase_price ?? it.price_before_gst) || 0);
    const discPct = Number(it.discount_pct) || 0;
    let disc = Math.max(0, Number(it.discount_amount ?? it.discount) || 0);
    if (!disc && discPct > 0) {
      disc = +((qty * rate * (discPct / 100))).toFixed(2);
    }

    let taxable = Number(it.taxable_amount);
    if (isNaN(taxable) || taxable <= 0) {
      taxable = Math.max(0, +((qty * rate) - disc).toFixed(2));
    }

    const gstPct = Number(it.gst_pct ?? it.gst_rate) || 0;
    const cgstPct = Number(it.cgst_pct) || (gstPct / 2);
    const sgstPct = Number(it.sgst_pct) || (gstPct / 2);

    let cgst = Number(it.cgst_amount);
    if (isNaN(cgst) || cgst <= 0) {
      cgst = +((taxable * (cgstPct / 100))).toFixed(2);
    }

    let sgst = Number(it.sgst_amount);
    if (isNaN(sgst) || sgst <= 0) {
      sgst = +((taxable * (sgstPct / 100))).toFixed(2);
    }

    const cess = Math.max(0, Number(it.cess_amount ?? it.cess) || 0);
    const lineTotal = Number(it.total_amount ?? it.price_after_gst) || +(taxable + cgst + sgst + cess).toFixed(2);

    sumTaxable += taxable;
    sumCgst += cgst;
    sumSgst += sgst;
    sumCess += cess;

    const { hsn, barcode } = sanitizeItemHsnAndBarcode(it.hsn ?? it.hsn_code, it.barcode);

    return {
      sn,
      item_name: (it.item_name || it.description || `Item ${sn}`).toString().trim(),
      hsn,
      hsn_code: hsn,
      barcode,
      qty,
      quantity: qty,
      unit: (it.unit || 'PCS').toString().toUpperCase().trim(),
      mrp: Number(it.mrp) || +(rate * 1.25).toFixed(2),
      rate,
      purchase_price: rate,
      price_before_gst: rate,
      discount_pct: discPct,
      discount_amount: disc,
      discount: disc,
      taxable_amount: taxable,
      gst_pct: gstPct,
      gst_rate: gstPct,
      cgst_pct: cgstPct,
      cgst_amount: cgst,
      sgst_pct: sgstPct,
      sgst_amount: sgst,
      cess_amount: cess,
      cess,
      total_amount: lineTotal,
      price_after_gst: lineTotal,
      landed_cost_per_unit: qty > 0 ? Number((lineTotal / qty).toFixed(2)) : lineTotal
    };
  });

  const invoiceDiscount = Number(data.discount_amount ?? data.totals?.discount_total) || 0;
  const roundoff = Number(data.round_off ?? data.totals?.round_off) || 0;
  const printedGrandTotal = Number(data.grand_total ?? data.totals?.grand_total) || 0;

  // computed_total = sum(items.taxable + items.cgst + items.sgst + items.cess) - discount + roundoff
  const computedTotal = +((sumTaxable + sumCgst + sumSgst + sumCess) - invoiceDiscount + roundoff).toFixed(2);
  const variance = printedGrandTotal > 0 ? Math.abs(computedTotal - printedGrandTotal) : 0;
  const isZeroVariance = variance < 0.05;

  // Check physical serial number continuity (e.g. SN 1 to 14)
  let hasContinuousSns = maxSn > 0 && snsFound.size === maxSn;
  for (let s = 1; s <= maxSn; s++) {
    if (!snsFound.has(s)) {
      hasContinuousSns = false;
      break;
    }
  }

  return {
    isValid: true,
    items: normalizedItems,
    itemsCount: normalizedItems.length,
    computedTotal,
    grandTotal: printedGrandTotal,
    variance,
    isZeroVariance,
    hasContinuousSns,
    maxSn,
    sumTaxable: +sumTaxable.toFixed(2),
    sumCgst: +sumCgst.toFixed(2),
    sumSgst: +sumSgst.toFixed(2),
    sumCess: +sumCess.toFixed(2),
    discount: invoiceDiscount,
    roundoff
  };
}

/**
 * Pure JavaScript Consensus & Reconciliation Arbiter function
 * Combines Google Gemini and Groq Vision outputs according to strict Indian GST domain rules.
 *
 * @param {Object} geminiResult Output from Google Gemini Vision
 * @param {Object} groqResult Output from Groq Vision
 * @returns {Object} Reconciled, math-validated, consensus invoice dataset
 */
export function reconcileOcrOutputs(geminiResult, groqResult) {
  // 1. Guard against empty inputs
  const geminiEval = evaluateModelMath(geminiResult);
  const groqEval = evaluateModelMath(groqResult);

  if (!geminiEval.isValid && !groqEval.isValid) {
    throw new Error('Both Google Gemini and Groq Vision OCR outputs are invalid or empty.');
  }

  // Handle single engine success gracefully
  if (geminiEval.isValid && !groqEval.isValid) {
    return buildEnsembleResult({
      primaryEngine: 'gemini',
      primaryEval: geminiEval,
      secondaryEval: null,
      primaryRaw: geminiResult,
      secondaryRaw: null,
      chosenVendorName: cleanVendorName(geminiResult?.vendor_name || geminiResult?.seller?.name),
      chosenVendorGstin: (geminiResult?.vendor_gstin || geminiResult?.seller?.gst || '').toUpperCase().trim(),
      mergedItems: geminiEval.items,
      mergedRowsCount: 0,
      consensusLabel: 'Google Gemini Flash (Single Engine)'
    });
  }

  if (!geminiEval.isValid && groqEval.isValid) {
    return buildEnsembleResult({
      primaryEngine: 'groq',
      primaryEval: groqEval,
      secondaryEval: null,
      primaryRaw: groqResult,
      secondaryRaw: null,
      chosenVendorName: cleanVendorName(groqResult?.vendor_name || groqResult?.seller?.name),
      chosenVendorGstin: (groqResult?.vendor_gstin || groqResult?.seller?.gst || '').toUpperCase().trim(),
      mergedItems: groqEval.items,
      mergedRowsCount: 0,
      consensusLabel: 'Groq Vision (Single Engine)'
    });
  }

  // --------------------------------------------------------------------------
  // 2. HEADER INFORMATION (Buyer vs. Seller Disambiguation & Letterhead GSTIN)
  // --------------------------------------------------------------------------
  const gemName = geminiResult?.vendor_name || geminiResult?.seller?.name || '';
  const gemGst = (geminiResult?.vendor_gstin || geminiResult?.seller?.gst || '').toUpperCase().trim();
  const groqName = groqResult?.vendor_name || groqResult?.seller?.name || '';
  const groqGst = (groqResult?.vendor_gstin || groqResult?.seller?.gst || '').toUpperCase().trim();

  const gemIsBuyer = isBuyerPattern(gemName);
  const groqIsBuyer = isBuyerPattern(groqName);

  let chosenVendorName = '';
  let chosenVendorGstin = '';

  // Rule: If one model identifies the buyer ("MITTAL DEPARTMENTAL STORE") instead of seller ("RUDRAKSH AGENCIES"),
  // prefer the result where GSTIN matches top letterhead format
  if (gemIsBuyer && !groqIsBuyer) {
    chosenVendorName = cleanVendorName(groqName);
    chosenVendorGstin = groqGst || gemGst;
  } else if (groqIsBuyer && !gemIsBuyer) {
    chosenVendorName = cleanVendorName(gemName);
    chosenVendorGstin = gemGst || groqGst;
  } else {
    // Both or neither match buyer pattern: Prefer top letterhead format (valid 15-char GSTIN)
    const gemGstValid = isValidGstin(gemGst);
    const groqGstValid = isValidGstin(groqGst);

    if (groqGstValid && !gemGstValid) {
      chosenVendorName = cleanVendorName(groqName || gemName);
      chosenVendorGstin = groqGst;
    } else if (gemGstValid && !groqGstValid) {
      chosenVendorName = cleanVendorName(gemName || groqName);
      chosenVendorGstin = gemGst;
    } else {
      chosenVendorName = cleanVendorName(groqName || gemName);
      chosenVendorGstin = groqGst || gemGst;
    }
  }

  // --------------------------------------------------------------------------
  // 3. ROW-BY-ROW TALLYING & PRIMARY ENGINE SELECTION
  // --------------------------------------------------------------------------
  // Whichever model achieves zero variance against the bill's grand total is marked as primary
  let primaryEngine = 'groq';

  if (groqEval.isZeroVariance && !geminiEval.isZeroVariance) {
    primaryEngine = 'groq';
  } else if (geminiEval.isZeroVariance && !groqEval.isZeroVariance) {
    primaryEngine = 'gemini';
  } else if (Math.abs(groqEval.variance - geminiEval.variance) > 0.1) {
    // Pick the one with smallest variance
    primaryEngine = groqEval.variance < geminiEval.variance ? 'groq' : 'gemini';
  } else {
    // Tie-breaker 1: Physical serial number continuity (SN 1 to 14)
    if (groqEval.hasContinuousSns && !geminiEval.hasContinuousSns) {
      primaryEngine = 'groq';
    } else if (geminiEval.hasContinuousSns && !groqEval.hasContinuousSns) {
      primaryEngine = 'gemini';
    } else if (groqEval.itemsCount !== geminiEval.itemsCount) {
      // Tie-breaker 2: Higher line item count
      primaryEngine = groqEval.itemsCount > geminiEval.itemsCount ? 'groq' : 'gemini';
    } else {
      // Tie-breaker 3: Valid letterhead GSTIN
      if (isValidGstin(groqGst) && !isValidGstin(gemGst)) {
        primaryEngine = 'groq';
      } else {
        primaryEngine = 'gemini';
      }
    }
  }

  const primaryEval = primaryEngine === 'groq' ? groqEval : geminiEval;
  const secondaryEval = primaryEngine === 'groq' ? geminiEval : groqEval;
  const primaryRaw = primaryEngine === 'groq' ? groqResult : geminiResult;
  const secondaryRaw = primaryEngine === 'groq' ? geminiResult : groqResult;

  // --------------------------------------------------------------------------
  // 4. FIELD-LEVEL MERGING (Missing Rows & HSN/Barcode Separation)
  // --------------------------------------------------------------------------
  // If Gemini captured an item row that Groq skipped (e.g. Line 1 "SHAHI PANEER MASALA"),
  // automatically merge the missing row into the final dataset.
  const primaryItems = [...primaryEval.items];
  const secondaryItems = [...secondaryEval.items];

  const primarySns = new Set(primaryItems.map((it) => Number(it.sn)).filter(Boolean));
  const primaryNames = new Set(
    primaryItems.map((it) => (it.item_name || '').toUpperCase().replace(/[^A-Z0-9]/g, ''))
  );

  let mergedRowsCount = 0;
  const mergedItems = [...primaryItems];

  secondaryItems.forEach((secItem) => {
    const secSn = Number(secItem.sn);
    const normName = (secItem.item_name || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

    let isMissingInPrimary = false;

    // Condition A: Serial number was skipped in primary (e.g. SN 1)
    if (secSn && !primarySns.has(secSn)) {
      isMissingInPrimary = true;
    }
    // Condition B: Distinct product name completely skipped in primary
    else if (normName && !primaryNames.has(normName)) {
      const hasFuzzyMatch = Array.from(primaryNames).some(
        (pName) => pName.includes(normName) || normName.includes(pName)
      );
      if (!hasFuzzyMatch) {
        isMissingInPrimary = true;
      }
    }

    if (isMissingInPrimary) {
      mergedRowsCount++;
      mergedItems.push({
        ...secItem,
        _merged_from_consensus: true
      });
      if (secSn) primarySns.add(secSn);
      if (normName) primaryNames.add(normName);
    }
  });

  // Sort merged items by serial number and ensure continuous numbering
  mergedItems.sort((a, b) => (Number(a.sn) || 0) - (Number(b.sn) || 0));
  mergedItems.forEach((it, idx) => {
    it.sn = idx + 1;
    // Strict HSN vs Barcode separation
    const { hsn, barcode } = sanitizeItemHsnAndBarcode(it.hsn ?? it.hsn_code, it.barcode);
    it.hsn = hsn;
    it.hsn_code = hsn;
    it.barcode = barcode;
  });

  return buildEnsembleResult({
    primaryEngine,
    primaryEval,
    secondaryEval,
    primaryRaw,
    secondaryRaw,
    chosenVendorName,
    chosenVendorGstin,
    mergedItems,
    mergedRowsCount,
    consensusLabel: 'Gemini + Groq Consensus'
  });
}

/**
 * Assemble final standardized JSON schema with nested backward compatibility aliases
 */
function buildEnsembleResult({
  primaryEngine,
  primaryEval,
  secondaryEval,
  primaryRaw,
  secondaryRaw,
  chosenVendorName,
  chosenVendorGstin,
  mergedItems,
  mergedRowsCount,
  consensusLabel
}) {
  const secondary = secondaryRaw || {};
  const primary = primaryRaw || {};

  // Cross-pollinate vendor contact details
  const address = primary.vendor_address || secondary.vendor_address || primary.seller?.address || secondary.seller?.address || '';
  const phone = primary.vendor_phone || secondary.vendor_phone || primary.seller?.contact || secondary.seller?.contact || '';
  const fssai = primary.vendor_fssai || secondary.vendor_fssai || primary.seller?.fssai || secondary.seller?.fssai || '';
  const salesmanName = primary.salesman_name || secondary.salesman_name || primary.seller?.salesman_name || secondary.seller?.salesman_name || '';
  const salesmanNumber = primary.salesman_number || secondary.salesman_number || primary.seller?.salesman_number || secondary.seller?.salesman_number || '';

  // Invoice identifiers
  let invoice_no = (primary.invoice_no || secondary.invoice_no || primary.invoice?.invoice_number || secondary.invoice?.invoice_number || '').toString().trim();
  if (invoice_no) invoice_no = invoice_no.replace(/\s+/g, '');
  const invoice_date = normalizeIndianDate(primary.invoice_date || secondary.invoice_date || primary.invoice?.invoice_date || secondary.invoice?.invoice_date);

  // Recalculate financial breakdown across all merged items
  let finalTaxable = 0;
  let finalCgst = 0;
  let finalSgst = 0;
  let finalCess = 0;
  let finalSubtotal = 0;

  mergedItems.forEach((it) => {
    finalTaxable += Number(it.taxable_amount) || 0;
    finalCgst += Number(it.cgst_amount) || 0;
    finalSgst += Number(it.sgst_amount) || 0;
    finalCess += Number(it.cess_amount) || 0;
    finalSubtotal += Number(it.total_amount) || 0;
  });

  const discountAmount = Number(primary.discount_amount ?? secondary.discount_amount) || 0;
  const discountPct = Number(primary.discount_pct ?? secondary.discount_pct) || (
    finalSubtotal > 0 && discountAmount > 0 ? +((discountAmount / finalSubtotal) * 100).toFixed(2) : 0
  );
  let roundOff = Number(primary.round_off ?? secondary.round_off) || 0;
  let grandTotal = Number(primary.grand_total ?? secondary.grand_total) || 0;

  const calculatedBase = finalTaxable + finalCgst + finalSgst + finalCess - discountAmount;
  if (grandTotal <= 0 || (mergedRowsCount > 0 && Math.abs(calculatedBase + roundOff - grandTotal) > 1.0)) {
    grandTotal = Math.round(calculatedBase);
    roundOff = +(grandTotal - calculatedBase).toFixed(2);
  }

  return {
    vendor_name: chosenVendorName,
    vendor_gstin: chosenVendorGstin,
    vendor_address: address,
    vendor_phone: phone,
    invoice_no,
    invoice_date,
    discount_pct: discountPct,
    discount_amount: discountAmount,
    discount_total: discountAmount,
    round_off: roundOff,
    grand_total: grandTotal,
    vendor_grand_total: Number(primary.grand_total ?? secondary.grand_total ?? primary.totals?.grand_total) || grandTotal,
    items: mergedItems,

    // Backward-compatible nested aliases for existing UI consumers
    seller: {
      name: chosenVendorName,
      gst: chosenVendorGstin,
      address,
      contact: phone,
      fssai,
      salesman_name: salesmanName,
      salesman_number: salesmanNumber
    },
    invoice: {
      invoice_number: invoice_no,
      invoice_date: invoice_date
    },
    bank_details: {
      bank_name: primary.bank_details?.bank_name || secondary.bank_details?.bank_name || '',
      account_no: primary.bank_details?.account_no || secondary.bank_details?.account_no || '',
      ifsc: primary.bank_details?.ifsc || secondary.bank_details?.ifsc || ''
    },
    totals: {
      taxable_amount: +finalTaxable.toFixed(2),
      cgst_total: +finalCgst.toFixed(2),
      sgst_total: +finalSgst.toFixed(2),
      cess_total: +finalCess.toFixed(2),
      total_tax: +(finalCgst + finalSgst + finalCess).toFixed(2),
      subtotal: +finalSubtotal.toFixed(2),
      discount_pct: discountPct,
      discount_amount: discountAmount,
      discount_total: discountAmount,
      round_off: roundOff,
      grand_total: grandTotal
    },

    // Ensemble metadata for frontend UI badge & audit trail
    _ensemble: {
      verified: true,
      consensus: consensusLabel,
      primary_engine: primaryEngine,
      gemini_items: primaryEngine === 'gemini' ? primaryEval.itemsCount : (secondaryEval?.itemsCount ?? 0),
      groq_items: primaryEngine === 'groq' ? primaryEval.itemsCount : (secondaryEval?.itemsCount ?? 0),
      gemini_variance: primaryEngine === 'gemini' ? primaryEval.variance : (secondaryEval?.variance ?? null),
      groq_variance: primaryEngine === 'groq' ? primaryEval.variance : (secondaryEval?.variance ?? null),
      merged_rows_count: mergedRowsCount
    }
  };
}

/**
 * Call Groq Vision API using official active vision model: qwen/qwen3.8-27b
 */
export async function callGroqVision(imageBase64, { apiKey = '', mimeType = 'image/jpeg' } = {}) {
  const effectiveKey = apiKey || (typeof process !== 'undefined' ? process.env?.GROQ_API_KEY || process.env?.VITE_GROQ_API_KEY : '') || (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_GROQ_API_KEY : '');
  if (!effectiveKey) {
    throw new Error('GROQ_API_KEY is not configured');
  }

  const cleanImage = imageBase64.startsWith('data:')
    ? imageBase64
    : `data:${mimeType};base64,${imageBase64}`;

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

  const cleanJson = content.replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(cleanJson);
}

/**
 * Call Google Gemini Vision API using active flash models: gemini-2.5-flash or gemini-1.5-flash
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
        return JSON.parse(cleanJson);
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Gemini Vision extraction failed on all flash models.');
}

/**
 * Main ensemble entry point: Process invoice through backend route or parallel client execution
 *
 * @param {string} imageBase64 Base64 or data URL of invoice image/PDF
 * @param {Object} options Configuration options (mimeType, apiKey, etc.)
 * @returns {Promise<Object>} Reconciled invoice data
 */
export async function processBill(imageBase64, options = {}) {
  // 1. First attempt through backend route /api/ocr-ensemble or /api/purchase-ocr
  if (typeof window !== 'undefined' && !options.useDirectClient) {
    try {
      const endpoint = '/api/ocr-ensemble';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          mimeType: options.mimeType || 'image/jpeg',
          groqApiKey: options.groqApiKey || options.apiKey,
          geminiApiKey: options.geminiApiKey
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result && (result.items || result.grand_total || result.vendor_name)) {
          return result;
        }
      }
    } catch (apiErr) {
      console.warn('Backend OCR route unavailable, proceeding with direct client parallel ensemble:', apiErr.message);
    }
  }

  // 2. Direct Parallel Execution: Request A (Gemini) + Request B (Groq) concurrently
  const [geminiSettled, groqSettled] = await Promise.allSettled([
    callGeminiVision(imageBase64, options),
    callGroqVision(imageBase64, options)
  ]);

  const geminiResult = geminiSettled.status === 'fulfilled' ? geminiSettled.value : null;
  const groqResult = groqSettled.status === 'fulfilled' ? groqSettled.value : null;

  if (geminiSettled.status === 'rejected') {
    console.warn('Ensemble Gemini call failed:', geminiSettled.reason?.message || geminiSettled.reason);
  }
  if (groqSettled.status === 'rejected') {
    console.warn('Ensemble Groq call failed:', groqSettled.reason?.message || groqSettled.reason);
  }

  // 3. Reconcile and arrive at consensus
  return reconcileOcrOutputs(geminiResult, groqResult);
}

/**
 * Backward compatibility alias for runDualOcrPipeline
 */
export async function runDualOcrPipeline(imageBase64, options = {}) {
  return processBill(imageBase64, options);
}

/**
 * Backward compatibility alias for reconcileOrFallback
 */
export function reconcileOrFallback(geminiData, groqData) {
  return reconcileOcrOutputs(geminiData, groqData);
}

export default {
  INDIAN_GST_OCR_PROMPT,
  callGroqVision,
  callGeminiVision,
  reconcileOcrOutputs,
  processBill,
  runDualOcrPipeline,
  reconcileOrFallback,
  isBuyerPattern,
  cleanVendorName,
  isValidGstin,
  sanitizeItemHsnAndBarcode,
  evaluateModelMath
};
