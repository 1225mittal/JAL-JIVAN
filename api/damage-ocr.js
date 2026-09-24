export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GROQ_API_KEY is not configured in environment variables.' });
  }

  try {
    const { frontImageBase64, backImageBase64, mimeType } = req.body || {};
    if (!frontImageBase64 && !backImageBase64) {
      return res.status(400).json({ error: 'At least one package image (front or back) is required.' });
    }

    const contentArray = [
      {
        type: 'text',
        text: `You are an expert Indian FMCG, grocery, and packaged goods OCR inspector.
Analyze these package photos of a damaged or expired product in a store/warehouse godown.
Inspect both the front label (brand, product name, weight) and back/side packaging (MRP, batch number, manufacturing date, expiry date / best before).

Rules for parsing:
1. "product_name": Full product name and sub-brand (e.g. "Parle-G Gold Biscuits", "Bisleri Mineral Water 20L", "Tata Tea Gold", "Surf Excel Easy Wash").
2. "company_name": FMCG Company / Brand name (e.g. "Parle", "Bisleri", "Tata Consumer", "Nestle", "Hindustan Unilever", "Britannia", "ITC", "Amul").
3. "mrp": Numeric MRP in INR (e.g. 10, 45.50, 180). Look for "MRP ₹", "M.R.P. Rs.", or stamped price on the flap/crimped edges.
4. "net_weight_volume": Net weight or volume including unit (e.g. "20L", "100g", "1 kg", "500ml").
5. "batch_no": Batch number or Lot number printed or stamped on the pack (e.g. "B2401", "LOT 89X").
6. "mfg_date": Manufacturing date (e.g. "12/03/2024", "03/24"). If only "Best before 6 months from mfg" is present, calculate or extract the printed mfg date.
7. "expiry_date": Expiry date or Use By date (e.g. "12/09/2024", "09/2024").
8. "damage_type": Suggest either "Damage" (torn, crushed, broken, leaking) or "Expired" (past expiry date) based on your observation.

Return STRICTLY raw JSON matching this schema:
{
  "product_name": "",
  "company_name": "",
  "mrp": 0,
  "net_weight_volume": "",
  "batch_no": "",
  "mfg_date": "",
  "expiry_date": "",
  "damage_type": "Damage"
}`
      }
    ];

    if (frontImageBase64) {
      const cleanFront = frontImageBase64.startsWith('data:')
        ? frontImageBase64
        : `data:${mimeType || 'image/jpeg'};base64,${frontImageBase64}`;
      contentArray.push({
        type: 'image_url',
        image_url: { url: cleanFront }
      });
    }

    if (backImageBase64) {
      const cleanBack = backImageBase64.startsWith('data:')
        ? backImageBase64
        : `data:${mimeType || 'image/jpeg'};base64,${backImageBase64}`;
      contentArray.push({
        type: 'image_url',
        image_url: { url: cleanBack }
      });
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'qwen/qwen3.8-27b',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: contentArray
          }
        ],
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: `Groq Vision Error: ${errText}` });
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      return res.status(502).json({ error: 'No content returned from Groq Vision' });
    }

    const cleanJson = content.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);
    return res.status(200).json(parsed);
  } catch (error) {
    console.error('Damage OCR Backend Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
