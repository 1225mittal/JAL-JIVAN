export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GROQ_API_KEY is not configured in environment variables.' });
  }

  try {
    const { imageBase64 } = req.body || {};
    if (!imageBase64) {
      return res.status(400).json({ error: 'Missing imageBase64 in request body.' });
    }

    const cleanImage = imageBase64.startsWith('data:')
      ? imageBase64
      : `data:image/jpeg;base64,${imageBase64}`;

    const promptText = `Extract product name, Manufacturing Date (MFG), and Expiry Date (EXP/Use By/Best Before) from this packaging.
Today: 2026-09-25.
Return ONLY raw JSON without markdown:
{"detected":true,"product_name":"name","mfg_date":"YYYY-MM-DD or null","expiry_date":"YYYY-MM-DD or null","is_expired":true,"days_difference":-10,"reason":"explanation"}
If no product packaging or dates are clearly visible, return {"detected":false}.`;

    // Prioritize ultra-fast Groq LPU Vision models
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
            temperature: 0.0,
            max_tokens: 180
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          console.warn(`Groq model ${model} skipped (${response.status}):`, errText);
          lastError = new Error(`Groq model ${model} error (${response.status})`);
          continue;
        }

        data = await response.json();
        if (data?.choices?.[0]?.message?.content) {
          break;
        }
      } catch (err) {
        console.warn(`Groq fetch failure on model ${model}:`, err.message || err);
        lastError = err;
      }
    }

    if (!data?.choices?.[0]?.message?.content) {
      return res.status(502).json({
        error: lastError?.message || 'No response returned from Groq Vision API'
      });
    }

    const content = data.choices[0].message.content;
    const cleanJson = content.replace(/```json/g, '').replace(/```/g, '').trim();
    let parsed = JSON.parse(cleanJson);

    // Re-verify date math against reference date: 2026-09-25
    if (parsed.detected) {
      const auditDate = new Date('2026-09-25T00:00:00Z');
      const targetDateStr = parsed.expiry_date;
      if (targetDateStr) {
        try {
          const expDate = new Date(targetDateStr);
          if (!isNaN(expDate.getTime())) {
            const diffMs = expDate.getTime() - auditDate.getTime();
            const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
            parsed.days_difference = diffDays;
            parsed.is_expired = diffDays < 0;
          }
        } catch (_) {}
      }
    }

    return res.status(200).json(parsed);
  } catch (error) {
    console.error('Groq Expiry API Handler Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
