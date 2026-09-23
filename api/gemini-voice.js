export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GROQ_API_KEY is not configured in environment variables.' });
  }

  try {
    const { audioBase64, mimeType } = req.body || {};
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
      'Indian grocery water delivery order in Hindi, Hinglish, or English. Addresses like Ruby, Tower, Flat, Bisleri cans.'
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
        customerName: '',
        customerPhone: '',
        deliveryAddress: '',
        landmark: '',
        items: [],
        totalAmount: 0,
        notes: '',
        customer_name: '',
        customer_phone: '',
        delivery_address: '',
        total_amount: 0,
        _transcription: ''
      });
    }

    // Step 2: Pass transcribed text to Groq chat completions using the verified working model
    const systemPrompt = `You are an expert Indian quick-commerce delivery dispatcher assistant.
Extract order details strictly from this spoken delivery note (transcribed from Hindi, Hinglish, or English).

Rules:
1. DELIVERY ADDRESS & FLAT NUMBERS:
   - Phrases like "Ruby 1-505", "Tower B 402", "G-12", "Flat 304", or society/colony names are ALWAYS the "deliveryAddress", NEVER a customer name or phone number.
   - Set "deliveryAddress" to whatever tower/flat/house/society is mentioned. If not mentioned, set to "".
2. CUSTOMER PHONE:
   - MUST be a valid 10-digit Indian mobile number (e.g., starts with 6, 7, 8, or 9).
   - NEVER put flat numbers, hyphenated numbers like "1-505", or item counts into "customerPhone". If no 10-digit number exists, leave it as "".
3. CUSTOMER NAME:
   - Person's name if explicitly spoken, otherwise "".
4. LANDMARK:
   - Nearby landmark if explicitly spoken, otherwise "".
5. ITEMS & QUANTITIES:
   - Extract item name and quantity into "items" array: [{ "name": "Bisleri", "quantity": 1 }].
   - If no quantity is specified, default quantity to 1.
   - If no items are mentioned, set "items" to [].
6. TOTAL AMOUNT:
   - Total price or amount if explicitly spoken, otherwise 0.
7. NOTES:
   - Any special delivery instructions (e.g. "bell mat bajana", "call before delivery", "leave at door"), otherwise "".
8. CRITICAL RULE:
   - Do NOT invent, assume, or extrapolate facts or details not spoken by the user. Only extract what is explicitly stated in the spoken text.

Return strictly valid JSON matching this schema:
{
  "customerName": "",
  "customerPhone": "",
  "deliveryAddress": "",
  "landmark": "",
  "items": [
    { "name": "", "quantity": 1 }
  ],
  "totalAmount": 0,
  "notes": ""
}`;

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

    const customerName = String(parsedJson.customerName || parsedJson.customer_name || '').trim();
    const customerPhone = String(parsedJson.customerPhone || parsedJson.customer_phone || '').trim();
    const deliveryAddress = String(parsedJson.deliveryAddress || parsedJson.delivery_address || '').trim();
    const landmark = String(parsedJson.landmark || '').trim();
    const totalAmount = Number(parsedJson.totalAmount || parsedJson.total_amount) || 0;
    const notes = String(parsedJson.notes || '').trim();

    const rawItems = Array.isArray(parsedJson.items) ? parsedJson.items : [];
    const normalizedItems = rawItems.map((item) => {
      const name = String(item?.name || item?.item_name || '').trim();
      const quantity = Math.max(1, Number(item?.quantity) || 1);
      return {
        name,
        item_name: name,
        quantity
      };
    }).filter(item => item.name.length > 0);

    return res.status(200).json({
      customerName,
      customerPhone,
      deliveryAddress,
      landmark,
      items: normalizedItems,
      totalAmount,
      notes,
      // Backward compatibility aliases
      customer_name: customerName,
      customer_phone: customerPhone,
      delivery_address: deliveryAddress,
      total_amount: totalAmount,
      _transcription: transcribedText
    });
  } catch (error) {
    console.error('Error processing voice order with Groq:', error);
    return res.status(500).json({
      error: error.message || 'Internal server error while processing audio'
    });
  }
}
