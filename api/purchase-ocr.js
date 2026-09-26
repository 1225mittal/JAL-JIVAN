export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY || req.body?.groqApiKey;

  try {
    const { imageBase64, mimeType } = req.body || {};
    if (!imageBase64) {
      return res.status(400).json({ error: 'Missing imageBase64 in request body.' });
    }

    const cleanImage = imageBase64.startsWith('data:')
      ? imageBase64
      : `data:${mimeType || 'image/jpeg'};base64,${imageBase64}`;

    // Schema prompt as requested
    const promptText = `You are an expert Indian GST tax invoice & purchase bill OCR extractor for retail, FMCG, and wholesale businesses.
Extract all details from this purchase bill / tax invoice image accurately.

STRICT INSTRUCTIONS:
1. "seller": Name of the wholesale vendor / distributor / agency, their GSTIN (15 chars), FSSAI license (14 digits), phone/contact, full address, and salesman name & mobile if printed.
2. "invoice": Invoice / Bill Number and Invoice Date in YYYY-MM-DD (or DD/MM/YYYY) format.
3. "bank_details": Bank name, Account number, and IFSC code of the seller if printed.
4. "items": Extract every line item / product accurately:
   - "item_name": Full product name with brand & packaging (e.g., "Bisleri 20L Water Can", "Parle-G 100g Box", "Tata Salt 1kg").
   - "hsn_code": 4 to 8 digit HSN/SAC code if printed.
   - "quantity": Numeric quantity purchased (units, cases, pcs, or boxes).
   - "mrp": Maximum Retail Price printed per unit.
   - "purchase_price": Base buying rate per unit before tax or standard rate.
   - "price_before_gst": Net taxable rate or amount before GST.
   - "gst_rate": Combined GST percentage (e.g. 0, 5, 12, 18, 28).
   - "cess": Additional Cess amount or percentage if applicable.
   - "discount": Cash/Trade discount applied per item or in percentage.
   - "price_after_gst": Final landed cost per unit after taxes and discounts.
5. "totals":
   - "taxable_amount": Total taxable value of all items.
   - "total_tax": Total CGST + SGST + IGST tax amount.
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
      "item_name": "",
      "hsn_code": "",
      "quantity": 1,
      "mrp": 0,
      "purchase_price": 0,
      "price_before_gst": 0,
      "gst_rate": 0,
      "cess": 0,
      "discount": 0,
      "price_after_gst": 0
    }
  ],
  "totals": {
    "taxable_amount": 0,
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
            item_name: "20L Polycarbonate Water Can (Aqua Refill)",
            hsn_code: "2201",
            quantity: 50,
            mrp: 90,
            purchase_price: 45,
            price_before_gst: 45,
            gst_rate: 18,
            cess: 0,
            discount: 0,
            price_after_gst: 53.10
          },
          {
            item_name: "1L Packaged Mineral Water (Pack of 12 Bottles)",
            hsn_code: "2201",
            quantity: 20,
            mrp: 240,
            purchase_price: 130,
            price_before_gst: 130,
            gst_rate: 18,
            cess: 0,
            discount: 5,
            price_after_gst: 147.50
          },
          {
            item_name: "Dispenser Tap & Silicone Seal Replacement Pack",
            hsn_code: "3926",
            quantity: 10,
            mrp: 120,
            purchase_price: 65,
            price_before_gst: 65,
            gst_rate: 18,
            cess: 0,
            discount: 0,
            price_after_gst: 76.70
          }
        ],
        totals: {
          taxable_amount: 5450.00,
          total_tax: 981.00,
          grand_total: 6431.00
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
