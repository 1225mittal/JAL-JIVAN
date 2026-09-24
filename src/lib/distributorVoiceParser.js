/**
 * Speech Parsing & NLP extraction for Distributors & Salesman details
 * Handles bilingual (Hindi + English / Hinglish) voice input.
 */

export const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
];

export const RETURN_RULES = [
  'Anytime / कभी भी',
  'Within 15 Days of Expiry',
  'Within 30 Days of Invoice',
  'Strict: Before Expiry Only',
  'Weekly Replacement'
];

/**
 * Normalizes Hindi / English day mentions to standard weekday name
 */
export function normalizeVisitDay(dayText) {
  if (!dayText) return 'Monday';
  const text = String(dayText).toLowerCase().trim();

  if (/monday|somwar|somvaar|सोमवार|mon\b/i.test(text)) return 'Monday';
  if (/tuesday|mangalwar|mangalvaar|मंगलवार|tue\b/i.test(text)) return 'Tuesday';
  if (/wednesday|budhwar|budhvaar|बुधवार|wed\b/i.test(text)) return 'Wednesday';
  if (/thursday|guruwar|guruvaar|brihaspatiwar|veerwar|गुरुवार|बृहस्पतिवार|वीरवार|thu\b/i.test(text)) return 'Thursday';
  if (/friday|shukrawar|shukravaar|jumme|शुक्रवार|fri\b/i.test(text)) return 'Friday';
  if (/saturday|shaniwar|shanivaar|शनिवार|sat\b/i.test(text)) return 'Saturday';
  if (/sunday|raviwar|ravivaar|itwar|itvaar|रविवार|इतवार|sun\b/i.test(text)) return 'Sunday';

  return 'Monday';
}

/**
 * Normalizes return policy rule from speech
 */
export function normalizeReturnRule(ruleText) {
  if (!ruleText) return 'Anytime / कभी भी';
  const text = String(ruleText).toLowerCase().trim();

  if (/anytime|any\s*time|kabhi\s*bhi|कभी\s*भी|no\s*limit/i.test(text)) {
    return 'Anytime / कभी भी';
  }
  if (/15\s*day|15\s*din|fifteen|15\s*दिन/i.test(text)) {
    return 'Within 15 Days of Expiry';
  }
  if (/30\s*day|30\s*din|thirty|invoice|bill|30\s*दिन|बिल/i.test(text)) {
    return 'Within 30 Days of Invoice';
  }
  if (/strict|before\s*expiry|pehle|पहले|expiry\s*se\s*pehle/i.test(text)) {
    return 'Strict: Before Expiry Only';
  }
  if (/weekly|hafta|har\s*hafte|replacement|बदली/i.test(text)) {
    return 'Weekly Replacement';
  }

  return 'Anytime / कभी भी';
}

/**
 * Extracts 10-digit Indian phone number
 */
export function extractPhoneNumber(text) {
  if (!text) return '';
  const raw = String(text);

  // 1. Look for phone keyword followed by numbers
  const keywordMatch = raw.match(/(?:phone(?:\s*number|\s*no)?|mobile(?:\s*no)?|number|फ़ोन|मोबाइल|नंबर|ph)\s*[:\-]?\s*([0-9\s\-]{10,15})/i);
  if (keywordMatch) {
    const digits = keywordMatch[1].replace(/\D/g, '');
    if (digits.length >= 10) {
      return digits.slice(-10);
    }
  }

  // 2. Direct 10-digit search starting with 6-9
  const directMatch = raw.replace(/\s+/g, ' ').match(/\b([6-9]\d{9})\b/);
  if (directMatch) {
    return directMatch[1];
  }

  // 3. Fallback on all digits
  const allDigits = raw.replace(/\D/g, '');
  if (allDigits.length === 10 && /^[6-9]/.test(allDigits)) {
    return allDigits;
  }
  if (allDigits.length > 10) {
    const sub = allDigits.match(/[6-9]\d{9}/);
    if (sub) return sub[0];
  }

  return '';
}

/**
 * Cleans extracted text value (strips colons, trailing words like 'hai', 'ka', etc.)
 */
function cleanSegmentText(str) {
  if (!str) return '';
  return str
    .replace(/^[:\-,\s]+/, '')
    .replace(/[:\-,\s]+$/, '')
    .replace(/\s+(?:hai|he|h|ka|ki|ke|ko|se)\s*$/i, '')
    .trim();
}

/**
 * Fast client-side regex & keyword-based parser for zero-latency form population
 */
export function parseDistributorVoiceLocally(transcript) {
  if (!transcript || typeof transcript !== 'string') {
    return {
      distributor_name: '',
      company_name: '',
      salesman_name: '',
      salesman_phone: '',
      visit_day: 'Monday',
      return_window_rule: 'Anytime / कभी भी',
      notes: ''
    };
  }

  const raw = transcript.trim();

  // Extract phone number first
  const phone = extractPhoneNumber(raw);

  // Extract visit day
  let visitDay = 'Monday';
  const dayPatterns = [
    /monday|somwar|somvaar|सोमवार/i,
    /tuesday|mangalwar|mangalvaar|मंगलवार/i,
    /wednesday|budhwar|budhvaar|बुधवार/i,
    /thursday|guruwar|guruvaar|brihaspatiwar|veerwar|गुरुवार|बृहस्पतिवार|वीरवार/i,
    /friday|shukrawar|shukravaar|शुक्रवार/i,
    /saturday|shaniwar|shanivaar|शनिवार/i,
    /sunday|raviwar|ravivaar|itwar|itvaar|रविवार|इतवार/i
  ];
  for (const pat of dayPatterns) {
    const m = raw.match(pat);
    if (m) {
      visitDay = normalizeVisitDay(m[0]);
      break;
    }
  }

  // Extract return rule
  let returnRule = 'Anytime / कभी भी';
  if (/anytime|kabhi\s*bhi|कभी\s*भी/i.test(raw)) {
    returnRule = 'Anytime / कभी भी';
  } else if (/15\s*day|15\s*din|15\s*दिन/i.test(raw)) {
    returnRule = 'Within 15 Days of Expiry';
  } else if (/30\s*day|30\s*din|30\s*दिन|invoice|bill|बिल/i.test(raw)) {
    returnRule = 'Within 30 Days of Invoice';
  } else if (/before\s*expiry|strict|expiry\s*se\s*pehle|पहले/i.test(raw)) {
    returnRule = 'Strict: Before Expiry Only';
  } else if (/weekly|hafta|replacement|बदली/i.test(raw)) {
    returnRule = 'Weekly Replacement';
  }

  // Keyword token extraction (supports English and Devanagari/Hindi script)
  const KEYWORDS = [
    { type: 'distributor', regex: /(?:^|[\s,;:\n])(?:distributor(?:\s*name)?|डिस्ट्रीब्यूटर|agency|firm|supplier|एजेंसी|फर्म)(?=[\s,;:\n]|$)/iu },
    { type: 'company', regex: /(?:^|[\s,;:\n])(?:company(?:\s*name)?|brand(?:\s*name)?|fmcg|कंपनी|ब्रांड)(?=[\s,;:\n]|$)/iu },
    { type: 'salesman', regex: /(?:^|[\s,;:\n])(?:salesman(?:\s*name)?|sales\s*person|sales\s*boy|sales\s*rep|सेल्समैन|सेल्स)(?=[\s,;:\n]|$)/iu },
    { type: 'phone', regex: /(?:^|[\s,;:\n])(?:phone(?:\s*number|\s*no)?|mobile(?:\s*number|\s*no)?|फ़ोन(?:\s*नंबर)?|मोबाइल|contact)(?=[\s,;:\n]|$)/iu },
    { type: 'day', regex: /(?:^|[\s,;:\n])(?:visit(?:\s*day)?|aane\s*ka\s*din|day|दिन|वार)(?=[\s,;:\n]|$)/iu },
    { type: 'rule', regex: /(?:^|[\s,;:\n])(?:return(?:\s*rule|\s*window|\s*policy)?|वापसी(?:\s*नियम)?|रिटर्न)(?=[\s,;:\n]|$)/iu },
    { type: 'notes', regex: /(?:^|[\s,;:\n])(?:notes?|remarks?|instruction|नोट)(?=[\s,;:\n]|$)/iu }
  ];

  // Find all keyword positions
  const rawMatches = [];
  KEYWORDS.forEach((k) => {
    let match;
    const globalRegex = new RegExp(k.regex.source, 'gi');
    while ((match = globalRegex.exec(raw)) !== null) {
      rawMatches.push({
        type: k.type,
        start: match.index,
        end: match.index + match[0].length
      });
    }
  });

  // Sort matches by start position
  rawMatches.sort((a, b) => a.start - b.start);

  // Filter out redundant consecutive matches of same type
  const matches = [];
  const seenTypes = new Set();
  for (const m of rawMatches) {
    if (!seenTypes.has(m.type)) {
      seenTypes.add(m.type);
      matches.push(m);
    }
  }

  // Sort again in order of occurrence
  matches.sort((a, b) => a.start - b.start);

  const parsedFields = {
    distributor: '',
    company: '',
    salesman: '',
    phone: '',
    day: '',
    rule: '',
    notes: ''
  };

  matches.forEach((m, idx) => {
    const nextStart = idx < matches.length - 1 ? matches[idx + 1].start : raw.length;
    const segment = raw.slice(m.end, nextStart);
    if (!parsedFields[m.type]) {
      parsedFields[m.type] = cleanSegmentText(segment);
    }
  });

  let distributorName = parsedFields.distributor || '';
  let companyName = parsedFields.company || '';
  let salesmanName = parsedFields.salesman || '';
  let notes = parsedFields.notes || '';

  // Clean common suffixes from salesman name like "ji", "bhaiya"
  salesmanName = salesmanName.replace(/\s+(?:ji|bhaiya|jiu|bhai)\b/i, '').trim();

  // If distributor or company were not found through keywords, check common brands
  if (!companyName) {
    const commonBrands = ['Britannia', 'Parle', 'Bisleri', 'Tata Consumer', 'Tata', 'Nestle', 'ITC', 'Amul', 'Coca Cola', 'Pepsi', 'Haldiram', 'Cadbury', 'Patanjali'];
    for (const b of commonBrands) {
      if (new RegExp(`\\b${b}\\b`, 'i').test(raw)) {
        companyName = b;
        break;
      }
    }
  }

  return {
    distributor_name: distributorName,
    company_name: companyName,
    salesman_name: salesmanName,
    salesman_phone: phone || parsedFields.phone.replace(/\D/g, '').slice(-10),
    visit_day: visitDay,
    return_window_rule: returnRule,
    notes: notes
  };
}

/**
 * Intelligent parsing: local instant parser + AI endpoint enhancement
 */
export async function parseDistributorVoice(transcript) {
  // 1. Instant local extraction
  const localResult = parseDistributorVoiceLocally(transcript);

  // 2. Call backend AI parser if available
  try {
    const res = await fetch('/api/parse-distributor-voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript })
    });

    if (res.ok) {
      const aiResult = await res.json();
      return {
        distributor_name: aiResult.distributor_name || localResult.distributor_name,
        company_name: aiResult.company_name || localResult.company_name,
        salesman_name: aiResult.salesman_name || localResult.salesman_name,
        salesman_phone: aiResult.salesman_phone || localResult.salesman_phone,
        visit_day: aiResult.visit_day || localResult.visit_day,
        return_window_rule: aiResult.return_window_rule || localResult.return_window_rule,
        notes: aiResult.notes || localResult.notes
      };
    }
  } catch (err) {
    console.warn('AI parser endpoint unavailable, using local speech parser:', err?.message || err);
  }

  return localResult;
}

/**
 * Format single field speech dictation
 */
export function cleanSingleFieldDictation(fieldName, transcript) {
  if (!transcript) return '';
  const text = transcript.trim();

  if (fieldName === 'salesmanPhone') {
    const digits = text.replace(/\D/g, '');
    return digits.slice(-10);
  }

  if (fieldName === 'distributorName' || fieldName === 'companyName' || fieldName === 'salesmanName') {
    // Title case the first letters
    return text
      .split(' ')
      .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
      .join(' ')
      .trim();
  }

  return text;
}
