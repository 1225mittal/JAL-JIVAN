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

    const systemPrompt = `You are an automated FMCG product date auditor. Analyze the uploaded packaging photo carefully for manufacturing dates, expiry dates, and 'best before' duration. Today's date is 2026-09-25.
Respond ONLY with valid raw JSON (no markdown formatting, no explanations):
{
  "detected": boolean,
  "product_name": "string or unknown",
  "mfg_date": "YYYY-MM-DD or null",
  "expiry_date": "YYYY-MM-DD or null",
  "best_before_months": number or null,
  "computed_expiry_date": "YYYY-MM-DD or null",
  "is_expired": boolean,
  "days_difference": number,
  "notes": "string rationale"
}

Logic Rules:
1. If an explicit expiry date is visible (e.g., 'EXP 04/26', 'USE BY 10/25', 'EXPIRY 2026-08'), format as YYYY-MM-DD (use last day of month if only MM/YY is printed) and set expiry_date.
2. If only MFG date and 'Best Before X Months' are found, compute computed_expiry_date = mfg_date + best_before_months.
3. Compare the resolved date against 2026-09-25: mark is_expired: true if the date has passed (days_difference < 0), or false if still valid.
4. If dates are unreadable, blurry, or no product packaging date is visible, return "detected": false.`;

    const visionModels = ['llama-3.2-11b-vision-preview', 'llama-3.2-90b-vision-preview'];
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
                  { type: 'text', text: systemPrompt },
                  {
                    type: 'image_url',
                    image_url: { url: cleanImage }
                  }
                ]
              }
            ],
            temperature: 0.1
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          lastError = new Error(`Groq model ${model} failed (${response.status}): ${errText}`);
          continue;
        }

        data = await response.json();
        if (data?.choices?.[0]?.message?.content) {
          break;
        }
      } catch (err) {
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

    // Backend mathematical date verification against reference date: 2026-09-25
    const auditDate = new Date('2026-09-25T00:00:00Z');

    if (parsed.mfg_date && parsed.best_before_months && !parsed.computed_expiry_date) {
      try {
        const mfg = new Date(parsed.mfg_date);
        if (!isNaN(mfg.getTime())) {
          mfg.setMonth(mfg.getMonth() + Number(parsed.best_before_months));
          parsed.computed_expiry_date = mfg.toISOString().split('T')[0];
        }
      } catch (_) {}
    }

    const effectiveDateStr = parsed.expiry_date || parsed.computed_expiry_date;
    if (effectiveDateStr) {
      try {
        const expDate = new Date(effectiveDateStr);
        if (!isNaN(expDate.getTime())) {
          const diffMs = expDate.getTime() - auditDate.getTime();
          const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
          parsed.days_difference = diffDays;
          parsed.is_expired = diffDays < 0;
          parsed.detected = true;
        }
      } catch (_) {}
    }

    return res.status(200).json(parsed);
  } catch (error) {
    console.error('Groq Expiry API Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
