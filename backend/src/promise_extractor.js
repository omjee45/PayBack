'use strict';

require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

// ─── JSDoc types ──────────────────────────────────────────────────────────

/**
 * @typedef {Object} ExtractedPromise
 * @property {boolean}     has_promise
 * @property {string|null} promised_date  - 'YYYY-MM-DD' or null
 * @property {number}      confidence     - 0.0–1.0
 * @property {string}      reasoning
 */

// ─── System instruction ───────────────────────────────────────────────────

const SYSTEM_INSTRUCTION = `You extract structured commitments from debtor replies to payment reminders.
Given a free-text reply, determine if the debtor made a specific promise to pay by a date.

Output JSON matching EXACTLY this schema (no markdown, no extra keys):
{
  "has_promise": boolean,
  "promised_date": "YYYY-MM-DD" or null,
  "confidence": number 0.0 to 1.0,
  "reasoning": "one short sentence"
}

Rules:
- Relative dates ("next Friday", "end of month", "by the 15th") MUST be resolved to absolute YYYY-MM-DD using today's date provided in the input.
- Vague replies ("soon", "will try", "checking") → has_promise: false, confidence < 0.3.
- A clear commitment to a specific date → has_promise: true.
- If no clear date → has_promise: false.`;

// ─── Main export ──────────────────────────────────────────────────────────

/**
 * Extracts a structured promise from a debtor reply via Gemini, falls back to regex.
 * @param {string} replyText
 * @param {string} todayDate - 'YYYY-MM-DD'
 * @returns {Promise<ExtractedPromise>}
 */
async function extractPromise(replyText, todayDate) {
  if (!process.env.GEMINI_API_KEY) {
    return regexExtract(replyText, todayDate);
  }

  const userPrompt = `Today's date: ${todayDate}\nDebtor reply: "${replyText}"`;

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: SYSTEM_INSTRUCTION,
      generationConfig: { responseMimeType: 'application/json' }, // structured JSON output
    });

    const result = await model.generateContent(userPrompt);
    const parsed = JSON.parse(result.response.text());
    if (typeof parsed.has_promise !== 'boolean') throw new Error('Schema mismatch');
    return parsed;
  } catch (err) {
    console.error('[PromiseExtractor] Gemini error — falling back to regex:', err.message);
    return regexExtract(replyText, todayDate);
  }
}

// ─── Regex / heuristic fallback ───────────────────────────────────────────

function regexExtract(replyText, todayDate) {
  const lower = replyText.toLowerCase();
  const today = new Date(todayDate);

  // Vague non-commitments
  if (/\b(soon|asap|shortly|trying|will try|will check|checking|looking into)\b/i.test(lower)
      && !/\b(by|before|on\s+\w+day|next\s+\w+|tomorrow|\d+)\b/i.test(lower)) {
    return { has_promise: false, promised_date: null, confidence: 0.15, reasoning: 'Reply contains only vague language with no specific date.' };
  }

  // "tomorrow"
  if (/\btomorrow\b/i.test(lower)) {
    return result(addDays(today, 1), 0.90, 'Debtor explicitly said "tomorrow".');
  }

  // "in X days"
  const inDaysM = lower.match(/\bin\s+(\d+)\s+days?\b/i);
  if (inDaysM) return result(addDays(today, +inDaysM[1]), 0.75, `Debtor said "in ${inDaysM[1]} days".`);

  // "next/this <weekday>"
  const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const relDay = lower.match(/\b(next|this)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
  if (relDay) {
    const target = days.indexOf(relDay[2].toLowerCase());
    const isNext = relDay[1].toLowerCase() === 'next';
    let ahead = (target - today.getDay() + 7) % 7;
    if (ahead === 0 || isNext) ahead += 7;
    return result(addDays(today, ahead), 0.78, `Debtor mentioned "${relDay[1]} ${relDay[2]}".`);
  }

  // "end of month"
  if (/end of (the )?month/i.test(lower)) {
    const eom = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return result(eom, 0.68, 'Debtor said "end of month".');
  }

  // "end of week"
  if (/end of (the )?week/i.test(lower)) {
    return result(addDays(today, 7 - today.getDay()), 0.62, 'Debtor said "end of week".');
  }

  // "by/on/before <day> [<month>]"
  const MONTHS = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 };
  const explicitM = lower.match(/\b(?:by|before|on)\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)?/i);
  if (explicitM) {
    const day  = +explicitM[1];
    const mStr = explicitM[2]?.toLowerCase();
    let month  = mStr ? MONTHS[mStr] : today.getMonth();
    let year   = today.getFullYear();
    if (!mStr && day <= today.getDate()) { month++; if (month > 11) { month = 0; year++; } }
    return result(new Date(year, month, day), 0.82, `Debtor mentioned a specific day (${day}${mStr ? ' ' + mStr : ''}).`);
  }

  return { has_promise: false, promised_date: null, confidence: 0.10, reasoning: 'No specific date commitment detected.' };
}

function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d; }
function fmt(d) { return d.toISOString().split('T')[0]; }
function result(date, confidence, reasoning) {
  return { has_promise: true, promised_date: fmt(date), confidence, reasoning };
}

module.exports = { extractPromise };
