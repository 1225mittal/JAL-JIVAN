export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GROQ_API_KEY is not configured in environment variables.' });
  }

  try {
    const { imageBase64, mimeType } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'Missing imageBase64 in request body' });
    }

    const cleanBase64 = imageBase64.startsWith('data:')
      ? imageBase64
      : `data:${mimeType || 'image/jpeg'};base64,${imageBase64}`;

    const prompt = `You are an expert Indian quick-commerce OCR parser for delivery notes and slips.
Analyze this handwritten note carefully.

Rules for field parsing:
1. DELIVERY ADDRESS & FLAT NUMBERS:
   - Phrases like "Ruby 1-505", "Tower B 402", "G-12", "Flat 304", or society names are ALWAYS the "delivery_address", NEVER a customer name or phone number.
   - Set "delivery_address" to whatever tower/flat/house/society is written (e.g. "Ruby 1-505").
2. CUSTOMER PHONE:
   - MUST be a valid 10-digit Indian mobile number (e.g., starts with 6, 7, 8, or 9).
   - NEVER put flat numbers, hyphenated numbers like "1-505", or item counts into "customer_phone". If no 10-digit number exists, leave it as "".
3. CUSTOMER NAME:
   - Only set if an actual person's name is explicitly written. If only an apartment or flat is written, leave "customer_name" as "".
4. ITEMS & PRODUCTS:
   - Extract item names and quantities. For example: "1 Bisleri", "2 20L", "Bisleri 20L" -> item_name: "Bisleri", quantity: 1.
   - If a standard 20L Bisleri can or jar is implied without price, default price to 0 or leave for catalog lookup.

Return EXACT raw JSON matching this schema:
{
  "customer_name": "",
  "customer_phone": "",
  "delivery_address": "Ruby 1-505",
  "landmark": "",
  "items": [
    { "item_name": "Bisleri", "quantity": 1, "price": 0 }
  ],
  "total_amount": 0,
  "notes": ""
}`;

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
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: cleanBase64
                }
              }
            ]
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
      return res.status(502).json({ error: 'No content returned from Groq' });
    }

    const cleanJson = content.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);
    return res.status(200).json(parsed);
  } catch (error) {
    console.error('Groq OCR Backend Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
