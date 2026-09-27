export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY || req.body?.groqApiKey;

  try {
    const { imageBase64, imageUrl, mimeType } = req.body || {};
    const rawSource = imageBase64 || imageUrl;
    if (!rawSource) {
      return res.status(400).json({ error: 'Missing imageBase64 or imageUrl in request body.' });
    }

    let cleanImage = rawSource;
    if (!cleanImage.startsWith('data:') && !cleanImage.startsWith('http://') && !cleanImage.startsWith('https://')) {
      cleanImage = `data:${mimeType || 'image/jpeg'};base64,${cleanImage}`;
    } else if (cleanImage.startsWith('http://') || cleanImage.startsWith('https://')) {
      // If a remote URL is provided, pre-fetch to buffer for Groq Vision compatibility
      try {
        const fetchRes = await fetch(cleanImage);
        if (fetchRes.ok) {
          const arrayBuf = await fetchRes.arrayBuffer();
          const b64 = Buffer.from(arrayBuf).toString('base64');
          const contentType = fetchRes.headers.get('content-type') || mimeType || 'image/jpeg';
          cleanImage = `data:${contentType};base64,${b64}`;
        }
      } catch (urlFetchErr) {
        console.warn('Notice: Remote image URL could not be pre-fetched, passing URL directly to Groq:', urlFetchErr.message);
      }
    }

    // Schema prompt as requested
    const promptText = `You are an expert Indian GST tax invoice & purchase bill OCR extractor for retail, FMCG, and wholesale businesses.
Extract all details from this purchase bill / tax invoice image with extreme numerical precision.

STRICT INSTRUCTIONS:
1. "seller": Name of the wholesale vendor / distributor / agency, their GSTIN (15 chars), FSSAI license (14 digits), phone/contact, full address, and salesman name & mobile if printed.
2. "invoice": Invoice / Bill Number and Invoice Date in YYYY-MM-DD (or DD/MM/YYYY) format.
3. "bank_details": Bank name, Account number, and IFSC code of the seller if printed.
4. "items": Extract every line item / product accurately with full GST breakup:
   - "barcode": 8, 12, 13 or 14-digit EAN/UPC barcode number printed next to product or empty string if not found.
   - "item_name": Full product name with brand & packaging (e.g., "Bisleri 20L Water Can", "Parle-G 100g Box", "Tata Salt 1kg").
   - "hsn_code": 4 to 8 digit HSN/SAC code if printed.
   - "quantity": Numeric quantity purchased (units, cases, pcs, or boxes).
   - "mrp": Maximum Retail Price printed per unit.
   - "purchase_price": Base buying rate per unit before tax.
   - "taxable_amount": Total net taxable amount for this line before tax (quantity * purchase_price - discount).
   - "gst_pct": Total GST percentage (e.g. 0, 5, 12, 18, 28).
   - "cgst_pct": CGST percentage (typically gst_pct / 2).
   - "cgst_amount": CGST tax amount in rupees for this line.
   - "sgst_pct": SGST percentage (typically gst_pct / 2).
   - "sgst_amount": SGST tax amount in rupees for this line.
   - "cess_pct": Additional Cess percentage if applicable (or 0).
   - "cess_amount": Additional Cess amount in rupees if applicable (or 0).
   - "discount": Cash/Trade discount applied on this line in rupees.
   - "total_amount": Final landed cost in rupees after taxes (taxable_amount + cgst_amount + sgst_amount + cess_amount).
5. "totals":
   - "taxable_amount": Total taxable value of all items.
   - "cgst_total": Total CGST tax amount.
   - "sgst_total": Total SGST tax amount.
   - "cess_total": Total CESS tax amount.
   - "total_tax": Total combined tax amount.
   - "grand_total": Final net payable amount (Invoice Total).

RETURN STRICTLY A VALID JSON OBJECT WITH NO MARKDOWN OR EXTRA TEXT, EXACTLY MATCHING THIS STRUCTURE:
{
  "seller": {
    "name": "",
    "gst": "",
    "fssai": "",
    "contact": "",
    "address": "",
    "salesman_name": "",
    "salesman_number": ""
  },
  "invoice": {
    "invoice_number": "",
    "invoice_date": ""
  },
  "bank_details": {
    "bank_name": "",
    "account_no": "",
    "ifsc": ""
  },
  "items": [
    {
      "barcode": "",
      "item_name": "",
      "hsn_code": "",
      "quantity": 1,
      "mrp": 0,
      "purchase_price": 0,
      "taxable_amount": 0,
      "gst_pct": 18,
      "cgst_pct": 9,
      "cgst_amount": 0,
      "sgst_pct": 9,
      "sgst_amount": 0,
      "cess_pct": 0,
      "cess_amount": 0,
      "discount": 0,
      "total_amount": 0
    }
  ],
  "totals": {
    "taxable_amount": 0,
    "cgst_total": 0,
    "sgst_total": 0,
    "cess_total": 0,
    "total_tax": 0,
    "grand_total": 0
  }
}`;

    // If no GROQ_API_KEY is available, return an intelligent mock extraction so the user can test the UI
    if (!apiKey) {
      console.warn('GROQ_API_KEY not configured. Generating realistic Indian purchase bill data for preview.');
      const demoData = {
        seller: {
          name: "Shree Ganesh Beverage & FMCG Distributors",
          gst: "07AAACR1234K1Z5",
          fssai: "10020011000123",
          contact: "+91 9811223344",
          address: "Shop 14, New Mandi Complex, GT Road, Ghaziabad, UP - 201001",
          salesman_name: "Rahul Verma",
          salesman_number: "+91 9876543210"
        },
        invoice: {
          invoice_number: `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
          invoice_date: new Date().toISOString().split('T')[0]
        },
        bank_details: {
          bank_name: "HDFC Bank",
          account_no: "50200088991122",
          ifsc: "HDFC0001234"
        },
        items: [
          {
            barcode: "8901234001015",
            item_name: "20L Polycarbonate Water Can (Aqua Refill)",
            hsn_code: "2201",
            quantity: 50,
            mrp: 90,
            purchase_price: 45,
            taxable_amount: 2250.00,
            gst_pct: 18,
            cgst_pct: 9,
            cgst_amount: 202.50,
            sgst_pct: 9,
            sgst_amount: 202.50,
            cess_pct: 0,
            cess_amount: 0,
            discount: 0,
            total_amount: 2655.00
          },
          {
            barcode: "8901234002029",
            item_name: "1L Packaged Mineral Water (Pack of 12 Bottles)",
            hsn_code: "2201",
            quantity: 20,
            mrp: 240,
            purchase_price: 130,
            taxable_amount: 2500.00,
            gst_pct: 18,
            cgst_pct: 9,
            cgst_amount: 225.00,
            sgst_pct: 9,
            sgst_amount: 225.00,
            cess_pct: 0,
            cess_amount: 0,
            discount: 100,
            total_amount: 2950.00
          },
          {
            barcode: "8901234003033",
            item_name: "Dispenser Tap & Silicone Seal Replacement Pack",
            hsn_code: "3926",
            quantity: 10,
            mrp: 120,
            purchase_price: 65,
            taxable_amount: 650.00,
            gst_pct: 18,
            cgst_pct: 9,
            cgst_amount: 58.50,
            sgst_pct: 9,
            sgst_amount: 58.50,
            cess_pct: 0,
            cess_amount: 0,
            discount: 0,
            total_amount: 767.00
          }
        ],
        totals: {
          taxable_amount: 5400.00,
          cgst_total: 486.00,
          sgst_total: 486.00,
          cess_total: 0.00,
          total_tax: 972.00,
          grand_total: 6372.00
        },
        _is_demo_preview: true
      };
      return res.status(200).json(demoData);
    }

    // Call Groq Vision API
    const visionModels = [
      'llama-3.2-11b-vision-preview',
      'llama-3.2-90b-vision-preview',
      'qwen/qwen3.8-27b'
    ];

    let lastError = null;
    let data = null;

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
                  {
                    type: 'text',
                    text: promptText
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: cleanImage
                    }
                  }
                ]
              }
            ],
            temperature: 0.1,
            max_tokens: 2048
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          console.warn(`Groq Vision model ${model} error (${response.status}):`, errText);
          lastError = new Error(`Groq ${model} status ${response.status}: ${errText}`);
          continue;
        }

        data = await response.json();
        if (data?.choices?.[0]?.message?.content) {
          break;
        }
      } catch (err) {
        console.warn(`Groq fetch exception on model ${model}:`, err.message || err);
        lastError = err;
      }
    }

    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      return res.status(502).json({
        error: lastError?.message || 'No response returned from Groq Vision API'
      });
    }

    const cleanJson = content.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);
    return res.status(200).json(parsed);
  } catch (err) {
    console.error('purchase-ocr handler error:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error during invoice OCR processing' });
  }
}
