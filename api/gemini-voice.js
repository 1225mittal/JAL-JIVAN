export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured in environment variables.' });
  }

  try {
    const { audioBase64, mimeType } = req.body || {};
    if (!audioBase64) {
      return res.status(400).json({ error: 'Missing audioBase64 in request body' });
    }

    const cleanBase64 = audioBase64.includes(',') ? audioBase64.split(',')[1].trim() : audioBase64.trim();

    let cleanMimeType = (mimeType || 'audio/webm').split(';')[0].trim();
    if (!cleanMimeType.startsWith('audio/')) {
      cleanMimeType = 'audio/webm';
    }

    const promptText = `You are an Indian delivery dispatcher assistant. Listen carefully to this spoken delivery note (in Hindi, Hinglish, or English).
Extract order details strictly following these rules:
- delivery_address: Flat numbers, towers, block, society or colony names (e.g., "Ruby 1-505", "Tower B 402", "G-12 Shastri Nagar").
- customer_phone: Valid 10-digit Indian mobile number if spoken. If absent or only flat numbers given, set to "".
- customer_name: Person's name if mentioned, otherwise "".
- landmark: Nearby landmark if mentioned, otherwise "".
- items: Array of items mentioned with their quantity (e.g., "do Bisleri can" -> [{ item_name: "Bisleri", quantity: 2 }]).
- notes: Any special delivery instructions.

Return clean JSON matching:
{
  "delivery_address": "",
  "customer_name": "",
  "customer_phone": "",
  "landmark": "",
  "items": [{ "item_name": "string", "quantity": 1 }],
  "notes": ""
}`;

    const payload = {
      contents: [{
        role: "user",
        parts: [
          {
            text: promptText
          },
          {
            inlineData: {
              mimeType: cleanMimeType,
              data: cleanBase64
            }
          }
        ]
      }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1
      }
    };

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;

    let lastError = null;
    let geminiRes = null;

    // Retry up to 2 times for transient errors
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        geminiRes = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (geminiRes.ok) break;

        const errBody = await geminiRes.text();
        lastError = new Error(`Gemini status ${geminiRes.status}: ${errBody}`);
        if (geminiRes.status !== 503 && geminiRes.status !== 429) {
          break;
        }
        await new Promise((r) => setTimeout(r, 1000));
      } catch (networkErr) {
        lastError = networkErr;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    if (!geminiRes || !geminiRes.ok) {
      console.error('Gemini Voice API Error:', lastError);
      return res.status(geminiRes ? geminiRes.status : 500).json({
        error: lastError ? lastError.message : 'Failed to call Gemini Voice API'
      });
    }

    const data = await geminiRes.json();
    const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawContent) {
      return res.status(500).json({ error: 'No response content returned by Gemini' });
    }

    const cleaned = rawContent
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    const parsedJson = JSON.parse(cleaned);
    return res.status(200).json(parsedJson);
  } catch (error) {
    console.error('Error processing voice order:', error);
    return res.status(500).json({
      error: error.message || 'Internal server error while processing audio'
    });
  }
}
