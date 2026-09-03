'use strict';

require('dotenv').config({ override: true });
const { GoogleGenAI } = require('@google/genai');

// ─── JSDoc types ──────────────────────────────────────────────────────────

/**
 * @typedef {Object} ReminderParams
 * @property {string}            debtorName
 * @property {bigint}            amountPaise
 * @property {Date|string}       dueDate
 * @property {number}            daysOverdue
 * @property {'GENTLE'|'FIRM'|'ESCALATION'} tier
 * @property {string}            language       - 'en' | 'hi-en'
 * @property {string}            [brokenPromiseDate]  - e.g. "12 Aug"
 */

// ─── System instruction (moved into Gemini model config) ─────────────────

// Language-specific system prompts — separate to avoid Gemini ignoring soft hints
const BASE_SYSTEM_EN = `You are a professional B2B collections assistant for an Indian SME.
Generate a payment reminder message for a debtor. Match tone to the escalation tier:
- GENTLE: friendly, assumes oversight, no pressure
- FIRM: direct, states consequences of continued delay, still respectful
- ESCALATION: serious, references prior contact attempts, states next step is formal/legal review — but stays professional, never threatening or abusive

You MUST write the entire message in English only.
Output: plain message text only, WhatsApp-appropriate length (2-4 sentences). No subject line. No sign-off.`;

const BASE_SYSTEM_HIEN = `You are a professional B2B collections assistant for an Indian SME.
Generate a payment reminder message for a debtor. Match tone to the escalation tier:
- GENTLE: friendly, assumes oversight, no pressure
- FIRM: direct, states consequences of continued delay, still respectful
- ESCALATION: serious, references prior contact attempts, states next step is formal/legal review — but stays professional, never threatening or abusive

You MUST write this entire message in Hinglish (Hindi-English code-mixed). This is MANDATORY — do NOT write in pure English or pure Hindi.
Hinglish means: Hindi grammar and sentence flow, with English words mixed in naturally, exactly as spoken in Indian business WhatsApp messages.
Example style: "Bhai, aapka ₹X ka payment 10 din se pending hai. Please aaj hi transfer kar dijiye, warna hum aage ki action lenge."
Output: plain message text only, WhatsApp-appropriate length (2-4 sentences). No subject line. No sign-off.`;

// ─── Helpers ──────────────────────────────────────────────────────────────

function fmtAmount(paise) {
  return `₹${(Number(paise) / 100).toLocaleString('en-IN')}`;
}
function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Hinglish validator ───────────────────────────────────────────────────

// A response passes if it contains at least 2 common Hindi/Hinglish words.
// This catches pure-English responses from Gemini for hi-en requests.
const HINDI_MARKERS = [
  'aap', 'aapka', 'aapke', 'aapki', 'hai', 'hain', 'kar', 'karo', 'karein',
  'ki', 'ke', 'ka', 'ko', 'se', 'mein', 'ji', 'bhai', 'din', 'tha', 'tha',
  'toh', 'warna', 'please', 'nahi', 'ho', 'hua', 'liye', 'tak', 'ab',
  'humne', 'hum', 'yeh', 'aaj', 'kal', 'namaste', 'turant', 'payment',
];

function looksLikeHinglish(text) {
  const lower = text.toLowerCase();
  const hits = HINDI_MARKERS.filter(w => {
    // whole-word match to avoid false positives (e.g. "taken" contains "ke")
    const re = new RegExp(`\\b${w}\\b`);
    return re.test(lower);
  });
  return hits.length >= 2;
}

// ─── Internal Gemini caller ───────────────────────────────────────────────

async function callGemini(genAI, systemInstruction, userPrompt) {
  const result = await genAI.models.generateContent({
    model: 'gemini-3.1-flash-lite',
    contents: userPrompt,
    config: { systemInstruction },
  });
  const text = typeof result.text === 'function'
    ? result.text()
    : (result.text || (result.response && result.response.text && result.response.text()) || '');
  return text.trim();
}

// ─── Main export ──────────────────────────────────────────────────────────

/**
 * Generates a reminder message via Gemini API, falls back to templates if key is absent.
 * For hi-en debtors: validates Hinglish output, retries once if pure English detected,
 * then falls back to deterministic Hinglish template — never ships English to hi-en debtor.
 * @param {ReminderParams} params
 * @returns {Promise<string>}
 */
async function generateReminder(params) {
  const { debtorName, amountPaise, dueDate, daysOverdue, tier, language, brokenPromiseDate } = params;
  const amtStr  = fmtAmount(amountPaise);
  const dateStr = fmtDate(dueDate);

  if (!process.env.GEMINI_API_KEY) {
    return template({ debtorName, tier, language, daysOverdue, brokenPromiseDate, amtStr, dateStr });
  }

  const BASE_SYSTEM = language === 'hi-en' ? BASE_SYSTEM_HIEN : BASE_SYSTEM_EN;

  const brokenCtx = brokenPromiseDate
    ? `\n\nIMPORTANT: This debtor previously promised to pay by ${brokenPromiseDate} and did NOT pay. Explicitly and politely reference this broken commitment in your message.`
    : '';

  const systemInstruction = BASE_SYSTEM + brokenCtx;

  const langDirective = language === 'hi-en'
    ? 'IMPORTANT: Write the entire message in Hinglish (Hindi-English code-mixed). Do NOT write in pure English.'
    : 'Write the message in English.';

  const userPrompt = [
    `Generate a ${tier} reminder.`,
    `Debtor name: ${debtorName}`,
    `Amount due: ${amtStr}`,
    `Due date: ${dateStr}`,
    `Days overdue: ${daysOverdue}`,
    langDirective,
  ].join('\n');

  try {
    const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // First attempt
    let text = await callGemini(genAI, systemInstruction, userPrompt);

    // Hinglish safety net: if hi-en response looks like pure English, retry once
    if (language === 'hi-en' && !looksLikeHinglish(text)) {
      console.warn(`[ReminderGenerator] hi-en response looks like pure English — retrying with stricter prompt`);
      const retryPrompt = userPrompt +
        '\n\nCRITICAL: Your previous response was in English. That violates instructions. ' +
        'Regenerate this message STRICTLY in Hinglish (Hindi-English code-mixed). Every sentence must contain Hindi words.';
      text = await callGemini(genAI, systemInstruction, retryPrompt);

      // If retry still fails the check, use the deterministic Hinglish template
      if (!looksLikeHinglish(text)) {
        console.warn(`[ReminderGenerator] hi-en retry still English — using Hinglish template fallback`);
        return template({ debtorName, tier, language, daysOverdue, brokenPromiseDate, amtStr, dateStr });
      }
    }

    return text;
  } catch (err) {
    console.error('[ReminderGenerator] Gemini error — falling back to template:', err.message);
    return template({ debtorName, tier, language, daysOverdue, brokenPromiseDate, amtStr, dateStr });
  }
}


// ─── Template fallback ────────────────────────────────────────────────────

function template({ debtorName, tier, language, daysOverdue, brokenPromiseDate, amtStr, dateStr }) {
  const broken = brokenPromiseDate
    ? ` We note that your earlier commitment to pay by ${brokenPromiseDate} was not fulfilled.`
    : '';

  if (language === 'hi-en') {
    if (tier === 'GENTLE')
      return `Namaste ${debtorName} ji! Aapka ${amtStr} ka invoice ${dateStr} ko due tha. Agar koi problem ho toh batayein, warna please jald payment kar dijiye. 🙏`;
    if (tier === 'FIRM')
      return `${debtorName} ji, aapka ${amtStr} ka invoice ${daysOverdue} din se overdue hai.${broken.replace('We note', 'Humne note kiya').replace('your earlier commitment to pay by', 'aapka')} Please turant payment karein, warna hum aage ki action lenge.`;
    return `${debtorName} ji, yeh final reminder hai regarding ${amtStr} ki pending payment.${broken.replace('We note', 'Humne note kiya')} Agar 24 ghante mein payment nahi aayi, toh hum ise legal review ke liye escalate karenge.`;
  }

  if (tier === 'GENTLE')
    return `Hi ${debtorName}, this is a friendly reminder that your invoice of ${amtStr} (due ${dateStr}) is now overdue.${broken} Please process the payment at your earliest convenience — we're happy to help if there's any issue.`;
  if (tier === 'FIRM')
    return `${debtorName}, your invoice of ${amtStr} is now ${daysOverdue} days overdue despite prior reminders.${broken} We request immediate payment to avoid further escalation. Please confirm or contact us urgently.`;
  return `${debtorName}, this is a final notice. Your invoice of ${amtStr} remains unpaid after ${daysOverdue} days and multiple reminders.${broken} If payment is not received within 24 hours, this account will be referred for formal legal review.`;
}

module.exports = { generateReminder };
