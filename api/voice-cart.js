/**
 * API Route for Gemini Voice-to-Cart Parser
 * Primary Engine: Google Gemini 2.5 Flash
 * Fallback: Groq Qwen/Llama
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || req.body?.geminiApiKey;
  const groqApiKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY || req.body?.groqApiKey;

  try {
    const { transcript, promptText, catalogItems = [] } = req.body || {};
    const textToParse = (transcript || promptText || '').trim();

    if (!textToParse) {
      return res.status(400).json({ error: 'Missing transcript or promptText in request body' });
    }

    // Prepare catalog sample/context (names and barcodes)
    const catalogContext = (catalogItems || []).slice(0, 80).map((it) => ({
      name: it.item_name || it.name,
      barcode: it.barcode || '',
      price: it.selling_price || it.mrp || 0,
      unit: it.unit || 'PCS'
    }));

    const systemPrompt = `You are an expert Indian quick-commerce and retail POS billing voice assistant.
The customer or cashier spoke in Hindi, Hinglish, or English: "${textToParse}".

Here is the store's current item catalog:
${JSON.stringify(catalogContext, null, 2)}

TASK:
1. Identify all spoken products/items and their requested quantities from the user's speech.
2. If the user mentions Hindi quantities (e.g. "ek" -> 1, "do" -> 2, "teen" -> 3, "char" -> 4, "panch" -> 5, "das" -> 10, "aadha" -> 0.5, "dhai" -> 2.5), map them to numeric quantities.
3. Match each mentioned product to the most relevant catalog product name from the list above. If not in the list, use a clean normalized name.
4. Default quantity to 1 if no quantity was specified.

Return ONLY a strict valid JSON array matching this exact schema:
[
  {
    "item_name": "Matched or clean Product Name",
    "barcode": "Barcode if matched from catalog, or empty string",
    "qty": 1
  }
]`;

    // 1. Try Google Gemini 2.5 Flash
    if (geminiApiKey) {
      try {
        const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;
        const geminiResponse = await fetch(geminiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: systemPrompt }]
              }
            ],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: 'application/json'
            }
          })
        });

        if (geminiResponse.ok) {
          const geminiData = await geminiResponse.json();
          const rawContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawContent) {
            const cleanJson = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanJson);
            if (Array.isArray(parsed)) {
              return res.status(200).json({ items: parsed, transcript: textToParse });
            }
          }
        }
      } catch (geminiErr) {
        console.warn('Gemini Voice parse failed, attempting Groq fallback:', geminiErr.message);
      }
    }

    // 2. Fallback to Groq if configured
    if (groqApiKey) {
      try {
        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqApiKey}`
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            response_format: { type: 'json_object' },
            messages: [
              {
                role: 'system',
                content: 'You must return a JSON object with key "items" containing the array of parsed items: { "items": [ { "item_name": "...", "barcode": "...", "qty": 1 } ] }'
              },
              {
                role: 'user',
                content: systemPrompt
              }
            ],
            temperature: 0.1
          })
        });

        if (groqApiKey && groqResponse.ok) {
          const groqData = await groqResponse.json();
          const content = groqData.choices?.[0]?.message?.content;
          if (content) {
            const parsed = JSON.parse(content);
            const items = Array.isArray(parsed) ? parsed : (parsed.items || []);
            return res.status(200).json({ items, transcript: textToParse });
          }
        }
      } catch (groqErr) {
        console.warn('Groq Voice parse fallback failed:', groqErr.message);
      }
    }

    // 3. Fallback Heuristic Parser (Offline or No API Key)
    const fallbackItems = parseHindiVoiceHeuristically(textToParse, catalogContext);
    return res.status(200).json({ items: fallbackItems, transcript: textToParse, _is_offline_fallback: true });
  } catch (err) {
    console.error('Voice Cart Route Error:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}

/**
 * Intelligent Rule-Based Voice Parser for Hindi/Hinglish/English
 */
function parseHindiVoiceHeuristically(text, catalog = []) {
  const numberWords = {
    'ek': 1, 'do': 2, 'teen': 3, 'char': 4, 'panch': 5, 'chhe': 6, 'saat': 7, 'aath': 8, 'nau': 9, 'das': 10,
    'gyarah': 11, 'barah': 12, 'terah': 13, 'chaudah': 14, 'pandrah': 15, 'beed': 20, 'bees': 20, 'pachis': 25,
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
  };

  const segments = text.split(/(?:aur|and|plus|,|\+)/i).map((s) => s.trim()).filter(Boolean);
  const results = [];

  for (const seg of segments) {
    let qty = 1;
    let cleanSeg = seg;

    // Check for leading or embedded number
    const numMatch = seg.match(/^(\d+(?:\.\d+)?)\s*(?:packet|can|bottle|jar|box|piece|pcs|nos|kg|gm)?\s*(.*)$/i);
    if (numMatch) {
      qty = parseFloat(numMatch[1]) || 1;
      cleanSeg = (numMatch[2] || '').trim();
    } else {
      // Check word number
      for (const [w, val] of Object.entries(numberWords)) {
        const regex = new RegExp(`\\b${w}\\b`, 'i');
        if (regex.test(seg)) {
          qty = val;
          cleanSeg = seg.replace(regex, '').replace(/\b(?:packet|can|bottle|jar|box|piece|pcs|nos|kg|gm)\b/gi, '').trim();
          break;
        }
      }
    }

    if (!cleanSeg) continue;

    // Match against catalog
    let matchedItem = null;
    const lowerQuery = cleanSeg.toLowerCase();
    for (const cat of catalog) {
      const catLower = (cat.name || '').toLowerCase();
      if (catLower.includes(lowerQuery) || lowerQuery.includes(catLower)) {
        matchedItem = cat;
        break;
      }
    }

    results.push({
      item_name: matchedItem ? matchedItem.name : cleanSeg,
      barcode: matchedItem ? matchedItem.barcode : '',
      qty
    });
  }

  return results.length > 0 ? results : [{ item_name: text, qty: 1, barcode: '' }];
}
