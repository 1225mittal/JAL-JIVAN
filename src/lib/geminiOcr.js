import { GoogleGenAI } from '@google/genai';

/**
 * Converts a browser File/Blob object into base64 data and mimeType
 * @param {File} file
 * @returns {Promise<{ data: string, mimeType: string }>}
 */
export function fileToGenerativePart(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        return reject(new Error('Failed to read file as data URL'));
      }
      // Result is in format "data:<mimeType>;base64,<data>"
      const base64Data = result.split(',')[1];
      const mimeType = file.type || 'image/jpeg';
      resolve({
        data: base64Data,
        mimeType
      });
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

console.log("Gemini Key Exists:", !!import.meta.env.VITE_GEMINI_API_KEY);

let cachedModelName = null;

/**
 * Fetches available models from Gemini API and resolves the best active model name.
 * Caches the result in module scope so it only queries the list once.
 * 
 * @param {string} apiKey
 * @returns {Promise<string>}
 */
export async function getActiveModelName(apiKey) {
  if (cachedModelName) {
    return cachedModelName;
  }

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (res.ok) {
      const data = await res.json();
      const models = Array.isArray(data?.models) ? data.models : [];

      // Filter data.models where supportedGenerationMethods includes "generateContent"
      const generateModels = models.filter((m) =>
        Array.isArray(m?.supportedGenerationMethods) &&
        m.supportedGenerationMethods.includes('generateContent')
      );

      // Priority match: look for first model name containing "flash"
      let chosen = generateModels.find((m) => {
        const name = (m.name || '').toLowerCase();
        return name.includes('flash');
      });

      // If none match "flash", fall back to the first available model in the list
      if (!chosen && generateModels.length > 0) {
        chosen = generateModels[0];
      }

      if (chosen && chosen.name) {
        // Strip any leading "models/" prefix so the SDK receives clean format
        cachedModelName = chosen.name.replace(/^models\//, '');
        return cachedModelName;
      }
    }
  } catch (err) {
    console.warn('Could not dynamically fetch active Gemini model list:', err?.message || err);
  }

  // Fallback default
  return 'gemini-1.5-flash-latest';
}

/**
 * Parses and normalizes structured order information from Gemini response text
 * @param {string} responseText
 * @returns {{
 *   customer_name: string,
 *   customer_phone: string,
 *   delivery_address: string,
 *   landmark?: string,
 *   items: Array<{ item_name: string, quantity: number, price: number }>,
 *   total_amount: number,
 *   notes: string
 * }}
 */
export function parseGeminiResponse(responseText) {
  let parsedData = {};

  try {
    parsedData = JSON.parse(responseText);
  } catch {
    // Fallback in case the model wrapped the JSON in markdown fences
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsedData = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('Model did not return valid JSON');
    }
  }

  // Normalize output structure
  return {
    customer_name: (parsedData.customer_name || '').trim(),
    customer_phone: (parsedData.customer_phone || '').replace(/\D/g, '').slice(-10),
    delivery_address: (parsedData.delivery_address || '').trim(),
    landmark: (parsedData.landmark || '').trim(),
    items: Array.isArray(parsedData.items)
      ? parsedData.items.map((item) => ({
        item_name: (item.item_name || 'Item').trim(),
        quantity: Math.max(1, Number(item.quantity) || 1),
        price: Math.max(0, Number(item.price) || 0)
      }))
      : [],
    total_amount: Math.max(0, Number(parsedData.total_amount) || 0),
    notes: (parsedData.notes || '').trim()
  };
}

/**
 * Analyzes a handwritten paper order slip or note using dynamically resolved
 * Gemini Flash models and returns structured order details.
 * 
 * @param {File} file - Image file of the paper slip
 * @returns {Promise<{
 *   customer_name: string,
 *   customer_phone: string,
 *   delivery_address: string,
 *   landmark?: string,
 *   items: Array<{ item_name: string, quantity: number, price: number }>,
 *   total_amount: number,
 *   notes: string
 * }>}
 */
export async function extractOrderFromSlip(file) {
  console.log("Gemini Key Exists:", !!import.meta.env.VITE_GEMINI_API_KEY);

  if (!file) {
    throw new Error('No slip image provided for OCR extraction');
  }

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('VITE_GEMINI_API_KEY is not configured in .env file');
  }

  const genAI = new GoogleGenAI({ apiKey });

  // Provide compatibility adapter for getGenerativeModel on @google/genai
  if (typeof genAI.getGenerativeModel !== 'function') {
    genAI.getGenerativeModel = ({ model: modelName }) => ({
      generateContent: async (args) => {
        let payloadContents;
        if (Array.isArray(args)) {
          payloadContents = args.map((arg) => {
            if (typeof arg === 'string') return arg;
            if (arg?.inlineData) return { inlineData: arg.inlineData };
            return arg;
          });
        } else {
          payloadContents = args?.contents || args;
        }

        const res = await genAI.models.generateContent({
          model: modelName,
          contents: payloadContents,
          config: {
            responseMimeType: 'application/json'
          }
        });

        return {
          response: {
            text: () => res?.text || ''
          },
          text: res?.text || ''
        };
      }
    });
  }

  // 1. Convert file to base64 inlineData
  const { data: base64Data, mimeType } = await fileToGenerativePart(file);

  const prompt = `You are an expert handwriting recognition and OCR extraction system for Jal-Jivan, a drinking water and daily essentials delivery service.
Analyze this handwritten paper order slip, diary entry, receipt, or WhatsApp delivery note.

Carefully extract the following information and output strictly valid JSON matching this schema:
{
  "customer_name": "string (name of customer if written, otherwise empty string)",
  "customer_phone": "string (10-digit Indian mobile number if written, e.g. 9812345678, otherwise empty string)",
  "delivery_address": "string (doorstep address, house/flat/plot number, street, society, sector, or block)",
  "landmark": "string (prominent landmark like 'Near Water Tank', 'Opposite Park', etc. if written, otherwise empty string)",
  "items": [
    {
      "item_name": "string (product name, e.g. '20L Water Jar', '1L Bottle Pack', 'Bisleri Can', etc.)",
      "quantity": 1,
      "price": 0
    }
  ],
  "total_amount": 0,
  "notes": "string (any instructions, floor number, empty can deposit remarks, or payment mode noted on the slip)"
}

Guidelines:
1. Ensure 'customer_phone' contains only digits (strip out spaces, dashes, or +91 prefixes). Keep exactly 10 digits if a valid mobile number is present.
2. For 'total_amount', calculate the sum of items or use the total amount written on the slip.
3. If specific items are written (e.g. "2 jars 20L", "1 box bottles"), extract each item with its quantity and price.
4. If a field cannot be deciphered or is absent, leave it as an empty string ("") or 0.
5. Return ONLY the JSON object. Do not include markdown code block backticks.`;

  const imagePart = {
    inlineData: {
      data: base64Data,
      mimeType
    }
  };

  // Dynamically resolve active model
  const detectedModelName = await getActiveModelName(apiKey);
  console.log("Using dynamically resolved Gemini model:", detectedModelName);

  try {
    const model = genAI.getGenerativeModel({ model: detectedModelName });
    const result = await model.generateContent([prompt, imagePart]);
    const responseText = typeof result?.response?.text === 'function'
      ? result.response.text()
      : (result?.text || '');

    if (responseText) {
      // Parse and return the structured JSON data
      return parseGeminiResponse(responseText);
    }
  } catch (primaryErr) {
    console.warn(`Primary dynamically resolved model ${detectedModelName} failed:`, primaryErr?.message || primaryErr);

    const fallbackCandidates = [
      "gemini-2.5-flash",
      "gemini-1.5-flash-latest",
      "gemini-1.5-pro-latest",
      "gemini-1.5-flash-8b",
      "gemini-2.0-flash"
    ].filter((m) => m !== detectedModelName);

    for (const fallbackName of fallbackCandidates) {
      try {
        console.log(`Trying fallback Gemini model: ${fallbackName}...`);
        const fallbackModel = genAI.getGenerativeModel({ model: fallbackName });
        const res = await fallbackModel.generateContent([prompt, imagePart]);
        const fallbackText = typeof res?.response?.text === 'function'
          ? res.response.text()
          : (res?.text || '');

        if (fallbackText) {
          return parseGeminiResponse(fallbackText);
        }
      } catch (err) {
        console.warn(`Fallback model ${fallbackName} failed or not found:`, err?.message || err);
      }
    }

    throw primaryErr;
  }

  throw new Error("All Gemini model candidates failed.");
}
