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

    const prompt = `Analyze this handwritten order slip or invoice photo carefully. Extract the order details into this EXACT raw JSON structure (no markdown formatting, no backticks, just raw valid json):
{
  "customer_name": "string or empty",
  "customer_phone": "string or empty",
  "delivery_address": "string or empty",
  "landmark": "string or empty",
  "items": [
    { "item_name": "string", "quantity": 1, "price": 0 }
  ],
  "total_amount": 0,
  "notes": "string or empty"
}`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.2-11b-vision-preview',
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
