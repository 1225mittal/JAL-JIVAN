/**
 * Gemini Voice-to-Cart Client Service
 * Uses Web Speech API (Hindi/Hinglish/English) + Gemini 2.5 Flash / Groq / Local Heuristics
 */

import { playVoiceListenChime, playBarcodeScanBeep } from './soundEffects';

export class VoiceCartController {
  constructor() {
    this.recognition = null;
    this.isListening = false;
  }

  isSupported() {
    return typeof window !== 'undefined' && (
      'SpeechRecognition' in window ||
      'webkitSpeechRecognition' in window
    );
  }

  /**
   * Start listening for voice commands
   */
  start({
    onTranscript = () => {},
    onResult = () => {},
    onError = () => {},
    onEnd = () => {},
    catalog = []
  }) {
    if (!this.isSupported()) {
      onError(new Error('Speech recognition is not supported in this browser. Please use Chrome/Edge.'));
      return;
    }

    if (this.isListening) {
      this.stop();
    }

    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognitionClass();

    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.lang = 'hi-IN'; // Default to Hindi-English (Hinglish)

    playVoiceListenChime();
    this.isListening = true;

    this.recognition.onstart = () => {
      this.isListening = true;
    };

    this.recognition.onresult = (event) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      onTranscript(final || interim);

      if (final) {
        this.processTranscript(final, catalog)
          .then((matchedItems) => {
            if (matchedItems && matchedItems.length > 0) {
              playBarcodeScanBeep();
              onResult(matchedItems, final);
            } else {
              onError(new Error(`Could not match any products from: "${final}"`));
            }
          })
          .catch((err) => {
            onError(err);
          });
      }
    };

    this.recognition.onerror = (err) => {
      this.isListening = false;
      onError(err);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      onEnd();
    };

    try {
      this.recognition.start();
    } catch (e) {
      this.isListening = false;
      onError(e);
    }
  }

  stop() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {}
    }
    this.isListening = false;
  }

  /**
   * Process spoken transcript into structured cart items
   */
  async processTranscript(text, catalog = []) {
    const cleanText = (text || '').trim();
    if (!cleanText) return [];

    // 1. Try backend serverless route /api/voice-cart
    try {
      const response = await fetch('/api/voice-cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: cleanText,
          catalogItems: catalog
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.items) && data.items.length > 0) {
          return this.reconcileWithCatalog(data.items, catalog);
        }
      }
    } catch (apiErr) {
      console.warn('Backend /api/voice-cart notice, using client heuristic matcher:', apiErr);
    }

    // 2. Client-Side Instant Heuristic Matcher Fallback
    const parsed = this.parseClientHeuristic(cleanText, catalog);
    return this.reconcileWithCatalog(parsed, catalog);
  }

  /**
   * Heuristic Parser for Hindi/English quantities & items
   */
  parseClientHeuristic(text, catalog = []) {
    const numberWords = {
      'ek': 1, 'do': 2, 'teen': 3, 'char': 4, 'panch': 5, 'chhe': 6, 'saat': 7, 'aath': 8, 'nau': 9, 'das': 10,
      'gyarah': 11, 'barah': 12, 'terah': 13, 'chaudah': 14, 'pandrah': 15, 'bees': 20, 'pachis': 25,
      'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
    };

    const segments = text.split(/(?:aur|and|plus|,|\+)/i).map((s) => s.trim()).filter(Boolean);
    const results = [];

    for (const seg of segments) {
      let qty = 1;
      let cleanSeg = seg;

      const numMatch = seg.match(/^(\d+(?:\.\d+)?)\s*(?:packet|can|bottle|jar|box|piece|pcs|nos|kg|gm)?\s*(.*)$/i);
      if (numMatch) {
        qty = parseFloat(numMatch[1]) || 1;
        cleanSeg = (numMatch[2] || '').trim();
      } else {
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
      results.push({ item_name: cleanSeg, qty });
    }

    return results.length > 0 ? results : [{ item_name: text, qty: 1 }];
  }

  /**
   * Map parsed item names to actual catalog items with prices, tax, and barcodes
   */
  reconcileWithCatalog(parsedItems = [], catalog = []) {
    return parsedItems.map((p) => {
      const q = Math.max(1, Number(p.qty) || 1);
      const searchKey = (p.item_name || '').toLowerCase().trim();

      // Find best match in catalog
      let matched = null;
      if (p.barcode) {
        matched = catalog.find((c) => c.barcode && c.barcode.trim() === p.barcode.trim());
      }
      if (!matched && searchKey) {
        // Exact or fuzzy substring
        matched = catalog.find((c) => (c.item_name || '').toLowerCase().trim() === searchKey);
        if (!matched) {
          matched = catalog.find((c) => (c.item_name || '').toLowerCase().includes(searchKey) || searchKey.includes((c.item_name || '').toLowerCase()));
        }
      }

      if (matched) {
        return {
          id: `cart_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          barcode: matched.barcode || '',
          item_name: matched.item_name,
          hsn_code: matched.hsn_code || '',
          unit: matched.unit || 'PCS',
          qty: q,
          quantity: q,
          mrp: Number(matched.mrp) || Number(matched.selling_price) || 0,
          rate: Number(matched.selling_price || matched.mrp || 0),
          cost_price: Number(matched.unit_landed_cost || matched.cost_price || matched.purchase_price || 0),
          discount_pct: 0,
          discount_amount: 0,
          gst_pct: Number(matched.gst_percentage ?? matched.gst_pct ?? 0),
          taxable_amount: +(q * Number(matched.selling_price || matched.mrp || 0)).toFixed(2),
          total: +(q * Number(matched.selling_price || matched.mrp || 0)).toFixed(2)
        };
      }

      // Generic unmatched item fallback
      return {
        id: `cart_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        barcode: '',
        item_name: p.item_name || 'Spoken Item',
        hsn_code: '',
        unit: 'PCS',
        qty: q,
        quantity: q,
        mrp: 50,
        rate: 50,
        cost_price: 40,
        discount_pct: 0,
        discount_amount: 0,
        gst_pct: 5,
        taxable_amount: +(q * 50).toFixed(2),
        total: +(q * 50).toFixed(2)
      };
    });
  }
}

export const voiceCart = new VoiceCartController();
export default voiceCart;
