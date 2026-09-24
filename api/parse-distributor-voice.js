export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { transcript } = req.body || {};
  if (!transcript || typeof transcript !== 'string') {
    return res.status(400).json({ error: 'Transcript string is required in request body.' });
  }

  const rawTranscript = transcript.trim();
  const groqApiKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

  // 1. Try Groq AI extraction if API key is present
  if (groqApiKey) {
    try {
      const systemPrompt = `You are an expert bilingual Indian FMCG retail data assistant.
Your task is to parse a spoken voice note (in English, Hindi, or Hinglish) containing distributor registration details into structured JSON.

Return STRICTLY raw JSON matching this schema:
{
  "distributor_name": "",
  "company_name": "",
  "product_categories": "",
  "salesman_name": "",
  "salesman_phone": "",
  "visit_day": "Monday",
  "claim_window_preset": "1st - 10th",
  "claim_window_start": 1,
  "claim_window_end": 10,
  "settlement_mode": "Credit Note (CN)",
  "return_eligibility": ["Expired Stock", "Damage / Breakage / Leakage"],
  "notes": ""
}

RULES:
1. "distributor_name": Agency or distributor trade name (e.g. "Laxmi Agency", "Shree Balaji Enterprises", "Krishna Traders"). Strip conversational words like "hamara distributor", "agency name".
2. "company_name": FMCG Company or Brand (e.g. "Britannia", "Parle", "Bisleri", "Tata Consumer", "Nestle", "ITC", "Amul", "Hindustan Unilever"). Strip words like "company", "brand", "ki".
3. "product_categories": Specific categories/lines (e.g. "Biscuits", "Personal Care & Soaps", "Tea & Spices", "Snacks").
4. "salesman_name": Sales representative name. Strip honorifics like "ji", "bhaiya", "bhai", "salesman".
5. "salesman_phone": 10-digit Indian phone number (starting with 6-9, digits only).
6. "visit_day": Must be STRICTLY one of: "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday". Default to "Monday".
7. "claim_window_preset": Must be STRICTLY one of:
   - "1st - 10th"
   - "15th - 30th"
   - "20th - End of Month"
   - "Anytime / Weekly Visit"
   - "Custom Range"
8. "claim_window_start": Day of month number (1 to 31). Default 1.
9. "claim_window_end": Day of month number (1 to 31). Default 10.
10. "settlement_mode": "Credit Note (CN)" | "Replacement Goods" | "Bill Adjustment". Default "Credit Note (CN)".
11. "notes": Any additional instructions or schedule details.`;

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqApiKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Extract details from this spoken transcript:\n"${rawTranscript}"` }
          ],
          temperature: 0.1
        })
      });

      if (response.ok) {
        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content;
        if (content) {
          const cleanJson = content.replace(/```json/gi, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleanJson);
          return res.status(200).json(parsed);
        }
      } else {
        console.warn('Groq distributor voice parsing returned status:', response.status);
      }
    } catch (groqErr) {
      console.warn('Groq parsing failed, continuing fallback:', groqErr.message);
    }
  }

  // 2. Try Gemini if configured
  if (geminiApiKey) {
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: geminiApiKey });
      const prompt = `Parse this spoken Indian distributor registration note into valid JSON:
"${rawTranscript}"

Schema:
{
  "distributor_name": string,
  "company_name": string,
  "product_categories": string,
  "salesman_name": string,
  "salesman_phone": string (10 digits),
  "visit_day": "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday",
  "claim_window_preset": "1st - 10th" | "15th - 30th" | "20th - End of Month" | "Anytime / Weekly Visit" | "Custom Range",
  "claim_window_start": number,
  "claim_window_end": number,
  "settlement_mode": "Credit Note (CN)" | "Replacement Goods" | "Bill Adjustment",
  "return_eligibility": string[],
  "notes": string
}`;

      const geminiRes = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });

      if (geminiRes.text) {
        const clean = geminiRes.text.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(clean);
        return res.status(200).json(parsed);
      }
    } catch (geminiErr) {
      console.warn('Gemini parsing failed, continuing fallback:', geminiErr.message);
    }
  }

  // 3. Fallback regex & marker extraction if no LLM key configured or LLM network error
  const raw = rawTranscript;

  // Day detection
  let visitDay = 'Monday';
  if (/wednesday|budhwar|budhvaar|बुधवार|वेनसडे|वेडनसडे|वेडनेसडे/iu.test(raw)) visitDay = 'Wednesday';
  else if (/tuesday|mangalwar|mangalvaar|मंगलवार|ट्यूजडे|ट्यूसडे/iu.test(raw)) visitDay = 'Tuesday';
  else if (/thursday|guruwar|guruvaar|brihaspatiwar|veerwar|गुरुवार|वीरवार|थर्सडे/iu.test(raw)) visitDay = 'Thursday';
  else if (/friday|shukrawar|shukravaar|शुक्रवार|जुम्मा|फ्राइडे/iu.test(raw)) visitDay = 'Friday';
  else if (/saturday|shaniwar|shanivaar|शनिवार|सैटरडे/iu.test(raw)) visitDay = 'Saturday';
  else if (/sunday|raviwar|itwar|रविवार|इतवार|संडे/iu.test(raw)) visitDay = 'Sunday';
  else if (/monday|somwar|somvaar|सोमवार|मंडे/iu.test(raw)) visitDay = 'Monday';

  // Claim window detection
  let preset = '1st - 10th';
  let start = 1;
  let end = 10;
  if (/anytime|kabhi\s*bhi/iu.test(raw)) {
    preset = 'Anytime / Weekly Visit';
    start = 1;
    end = 31;
  } else if (/15\s*(?:th|to|-|se)\s*30/iu.test(raw)) {
    preset = '15th - 30th';
    start = 15;
    end = 30;
  } else if (/20\s*(?:th|to|-|se)|end\s*of\s*month/iu.test(raw)) {
    preset = '20th - End of Month';
    start = 20;
    end = 31;
  }

  // Phone number extraction
  let phone = '';
  const digitsMatch = raw.match(/(?:phone|mobile|contact|फ़ोन|फोन|मोबाइल|नंबर|number|ph)?\s*[:\-]?\s*([0-9\s\-]{8,14})/iu);
  if (digitsMatch) {
    const cleanDigits = digitsMatch[1].replace(/\D/g, '');
    if (cleanDigits.length >= 8) phone = cleanDigits.slice(-10);
  }

  // Multi-marker extraction
  const MARKERS = [
    { key: 'distributor_prefix', type: 'distributor_prefix', regex: /(?:^|[\s,;:\n])(?:distributor(?:\s*name)?|डिस्ट्रीब्यूटर(?:\s*का\s*नाम|\s*नाम|\s*नेम)?|hamara\s*distributor|hamari\s*agency|apni\s*agency)(?=[\s,;:\n]|$)/iu },
    { key: 'distributor_suffix', type: 'distributor_suffix', regex: /(?:^|[\s,;:\n])(?:agency|traders?|enterprises?|distributors?|एजेंसी|ट्रेडर्स|ट्रेडिंग|एंटरप्राइजेज|डिस्ट्रीब्यूटर|फर्म)(?=[\s,;:\n]|$)/iu },
    { key: 'company', type: 'company', regex: /(?:^|[\s,;:\n])(?:company(?:\s*name)?|brand(?:\s*name)?|कंपनी(?:\s*का\s*नाम|\s*नेम|\s*नाम)?|ब्रांड(?:\s*का\s*नाम|\s*नेम|\s*नाम)?|fmcg)(?=[\s,;:\n]|$)/iu },
    { key: 'categories', type: 'categories', regex: /(?:^|[\s,;:\n])(?:categories|category|products?|items?|प्रोडक्ट्स?|कैटेगरी|कैटगरी|सामान|आइटम्स?|माल)(?=[\s,;:\n]|$)/iu },
    { key: 'salesman', type: 'salesman', regex: /(?:^|[\s,;:\n])(?:salesman(?:\s*name)?|sales\s*person|sales\s*boy|sales\s*rep|सेल्समैन|सेल्स\s*बॉय|सेल्स\s*पर्सन|सेल्स)(?=[\s,;:\n]|$)/iu }
  ];

  const found = [];
  MARKERS.forEach((m) => {
    const r = new RegExp(m.regex.source, 'giu');
    let match;
    while ((match = r.exec(raw)) !== null) {
      found.push({
        key: m.key,
        type: m.type,
        start: match.index,
        end: match.index + match[0].length
      });
    }
  });

  found.sort((a, b) => a.start - b.start);
  const primaryMarkers = [];
  const seenTypes = new Set();
  for (const m of found) {
    if (!seenTypes.has(m.type)) {
      seenTypes.add(m.type);
      primaryMarkers.push(m);
    }
  }
  primaryMarkers.sort((a, b) => a.start - b.start);

  const companyMarker = primaryMarkers.find((m) => m.type === 'company');
  const distPrefix = primaryMarkers.find((m) => m.type === 'distributor_prefix');
  const distSuffix = primaryMarkers.find((m) => m.type === 'distributor_suffix');
  const catMarker = primaryMarkers.find((m) => m.type === 'categories');
  const salesMarker = primaryMarkers.find((m) => m.type === 'salesman');

  let rawDistributor = '';
  if (distPrefix) {
    const nextMarker = primaryMarkers.find((m) => m.start > distPrefix.start && m.type !== 'distributor_suffix');
    rawDistributor = raw.slice(distPrefix.end, nextMarker ? nextMarker.start : undefined);
  } else if (distSuffix) {
    rawDistributor = raw.slice(0, distSuffix.end);
  } else if (companyMarker && companyMarker.start > 0) {
    rawDistributor = raw.slice(0, companyMarker.start);
  }

  let rawCompany = '';
  if (companyMarker) {
    const nextMarker = primaryMarkers.find((m) => m.start > companyMarker.start);
    rawCompany = raw.slice(companyMarker.end, nextMarker ? nextMarker.start : undefined);
  }

  let rawCategories = '';
  if (catMarker) {
    const nextMarker = primaryMarkers.find((m) => m.start > catMarker.start);
    rawCategories = raw.slice(catMarker.end, nextMarker ? nextMarker.start : undefined);
  }

  let rawSalesman = '';
  if (salesMarker) {
    const nextMarker = primaryMarkers.find((m) => m.start > salesMarker.start);
    rawSalesman = raw.slice(salesMarker.end, nextMarker ? nextMarker.start : undefined);
  }

  function clean(val) {
    if (!val) return '';
    return val
      .replace(/^(?:brand\s*name|company\s*name|distributor\s*name|naam|name|नेम|नाम|की|का|के|है|hai|is)\s*[:\-]?\s*/iu, '')
      .replace(/\s+(?:ki|ka|ke|hai|he|h)$/iu, '')
      .replace(/^[,\.:;\s]+|[,\.:;\s]+$/g, '')
      .trim();
  }

  return res.status(200).json({
    distributor_name: clean(rawDistributor),
    company_name: clean(rawCompany),
    product_categories: clean(rawCategories),
    salesman_name: clean(rawSalesman),
    salesman_phone: phone,
    visit_day: visitDay,
    claim_window_preset: preset,
    claim_window_start: start,
    claim_window_end: end,
    settlement_mode: 'Credit Note (CN)',
    return_eligibility: ['Expired Stock', 'Damage / Breakage / Leakage'],
    notes: ''
  });
}
