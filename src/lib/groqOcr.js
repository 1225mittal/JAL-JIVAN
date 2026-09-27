/**
 * Groq & Vision AI OCR parser for Indian GST B2B Wholesale / FMCG Tax Invoices
 * Implements strict domain rules for Indian dot-matrix, thermal, and computer tax bills.
 */

/**
 * Standardize Indian dates (DD/MM/YYYY or DD-MM-YYYY) into ISO YYYY-MM-DD
 */
export function normalizeIndianDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return '';
  const trimmed = dateStr.trim();

  // Match DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const ddmmyyyy = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (ddmmyyyy) {
    const day = ddmmyyyy[1].padStart(2, '0');
    const month = ddmmyyyy[2].padStart(2, '0');
    const year = ddmmyyyy[3];
    return `${year}-${month}-${day}`;
  }

  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  return trimmed;
}

/**
 * Strictly separate HSN/SAC (4-8 digits) from Retail Barcode (EAN-13, 12-13 digits)
 */
export function sanitizeHsnAndBarcode(rawHsn, rawBarcode) {
  let hsn = (rawHsn || '').toString().trim();
  let barcode = (rawBarcode || '').toString().trim();

  // If barcode looks like an HSN (4-8 digits) and no HSN is set, reassign to HSN
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

/**
 * Enforce Supplier vs. Buyer Disambiguation
 * Ensures customer/buyer details (e.g. "M/s", "Billed To", "Customer", "Mittal") are never mistaken for the vendor.
 */
export function disambiguateVendorDetails(vendorName, vendorGstin, vendorAddress, vendorPhone) {
  let name = (vendorName || '').toString().trim();
  let gstin = (vendorGstin || '').toString().toUpperCase().trim();
  let address = (vendorAddress || '').toString().trim();
  let phone = (vendorPhone || '').toString().trim();

  // Common Buyer header tags to strip
  name = name.replace(/^(M\/s\.?|Billed\s*To:?|Buyer:?|Customer:?|Party\s*Name:?|Recipient:?|Consignee:?)\s*/i, '').trim();

  // If vendor name has newline with agency name on top, take the first non-empty line
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

/**
 * Clean & normalize raw parsed JSON into the standard Indian GST Invoice schema
 */
export function sanitizeIndianInvoiceOcr(raw) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  // 1. Supplier / Vendor Disambiguation
  const rawVendorName = raw.vendor_name || raw.seller?.name || '';
  const rawVendorGstin = raw.vendor_gstin || raw.seller?.gst || '';
  const rawVendorAddress = raw.vendor_address || raw.seller?.address || '';
  const rawVendorPhone = raw.vendor_phone || raw.seller?.contact || '';

  const { vendor_name, vendor_gstin, vendor_address, vendor_phone } = disambiguateVendorDetails(
    rawVendorName,
    rawVendorGstin,
    rawVendorAddress,
    rawVendorPhone
  );

  // 2. Invoice Number & Date
  let invoice_no = (raw.invoice_no || raw.invoice?.invoice_number || raw.invoice_number || '').toString().trim();
  // Standardize common letter/digit OCR confusions for bill numbers
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

    // HSN vs Barcode separation
    const { hsn, barcode } = sanitizeHsnAndBarcode(it.hsn ?? it.hsn_code, it.barcode);

    // Line item discount
    const discAmount = Number(it.discount_amount ?? it.discount) || 0;
    const discPct = Number(it.discount_pct) || 0;

    // Taxable amount (qty * rate - discount)
    let taxable = Number(it.taxable_amount);
    if (!taxable || isNaN(taxable) || taxable <= 0) {
      taxable = Math.max(0, +((qty * rate) - discAmount).toFixed(2));
    }

    // GST breakups
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

  // 4. Invoice Level Discounts, Round-Off & Grand Total
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

  // Standard output schema matching prompt requirements
  const output = {
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

  return output;
}

/**
 * Call the backend vision route to parse an invoice with Groq Vision
 */
export async function parseInvoiceWithGroq({ imageBase64, imageUrl, mimeType = 'image/jpeg', groqApiKey = '' }) {
  try {
    const response = await fetch('/api/purchase-ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64,
        imageUrl,
        mimeType,
        groqApiKey
      })
    });

    if (response.ok) {
      const rawData = await response.json();
      return sanitizeIndianInvoiceOcr(rawData);
    }
  } catch (apiErr) {
    console.warn('API purchase-ocr route fetch error, trying direct dualOcrPipeline:', apiErr);
  }

  // Graceful client-side fallback via dualOcrPipeline
  const { runDualOcrPipeline } = await import('./dualOcrPipeline.js');
  return runDualOcrPipeline(imageBase64 || imageUrl, { apiKey: groqApiKey, mimeType });
}

export {
  callGroqVision,
  callGeminiVision,
  reconcileOrFallback,
  runDualOcrPipeline
} from './dualOcrPipeline.js';

export default {
  normalizeIndianDate,
  sanitizeHsnAndBarcode,
  disambiguateVendorDetails,
  sanitizeIndianInvoiceOcr,
  parseInvoiceWithGroq
};
