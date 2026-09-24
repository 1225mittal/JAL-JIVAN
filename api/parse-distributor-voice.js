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
  "salesman_name": "",
  "salesman_phone": "",
  "visit_day": "Monday",
  "return_window_rule": "Anytime / कभी भी",
  "notes": ""
}

RULES:
1. "distributor_name": Agency or distributor trade name (e.g. "Laxmi Agency", "Shree Balaji Enterprises", "Krishna Traders").
2. "company_name": FMCG Company or Brand (e.g. "Britannia", "Parle", "Bisleri", "Tata Consumer", "Nestle", "ITC", "Amul").
3. "salesman_name": Sales representative or salesman's first/last name. Strip honorifics like "ji", "bhaiya", "bhai".
4. "salesman_phone": 10-digit Indian phone number (starting with 6-9, digits only). Empty string if not mentioned.
5. "visit_day": Must be STRICTLY one of: "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday".
   (e.g., Somwar -> Monday, Mangalwar -> Tuesday, Budhwar -> Wednesday, Guruwar/Brihaspatiwar -> Thursday, Shukrawar -> Friday, Shaniwar -> Saturday, Raviwar/Itwar -> Sunday). Default to "Monday" if omitted.
6. "return_window_rule": Must be STRICTLY one of:
   - "Anytime / कभी भी"
   - "Within 15 Days of Expiry"
   - "Within 30 Days of Invoice"
   - "Strict: Before Expiry Only"
   - "Weekly Replacement"
7. "notes": Any additional instructions, comments, or schedule details spoken.`;

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
  "salesman_name": string,
  "salesman_phone": string (10 digits),
  "visit_day": "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday",
  "return_window_rule": "Anytime / कभी भी" | "Within 15 Days of Expiry" | "Within 30 Days of Invoice" | "Strict: Before Expiry Only" | "Weekly Replacement",
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

  // 3. Fallback regex extraction if no LLM key configured or LLM network error
  const phoneMatch = rawTranscript.match(/(?:phone|mobile|number|फ़ोन|नंबर)?\s*[:\-]?\s*(\b[6-9]\d{9}\b)/i);
  let visitDay = 'Monday';
  if (/tuesday|mangalwar|मंगलवार/i.test(rawTranscript)) visitDay = 'Tuesday';
  else if (/wednesday|budhwar|बुधवार/i.test(rawTranscript)) visitDay = 'Wednesday';
  else if (/thursday|guruwar|brihaspatiwar|गुरुवार/i.test(rawTranscript)) visitDay = 'Thursday';
  else if (/friday|shukrawar|शुक्रवार/i.test(rawTranscript)) visitDay = 'Friday';
  else if (/saturday|shaniwar|शनिवार/i.test(rawTranscript)) visitDay = 'Saturday';
  else if (/sunday|raviwar|itwar|रविवार/i.test(rawTranscript)) visitDay = 'Sunday';

  return res.status(200).json({
    distributor_name: '',
    company_name: '',
    salesman_name: '',
    salesman_phone: phoneMatch ? phoneMatch[1] : '',
    visit_day: visitDay,
    return_window_rule: 'Anytime / कभी भी',
    notes: ''
  });
}
