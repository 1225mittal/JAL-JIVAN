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
        deliveryAddress: '',
        totalAmount: 0,
        itemsSummary: '',
        customerPhone: '',
        customerName: '',
        notes: '',
        delivery_address: '',
        total_amount: 0,
        items_summary: '',
        customer_phone: '',
        customer_name: '',
        _transcription: ''
      });
    }

    // Step 2: Simplified extraction with Groq chat completions using the verified working model
    const systemPrompt = `You are an expert Indian quick-commerce delivery dispatcher assistant.
Extract order details strictly from this spoken delivery note (transcribed from Hindi, Hinglish, or English).

Return strictly valid JSON matching this schema:
{
  "deliveryAddress": "",
  "totalAmount": 0,
  "itemsSummary": "",
  "customerPhone": "",
  "customerName": "",
  "notes": ""
}

Formatting and extraction rules:
1. deliveryAddress:
   - Phrases like "Ruby 1-505", "Tower B 402", "G-12", "Flat 304", or society/colony names are ALWAYS the "deliveryAddress", NEVER a customer name or phone number.
   - Set "deliveryAddress" to whatever flat/tower/society/colony/house is mentioned. If not mentioned, set to "".
2. totalAmount:
   - Total price or amount in rupees (e.g. 150, 200, 70). Return as a number. If not spoken, set to 0.
3. itemsSummary (Plain text representation of all ordered goods):
   - Water items: list the cans/bottles clearly (e.g., "1x 20L Bisleri", "3x 20L Bisleri", "2x Water Jar").
   - Grocery items / generic packets: represent as packets or bags of goods (e.g., "2 packets of goods", "1 grocery bag").
   - Combinations: combine them into a single clear readable line (e.g., "2 packets of goods + 3x 20L Bisleri").
   - If no items mentioned, set to "".
4. customerPhone:
   - MUST be a valid 10-digit Indian mobile number (e.g., starts with 6, 7, 8, or 9).
   - If not spoken, leave as "".
5. customerName:
   - Person's name if explicitly spoken, otherwise "".
6. notes:
   - Any special delivery instructions (e.g. "bell mat bajana", "call before delivery", "leave at door"). If not spoken, leave as "".
7. STRICT ACCURACY:
   - Do NOT invent, assume, or extrapolate facts or items not spoken by the user. Only extract what was spoken.`;

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

    return res.status(200).json({
      deliveryAddress,
      totalAmount,
      itemsSummary,
      customerPhone,
      customerName,
      notes,
      // Compatibility aliases
      delivery_address: deliveryAddress,
      total_amount: totalAmount,
      items_summary: itemsSummary,
      customer_phone: customerPhone,
      customer_name: customerName,
      _transcription: transcribedText
    });
  } catch (error) {
    console.error('Error processing voice order with Groq:', error);
    return res.status(500).json({
      error: error.message || 'Internal server error while processing audio'
    });
  }
}
