/**
 * Speech Parsing & NLP extraction for FMCG Distributors & Salesman details
 * Handles multi-division, monthly claim cycle, and bilingual (Hindi + English / Hinglish) voice input.
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

export const CLAIM_WINDOW_PRESETS = [
  { label: '1st - 10th', start: 1, end: 10, description: '1st to 10th of every month' },
  { label: '15th - 30th', start: 15, end: 30, description: '15th to 30th of every month' },
  { label: '20th - End of Month', start: 20, end: 31, description: '20th to end of month' },
  { label: 'Anytime / Weekly Visit', start: 1, end: 31, description: 'Anytime / weekly replacement' },
  { label: 'Custom Range', start: 1, end: 10, description: 'Custom monthly window' }
];

export const RETURN_ELIGIBILITY_OPTIONS = [
  'Expired Stock',
  'Damage / Breakage / Leakage',
  'Consumer Complaint'
];

export const SETTLEMENT_MODES = [
  'Credit Note (CN)',
  'Replacement Goods',
  'Bill Adjustment'
];

// Backwards compatibility alias
export const RETURN_RULES = [
  '1st - 10th of Month (CN)',
  '15th - 30th of Month',
  '20th - End of Month',
  'Anytime / Weekly Visit',
  'Strict: Before Expiry Only'
];

/**
 * Strips conversational prefixes and Hindi/English fillers from company names
 */
export function stripCompanyName(val) {
  if (!val) return '';
  let str = String(val).trim();
  str = str.replace(/^(?:hamari\s+|apni\s+)?(?:company(?:\s*name)?|brand(?:\s*name)?|kampani|fmcg|ki|ka|hai|ke|for|कंपनी(?:\s*नेम|\s*नाम)?|ब्रांड(?:\s*नेम|\s*नाम)?|नेम|नाम|name)\s*[:\-]?\s*/iu, '');
  str = str.replace(/\s+(?:ki|ka|ke|hai|he|h|ki\s*hai|ka\s*hai)$/iu, '');
  str = str.replace(/^[,\.:;\s]+|[,\.:;\s]+$/g, '');
  return str.trim();
}

/**
 * Strips conversational prefixes and honorifics from salesman names
 */
export function stripSalesmanName(val) {
  if (!val) return '';
  let str = String(val).trim();
  str = str.replace(/^(?:salesman(?:\s*name)?|sales\s*boy|sales\s*person|sales\s*rep|sales\s*man|sales|bhaiya|bhai|ji|shri|mr|shree|ladka|सेल्समैन|सेल्स\s*बॉय|सेल्स\s*पर्सन|सेल्स|नाम|नेम|name)\s*[:\-]?\s*/iu, '');
  str = str.replace(/\s+(?:ji|bhaiya|bhai|sahab|saab|sir|jiu)$/iu, '');
  str = str.replace(/^[,\.:;\s]+|[,\.:;\s]+$/g, '');
  return str.trim();
}

/**
 * Strips conversational prefixes from distributor / agency names
 */
export function stripDistributorName(val) {
  if (!val) return '';
  let str = String(val).trim();
  str = str.replace(/^(?:hamara\s+|apna\s+)?(?:distributor(?:\s*name)?|distributer|agency(?:\s*name)?|firm(?:\s*name)?|trader|traders|agency\s*name|distributor\s*ka\s*naam|naam|hai|डिस्ट्रीब्यूटर(?:\s*का\s*नाम|\s*नाम|\s*नेम)?|नेम|नाम|name)\s*[:\-]?\s*/iu, '');
  str = str.replace(/\s+(?:hai|he|h|ka|ki|ke|ki\s*hai|ka\s*hai)$/iu, '');
  str = str.replace(/^[,\.:;\s]+|[,\.:;\s]+$/g, '');
  return str.trim();
}

/**
 * Strips conversational prefixes from product categories
 */
export function stripProductCategories(val) {
  if (!val) return '';
  let str = String(val).trim();
  str = str.replace(/^(?:category|categories|products?|items?|saman|saaman|maal|कैटगरी|कैटेगरी|प्रोडक्ट्स?|सामान|आइटम्स?|नेम|नाम|name)\s*[:\-]?\s*/iu, '');
  str = str.replace(/\s+(?:hai|ka|ki|ke)$/iu, '');
  str = str.replace(/^[,\.:;\s]+|[,\.:;\s]+$/g, '');
  return str.trim();
}

/**
 * Normalizes Hindi / English day mentions to standard weekday name
 */
export function normalizeVisitDay(dayText) {
  if (!dayText) return 'Monday';
  const text = String(dayText).toLowerCase().trim();

  if (/wednesday|budhwar|budhvaar|बुधवार|वेनसडे|वेडनसडे|वेडनेसडे|वेडनेस्डे|wed\b/iu.test(text)) return 'Wednesday';
  if (/tuesday|mangalwar|mangalvaar|मंगलवार|ट्यूजडे|ट्यूसडे|tue\b/iu.test(text)) return 'Tuesday';
  if (/thursday|guruwar|guruvaar|brihaspatiwar|veerwar|गुरुवार|बृहस्पतिवार|वीरवार|थर्सडे|thu\b/iu.test(text)) return 'Thursday';
  if (/friday|shukrawar|shukravaar|jumme|शुक्रवार|जुम्मा|फ्राइडे|fri\b/iu.test(text)) return 'Friday';
  if (/saturday|shaniwar|shanivaar|शनिवार|सैटरडे|सैटर्डे|sat\b/iu.test(text)) return 'Saturday';
  if (/sunday|raviwar|ravivaar|itwar|itvaar|रविवार|इतवार|संडे|sun\b/iu.test(text)) return 'Sunday';
  if (/monday|somwar|somvaar|सोमवार|मंडे|mon\b/iu.test(text)) return 'Monday';

  return 'Monday';
}

/**
 * Extracts 10-digit Indian phone number
 */
export function extractPhoneNumber(text) {
  if (!text) return '';
  const raw = String(text);

  // 1. Look for phone keyword followed by numbers (supports फोन, फ़ोन, मोबाइल, etc.)
  const keywordMatch = raw.match(/(?:phone(?:\s*number|\s*no)?|mobile(?:\s*number|\s*no)?|contact(?:\s*no)?|फ़ोन(?:\s*नंबर|\s*नं)?|फोन(?:\s*नंबर|\s*नं)?|मोबाइल(?:\s*नंबर|\s*नं)?|नंबर|number|ph)\s*[:\-]?\s*([0-9\s\-]{8,15})/iu);
  if (keywordMatch) {
    const digits = keywordMatch[1].replace(/\D/g, '');
    if (digits.length >= 8) {
      return digits.slice(-10);
    }
  }

  // 2. Direct 10-digit search starting with 6-9
  const directMatch = raw.replace(/\s+/g, ' ').match(/\b([6-9]\d{9})\b/);
  if (directMatch) {
    return directMatch[1];
  }

  // 3. Fallback on any 8-12 digit sequence
  const allDigits = raw.replace(/\D/g, '');
  if (allDigits.length >= 8 && allDigits.length <= 12) {
    return allDigits.slice(-10);
  }

  return '';
}

/**
 * Extracts monthly claim window preset or custom range from spoken text
 */
export function extractClaimWindowFromSpeech(text) {
  if (!text) return { preset: '1st - 10th', start: 1, end: 10 };
  const raw = String(text).toLowerCase();

  if (/anytime|kabhi\s*bhi|weekly|weekly\s*visit|always|har\s*hafte/i.test(raw)) {
    return { preset: 'Anytime / Weekly Visit', start: 1, end: 31 };
  }
  if (/15\s*(?:th|to|-|se)\s*30|15\s*se\s*30|15\s*to\s*30/i.test(raw)) {
    return { preset: '15th - 30th', start: 15, end: 30 };
  }
  if (/20\s*(?:th|to|-|se)|end\s*of\s*month|mahine\s*ke\s*aakhiri|20\s*se\s*end/i.test(raw)) {
    return { preset: '20th - End of Month', start: 20, end: 31 };
  }
  if (/1\s*(?:st|to|-|se)\s*10|1\s*se\s*10|first\s*to\s*ten|pehli\s*se\s*das/i.test(raw)) {
    return { preset: '1st - 10th', start: 1, end: 10 };
  }

  // Custom range e.g. "claim window 5 to 15" or "from 5 to 20"
  const rangeMatch = raw.match(/(?:claim|window|tarikh|date)\s*(?:from|se)?\s*(\d{1,2})\s*(?:to|-|se)\s*(\d{1,2})/i);
  if (rangeMatch) {
    const s = Math.max(1, Math.min(31, parseInt(rangeMatch[1], 10)));
    const e = Math.max(1, Math.min(31, parseInt(rangeMatch[2], 10)));
    return { preset: 'Custom Range', start: s, end: e };
  }

  return { preset: '1st - 10th', start: 1, end: 10 };
}

/**
 * Evaluates whether today falls within the distributor's monthly claim window
 * Returns { isOpen: boolean, badgeText: string, status: 'active' | 'upcoming', daysLeft: number }
 */
export function isClaimWindowActive(distributor, todayDate = new Date().getDate()) {
  if (!distributor) {
    return {
      isOpen: true,
      badgeText: '🟢 Return Window Open - Handover Stock to Salesman',
      status: 'active',
      preset: 'Anytime / Weekly Visit'
    };
  }

  const preset = distributor.claim_window_preset;
  if (
    preset === 'Anytime / Weekly Visit' ||
    (!distributor.claim_window_start && !distributor.claim_window_end && preset !== 'Custom Range')
  ) {
    return {
      isOpen: true,
      badgeText: '🟢 Return Window Open - Handover Stock to Salesman',
      status: 'active',
      preset: 'Anytime / Weekly Visit'
    };
  }

  const start = Number(distributor.claim_window_start) || 1;
  const end = Number(distributor.claim_window_end) || 31;

  if (todayDate >= start && todayDate <= end) {
    return {
      isOpen: true,
      start,
      end,
      badgeText: '🟢 Return Window Open - Handover Stock to Salesman',
      status: 'active',
      preset: preset || `${start}th - ${end}th`
    };
  } else {
    return {
      isOpen: false,
      start,
      end,
      badgeText: `⏳ Return Window opens on the ${start}th`,
      status: 'upcoming',
      preset: preset || `${start}th - ${end}th`
    };
  }
}

/**
 * Format readable claim window string for badges
 */
export function formatClaimWindowBadge(distributor) {
  if (!distributor) return '📅 Return Window: Anytime';
  if (distributor.claim_window_preset === 'Anytime / Weekly Visit') {
    return '📅 Return Window: Anytime / Weekly Visit';
  }
  const s = distributor.claim_window_start || 1;
  const e = distributor.claim_window_end || 31;
  return `📅 Return Window: ${s}th–${e}th of every month`;
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
      product_categories: '',
      salesman_name: '',
      salesman_phone: '',
      visit_day: 'Monday',
      claim_window_preset: '1st - 10th',
      claim_window_start: 1,
      claim_window_end: 10,
      settlement_mode: 'Credit Note (CN)',
      return_eligibility: ['Expired Stock', 'Damage / Breakage / Leakage'],
      notes: ''
    };
  }

  const raw = transcript.trim();

  // Extract phone number
  const phone = extractPhoneNumber(raw);

  // Extract claim window
  const windowInfo = extractClaimWindowFromSpeech(raw);

  // Comprehensive multi-lingual marker points (supporting both prefix and suffix speech patterns)
  const MARKERS = [
    {
      key: 'distributor_prefix',
      type: 'distributor_prefix',
      regex: /(?:^|[\s,;:\n])(?:distributor(?:\s*name)?|डिस्ट्रीब्यूटर(?:\s*का\s*नाम|\s*नाम|\s*नेम)?|hamara\s*distributor|hamari\s*agency|apni\s*agency)(?=[\s,;:\n]|$)/iu
    },
    {
      key: 'distributor_suffix',
      type: 'distributor_suffix',
      regex: /(?:^|[\s,;:\n])(?:agency|traders?|enterprises?|distributors?|एजेंसी|ट्रेडर्स|ट्रेडिंग|एंटरप्राइजेज|डिस्ट्रीब्यूटर|फर्म)(?=[\s,;:\n]|$)/iu
    },
    {
      key: 'company',
      type: 'company',
      regex: /(?:^|[\s,;:\n])(?:company(?:\s*name)?|brand(?:\s*name)?|कंपनी(?:\s*का\s*नाम|\s*नेम|\s*नाम)?|ब्रांड(?:\s*का\s*नाम|\s*नेम|\s*नाम)?|fmcg)(?=[\s,;:\n]|$)/iu
    },
    {
      key: 'categories',
      type: 'categories',
      regex: /(?:^|[\s,;:\n])(?:categories|category|products?|items?|प्रोडक्ट्स?|कैटेगरी|कैटगरी|सामान|आइटम्स?|माल)(?=[\s,;:\n]|$)/iu
    },
    {
      key: 'salesman',
      type: 'salesman',
      regex: /(?:^|[\s,;:\n])(?:salesman(?:\s*name)?|sales\s*person|sales\s*boy|sales\s*rep|सेल्समैन|सेल्स\s*बॉय|सेल्स\s*पर्सन|सेल्स)(?=[\s,;:\n]|$)/iu
    },
    {
      key: 'phone',
      type: 'phone',
      regex: /(?:^|[\s,;:\n])(?:phone(?:\s*number|\s*no)?|mobile(?:\s*number|\s*no)?|contact(?:\s*no)?|फ़ोन(?:\s*नंबर|\s*नं)?|फोन(?:\s*नंबर|\s*नं)?|मोबाइल(?:\s*नंबर|\s*नं)?|नंबर)(?=[\s,;:\n]|$)/iu
    },
    {
      key: 'day',
      type: 'day',
      regex: /(?:^|[\s,;:\n])(?:visit(?:\s*day)?|aane\s*ka\s*din|day|विजिट|दिन|वार|आने\s*का\s*दिन)(?=[\s,;:\n]|$)/iu
    },
    {
      key: 'claim',
      type: 'claim',
      regex: /(?:^|[\s,;:\n])(?:claim(?:\s*window)?|return(?:\s*window|\s*rule)?|क्लेम(?:\s*विंडो)?|रिटर्न(?:\s*विंडो)?|वापसी)(?=[\s,;:\n]|$)/iu
    }
  ];

  const found = [];
  MARKERS.forEach((m) => {
    const r = new RegExp(m.regex.source, 'giu');
    let match;
    while ((match = r.exec(raw)) !== null) {
      found.push({
        key: m.key,
        type: m.type,
        matchText: match[0].trim(),
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
  const dayMarker = primaryMarkers.find((m) => m.type === 'day');

  // Extract distributor
  let rawDistributor = '';
  if (distPrefix) {
    const nextMarker = primaryMarkers.find(
      (m) => m.start > distPrefix.start && m.type !== 'distributor_suffix'
    );
    rawDistributor = raw.slice(distPrefix.end, nextMarker ? nextMarker.start : undefined);
  } else if (distSuffix) {
    rawDistributor = raw.slice(0, distSuffix.end);
  } else if (companyMarker && companyMarker.start > 0) {
    rawDistributor = raw.slice(0, companyMarker.start);
  }

  // Extract company
  let rawCompany = '';
  if (companyMarker) {
    const nextMarker = primaryMarkers.find((m) => m.start > companyMarker.start);
    rawCompany = raw.slice(companyMarker.end, nextMarker ? nextMarker.start : undefined);
  }

  // Extract categories
  let rawCategories = '';
  if (catMarker) {
    const nextMarker = primaryMarkers.find((m) => m.start > catMarker.start);
    rawCategories = raw.slice(catMarker.end, nextMarker ? nextMarker.start : undefined);
  }

  // Extract salesman
  let rawSalesman = '';
  if (salesMarker) {
    const nextMarker = primaryMarkers.find((m) => m.start > salesMarker.start);
    rawSalesman = raw.slice(salesMarker.end, nextMarker ? nextMarker.start : undefined);
  }

  // Extract day
  const daySegment = dayMarker ? raw.slice(dayMarker.start) : raw;
  const visitDay = normalizeVisitDay(daySegment);

  // Clean values with entity prefix strippers
  const distributorName = stripDistributorName(rawDistributor);
  let companyName = stripCompanyName(rawCompany);
  const salesmanName = stripSalesmanName(rawSalesman);
  const productCategories = stripProductCategories(rawCategories);

  // Fallback brand recognition if company marker was omitted but brand was spoken
  if (!companyName) {
    const commonBrands = [
      'टाटा', 'टाटा टी', 'ब्रिटानिया', 'पार्ले', 'बिस्लेरी', 'नेस्ले', 'आईटीसी', 'अमूल',
      'Britannia', 'Parle', 'Bisleri', 'Tata Consumer', 'Tata', 'Nestle', 'ITC', 'Amul',
      'Coca Cola', 'Pepsi', 'Haldiram', 'Cadbury', 'Patanjali', 'Hindustan Unilever', 'HUL', 'Dabur', 'Marico'
    ];
    for (const b of commonBrands) {
      if (new RegExp(`\\b${b}\\b`, 'iu').test(raw)) {
        companyName = b;
        break;
      }
    }
  }

  return {
    distributor_name: distributorName,
    company_name: companyName,
    product_categories: productCategories,
    salesman_name: salesmanName,
    salesman_phone: phone,
    visit_day: visitDay,
    claim_window_preset: windowInfo.preset,
    claim_window_start: windowInfo.start,
    claim_window_end: windowInfo.end,
    settlement_mode: 'Credit Note (CN)',
    return_eligibility: ['Expired Stock', 'Damage / Breakage / Leakage'],
    notes: ''
  };
}

/**
 * Intelligent parsing: local instant parser + AI endpoint enhancement
 */
export async function parseDistributorVoice(transcript) {
  // 1. Instant local extraction with advanced multi-lingual markers
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
        distributor_name: stripDistributorName(aiResult.distributor_name) || localResult.distributor_name,
        company_name: stripCompanyName(aiResult.company_name) || localResult.company_name,
        product_categories: stripProductCategories(aiResult.product_categories) || localResult.product_categories,
        salesman_name: stripSalesmanName(aiResult.salesman_name) || localResult.salesman_name,
        salesman_phone: aiResult.salesman_phone || localResult.salesman_phone,
        visit_day: normalizeVisitDay(aiResult.visit_day) || localResult.visit_day,
        claim_window_preset: aiResult.claim_window_preset || localResult.claim_window_preset,
        claim_window_start: aiResult.claim_window_start || localResult.claim_window_start,
        claim_window_end: aiResult.claim_window_end || localResult.claim_window_end,
        settlement_mode: aiResult.settlement_mode || localResult.settlement_mode,
        return_eligibility: aiResult.return_eligibility || localResult.return_eligibility,
        notes: aiResult.notes || localResult.notes
      };
    }
  } catch (err) {
    console.warn('AI parser endpoint unavailable, using local speech parser:', err?.message || err);
  }

  return localResult;
}

/**
 * Format single field speech dictation with prefix stripping
 */
export function cleanSingleFieldDictation(fieldName, transcript) {
  if (!transcript) return '';
  const text = transcript.trim();

  if (fieldName === 'salesmanPhone') {
    const digits = text.replace(/\D/g, '');
    return digits.slice(-10);
  }

  if (fieldName === 'distributorName') {
    return stripDistributorName(text);
  }

  if (fieldName === 'companyName') {
    return stripCompanyName(text);
  }

  if (fieldName === 'salesmanName') {
    return stripSalesmanName(text);
  }

  if (fieldName === 'productCategories') {
    return stripProductCategories(text);
  }

  return text;
}
