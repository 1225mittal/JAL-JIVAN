import { createClient } from '@supabase/supabase-js';

async function getFallbackKnownAddresses() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) return [];

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: orders } = await supabase
      .from('orders')
      .select('address, customer_phone')
      .not('address', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50);

    const addressMap = new Map();
    if (Array.isArray(orders)) {
      orders.forEach((o) => {
        const raw = (o.address || '').trim();
        if (raw && !addressMap.has(raw.toLowerCase())) {
          addressMap.set(raw.toLowerCase(), {
            address: raw,
            phone: (o.customer_phone || '').trim()
          });
        }
      });
    }

    try {
      const { data: addrs } = await supabase
        .from('addresses')
        .select('address_line')
        .limit(50);
      if (Array.isArray(addrs)) {
        addrs.forEach((a) => {
          const raw = (a.address_line || '').trim();
          if (raw && !addressMap.has(raw.toLowerCase())) {
            addressMap.set(raw.toLowerCase(), { address: raw, phone: '' });
          }
        });
      }
    } catch (e) {
      // ignore
    }

    return Array.from(addressMap.values());
  } catch (err) {
    console.warn('Fallback address lookup in gemini-voice skipped:', err?.message || err);
    return [];
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GROQ_API_KEY is not configured in environment variables.' });
  }

  try {
    const { audioBase64, mimeType, knownAddresses } = req.body || {};
    if (!audioBase64) {
      return res.status(400).json({ error: 'Missing audioBase64 in request body' });
    }

    // 1. Clean the base64 audio data
    const cleanBase64 = audioBase64.includes(',') ? audioBase64.split(',')[1].trim() : audioBase64.trim();

    // 2. Sanitize MIME type
    let cleanMimeType = (mimeType || 'audio/webm').split(';')[0].trim().toLowerCase();
    if (!cleanMimeType.startsWith('audio/')) {
      cleanMimeType = 'audio/webm';
    }

    // Extension mapping for Whisper supported formats
    const extMap = {
      'audio/webm': 'webm',
      'audio/mp4': 'm4a',
      'audio/m4a': 'm4a',
      'audio/ogg': 'ogg',
      'audio/wav': 'wav',
      'audio/x-wav': 'wav',
      'audio/mp3': 'mp3',
      'audio/mpeg': 'mp3',
      'audio/flac': 'flac'
    };
    const ext = extMap[cleanMimeType] || 'webm';

    // 3. Convert base64 to File buffer for FormData
    const audioBuffer = Buffer.from(cleanBase64, 'base64');
    const audioFile = new File([audioBuffer], `voice_order.${ext}`, { type: cleanMimeType });

    const formData = new FormData();
    formData.append('file', audioFile);
    formData.append('model', 'whisper-large-v3');
    formData.append(
      'prompt',
      'Indian grocery water delivery order in Hindi, Hinglish, or English. Addresses like 502/1, Sector 14, Ruby 1-505, Tower B 402, Flat, Bisleri cans.'
    );
    formData.append('response_format', 'json');

    // Step 1: Send audio to Groq Whisper for transcription
    const whisperRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: formData
    });

    if (!whisperRes.ok) {
      const errText = await whisperRes.text();
      console.error('Groq Whisper API Error:', whisperRes.status, errText);
      return res.status(whisperRes.status).json({
        error: `Groq Whisper transcription failed (${whisperRes.status}): ${errText}`
      });
    }

    const whisperData = await whisperRes.json();
    const transcribedText = (whisperData.text || '').trim();

    if (!transcribedText) {
      return res.status(200).json({
        deliveryAddress: '',
        totalAmount: 0,
        itemsSummary: '',
        customerPhone: '',
        customerName: '',
        matchedExisting: false,
        notes: '',
        delivery_address: '',
        total_amount: 0,
        items_summary: '',
        customer_phone: '',
        customer_name: '',
        matched_existing: false,
        _transcription: ''
      });
    }

    // Step 2: Retrieve known addresses (from request body or fallback query)
    let addressesList = Array.isArray(knownAddresses) && knownAddresses.length > 0
      ? knownAddresses
      : await getFallbackKnownAddresses();

    let knownAddressesPrompt = '';
    if (Array.isArray(addressesList) && addressesList.length > 0) {
      const formattedList = addressesList
        .slice(0, 50)
        .map((entry) => {
          if (typeof entry === 'string') return `- "${entry}"`;
          const parts = [`"${entry.address}"`];
          if (entry.name) parts.push(`Customer: ${entry.name}`);
          if (entry.phone) parts.push(`Phone: ${entry.phone}`);
          return `- ${parts.join(' | ')}`;
        })
        .join('\n');

      knownAddressesPrompt = `\n\nKNOWN EXISTING CUSTOMER ADDRESSES DIRECTORY:
${formattedList}

Matching Instructions:
- If the spoken address corresponds to, sounds like, or is a variation of an entry in this directory (e.g. shorthand, slang, with/without society prefix, or separator differences like "502 bate 1" matching "502/1"):
  1. You MUST output the exact standardized address string from this directory in "deliveryAddress".
  2. Set "matchedExisting": true.
  3. If the directory entry has a phone number and the speaker did not state a different number, populate "customerPhone" with this directory phone number.
  4. If the directory entry has a customer name and the speaker did not state a different name, populate "customerName" with this directory customer name.
- If the spoken address does not match any entry in the directory:
  1. Output the normalized address in "deliveryAddress" according to the Indian/Hinglish normalization rules below.
  2. Set "matchedExisting": false.`;
    } else {
      knownAddressesPrompt = `\nmatchedExisting: set to false.`;
    }

    const systemPrompt = `You are an expert Indian quick-commerce delivery dispatcher assistant.
Extract order details strictly from this spoken delivery note (transcribed from Hindi, Hinglish, or English) with address normalization and existing customer matching.

Return strictly valid JSON matching this schema:
{
  "deliveryAddress": "<Normalized or Matched Address>",
  "totalAmount": 0,
  "itemsSummary": "<items summary>",
  "customerPhone": "",
  "customerName": "",
  "matchedExisting": false,
  "notes": ""
}

INDIAN / HINGLISH ADDRESS NORMALIZATION RULES:
1. Recognize spoken shorthand synonyms for separators:
   - "bate", "battey", "bata", "batte", "batte me" -> "/"
   - "by", "oblique", "slash" -> "/"
   - "dash", "hyphen", "minus" -> "-"
2. Standardize house/flat/plot patterns:
   - Resolve patterns like "502 bate 1", "502 battey 1", "502 by 1", "502 dash 1", "502 - 1", "502 oblique 1" all to "502/1".
   - Examples: "Flat 12 bate 4 Ruby" -> "Flat 12/4, Ruby"; "Pocket 3 bate 20" -> "Pocket 3/20".
   - Clean up spacing around slashes and hyphens (e.g. "502 / 1" -> "502/1").
3. Delivery Address Identification:
   - Phrases mentioning flat numbers, towers, blocks, societies, colonies, sectors, or street names (e.g., "Ruby 1-505", "Tower B 402", "G-12", "Flat 304", "Sector 14", "Pocket C") are ALWAYS part of "deliveryAddress", NEVER a customer name or phone number.
   - If not mentioned, set "deliveryAddress" to "".
4. Existing Address & Customer Matching:
   - If a known directory is provided and the spoken address closely matches or refers to an entry (accounting for shorthand like "bate", "dash", abbreviations like "T-B" for "Tower B", society names, etc.):
     * Output the exact standardized string from the directory as "deliveryAddress".
     * Set "matchedExisting": true.
     * If the matched directory entry has a customer phone and the user didn't speak a different phone, set "customerPhone" to that phone number.
     * If the matched directory entry has a customer name and the user didn't speak a different name, set "customerName" to that name.
   - If it does not match any entry in the directory, normalize the spoken address using the rules above and set "matchedExisting": false.

OTHER FIELD EXTRACTION RULES:
5. totalAmount:
   - Total price or amount in rupees (e.g. 150, 200, 70). Return as a number. If not spoken, set to 0.
6. itemsSummary:
   - Plain text representation of all ordered goods.
   - Water items: list cans/bottles clearly (e.g., "1x 20L Bisleri", "3x 20L Bisleri", "2x Water Jar").
   - Grocery items / generic packets: represent as packets or bags of goods (e.g., "2 packets of goods", "1 grocery bag").
   - Combinations: combine into a single clear readable line (e.g., "2 packets of goods + 3x 20L Bisleri").
   - If no items mentioned, set to "".
7. customerPhone:
   - MUST be a valid 10-digit Indian mobile number (e.g. starts with 6, 7, 8, or 9).
   - If spoken or matched from directory, provide it; otherwise "".
8. customerName:
   - Person's name if explicitly spoken or matched from directory, otherwise "".
9. notes:
   - Any special delivery instructions (e.g. "bell mat bajana", "call before delivery", "leave at door"). If not spoken, leave as "".
10. STRICT ACCURACY:
   - Do NOT invent items or amounts not spoken by the user.${knownAddressesPrompt}`;

    const chatRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'qwen/qwen3.8-27b',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: transcribedText }
        ],
        temperature: 0.1
      })
    });

    if (!chatRes.ok) {
      const errText = await chatRes.text();
      console.error('Groq Chat Completion Error:', chatRes.status, errText);
      return res.status(chatRes.status).json({
        error: `Groq Chat completion failed (${chatRes.status}): ${errText}`
      });
    }

    const chatData = await chatRes.json();
    const rawContent = chatData.choices?.[0]?.message?.content;
    if (!rawContent) {
      return res.status(502).json({ error: 'No content returned from Groq model' });
    }

    const cleaned = rawContent
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    let parsedJson;
    try {
      parsedJson = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('Failed to parse Groq response JSON:', cleaned, parseErr);
      return res.status(502).json({
        error: `Failed to parse structured order from Groq response: ${parseErr.message}`
      });
    }

    const deliveryAddress = String(parsedJson.deliveryAddress || parsedJson.delivery_address || '').trim();
    const totalAmount = Number(parsedJson.totalAmount || parsedJson.total_amount) || 0;
    const itemsSummary = String(parsedJson.itemsSummary || parsedJson.items_summary || '').trim();
    const customerPhone = String(parsedJson.customerPhone || parsedJson.customer_phone || '').trim();
    const customerName = String(parsedJson.customerName || parsedJson.customer_name || '').trim();
    const notes = String(parsedJson.notes || '').trim();
    const matchedExisting = Boolean(parsedJson.matchedExisting || parsedJson.matched_existing);

    return res.status(200).json({
      deliveryAddress,
      totalAmount,
      itemsSummary,
      customerPhone,
      customerName,
      matchedExisting,
      notes,
      // Compatibility aliases
      delivery_address: deliveryAddress,
      total_amount: totalAmount,
      items_summary: itemsSummary,
      customer_phone: customerPhone,
      customer_name: customerName,
      matched_existing: matchedExisting,
      _transcription: transcribedText
    });
  } catch (error) {
    console.error('Error processing voice order with Groq:', error);
    return res.status(500).json({
      error: error.message || 'Internal server error while processing audio'
    });
  }
}
