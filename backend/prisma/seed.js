'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// Shreeji Textiles — Surat garment wholesaler chasing retail shop clients
// 18 debtors · 55 invoices · 14 promises
//
// Group A (22): PAID via GENTLE      — prompt payers
// Group B (14): PAID via FIRM        — slow but paid after escalation
// Group C (8):  PROMISED, future     — will pay on time (pending)
// Group D (6):  PROMISED, PAST date  — ⚡ DEMO MONEY SHOT: first tick breaks all 6
// Group E (5):  LEGAL_FLAG           — never paid, honest exceptions
// ─────────────────────────────────────────────────────────────────────────────

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// ── Helpers ────────────────────────────────────────────────────────────────

function daysAgo(n) {
  const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return d;
}
function daysFromNow(n) {
  const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d;
}
function mockLink(invId) {
  return { id: `pl_${invId}`, url: `https://rzp.io/l/${invId}` };
}

async function addEvent(invoiceId, type, payload, daysBack = 0) {
  await prisma.event.create({
    data: {
      invoiceId, eventType: type,
      payload: JSON.stringify(payload),
      createdAt: daysAgo(Math.max(0, daysBack)),
    }
  });
}
async function addReminder(invoiceId, tier, lang, message, daysBack = 0) {
  await prisma.reminder.create({
    data: {
      invoiceId, tier, channel: 'whatsapp', messageText: message, language: lang,
      sentAt: daysAgo(Math.max(0, daysBack)),
    }
  });
}

// ── Message templates ──────────────────────────────────────────────────────

const M = {
  gentle: (n, paise, lang) => {
    const a = (paise / 100).toLocaleString('en-IN');
    return lang === 'hi-en'
      ? `Namaste ${n} ji! Aapka ₹${a} ka Shreeji Textiles ka invoice due ho gaya hai. Koi issue ho toh batayein, warna please jald payment kar dijiye. 🙏`
      : `Hi ${n}, just a friendly reminder that your invoice of ₹${a} from Shreeji Textiles is now overdue. Please process it at your earliest convenience.`;
  },
  firm: (n, paise, days, lang) => {
    const a = (paise / 100).toLocaleString('en-IN');
    return lang === 'hi-en'
      ? `${n} ji, aapka ₹${a} ka invoice ${days} din se overdue hai. Please turant payment karein, warna hum aage ki action lene ko majboor honge.`
      : `${n}, your invoice of ₹${a} is now ${days} days overdue despite our prior reminder. We request immediate payment to avoid further escalation.`;
  },
  escalation: (n, paise, broken, lang) => {
    const a = (paise / 100).toLocaleString('en-IN');
    const b = broken ? (lang === 'hi-en'
      ? ` Aapne ${broken} ko payment ka vaada kiya tha jo fulfill nahi hua.`
      : ` We note that your commitment to pay by ${broken} was not fulfilled.`) : '';
    return lang === 'hi-en'
      ? `${n} ji, yeh final reminder hai regarding ₹${a} ki pending payment.${b} 24 ghante mein payment nahi aayi toh hum ise legal review ke liye refer karenge.`
      : `${n}, this is a final notice regarding your overdue payment of ₹${a}.${b} Formal legal review will begin within 24 hours if payment is not received.`;
  },
};

// ── Scenario builders ──────────────────────────────────────────────────────

/**
 * Group A: Invoice paid after a single gentle reminder.
 */
async function createPaidGentle(invId, debtorId, debtor, amtPaise, dueDaysAgo, paidDaysAgo) {
  const lnk = mockLink(invId);
  await prisma.invoice.create({
    data: {
      id: invId, debtorId,
      amountPaise: BigInt(amtPaise),
      dueDate: daysAgo(dueDaysAgo),
      status: 'PAID',
      razorpayPaymentLinkId: lnk.id, razorpayPaymentLinkUrl: lnk.url,
      paidAt: daysAgo(paidDaysAgo),
    }
  });
  const overdueDays = dueDaysAgo - paidDaysAgo;
  await addEvent(invId, 'STATE_CHANGE', { from: 'DUE', to: 'GENTLE', reason: '1_days_overdue' }, dueDaysAgo - 1);
  await addReminder(invId, 'GENTLE', debtor.preferredLanguage, M.gentle(debtor.name, amtPaise, debtor.preferredLanguage), dueDaysAgo - 1);
  await addEvent(invId, 'REMINDER_SENT', { tier: 'GENTLE', daysOverdue: 1 }, dueDaysAgo - 1);
  await addEvent(invId, 'WEBHOOK_RECEIVED', { event: 'payment.captured', amountPaise: amtPaise }, paidDaysAgo);
  await addEvent(invId, 'STATE_CHANGE', { from: 'GENTLE', to: 'PAID', reason: 'payment_captured' }, paidDaysAgo);
}

/**
 * Group B: Invoice paid after reaching the FIRM tier.
 */
async function createPaidFirm(invId, debtorId, debtor, amtPaise, dueDaysAgo, paidDaysAgo) {
  const lnk = mockLink(invId);
  await prisma.invoice.create({
    data: {
      id: invId, debtorId,
      amountPaise: BigInt(amtPaise),
      dueDate: daysAgo(dueDaysAgo),
      status: 'PAID',
      razorpayPaymentLinkId: lnk.id, razorpayPaymentLinkUrl: lnk.url,
      paidAt: daysAgo(paidDaysAgo),
    }
  });
  await addEvent(invId, 'STATE_CHANGE', { from: 'DUE', to: 'GENTLE', reason: '1_days_overdue' }, dueDaysAgo - 1);
  await addReminder(invId, 'GENTLE', debtor.preferredLanguage, M.gentle(debtor.name, amtPaise, debtor.preferredLanguage), dueDaysAgo - 1);
  await addEvent(invId, 'REMINDER_SENT', { tier: 'GENTLE' }, dueDaysAgo - 1);
  await addEvent(invId, 'STATE_CHANGE', { from: 'GENTLE', to: 'FIRM', reason: '4_days_overdue' }, dueDaysAgo - 4);
  await addReminder(invId, 'FIRM', debtor.preferredLanguage, M.firm(debtor.name, amtPaise, 4, debtor.preferredLanguage), dueDaysAgo - 4);
  await addEvent(invId, 'REMINDER_SENT', { tier: 'FIRM' }, dueDaysAgo - 4);
  await addEvent(invId, 'WEBHOOK_RECEIVED', { event: 'payment.captured', amountPaise: amtPaise }, paidDaysAgo);
  await addEvent(invId, 'STATE_CHANGE', { from: 'FIRM', to: 'PAID', reason: 'payment_captured' }, paidDaysAgo);
}

/**
 * Group C: PROMISED with a FUTURE promised date — escalation clock is held.
 * Promise status: PENDING. Engine skips these until date passes.
 */
async function createPromisedFuture(invId, promiseId, debtorId, debtor, amtPaise, dueDaysAgo, replyText, futureDays, confidence) {
  const lnk = mockLink(invId);
  await prisma.invoice.create({
    data: {
      id: invId, debtorId,
      amountPaise: BigInt(amtPaise),
      dueDate: daysAgo(dueDaysAgo),
      status: 'PROMISED',
      razorpayPaymentLinkId: lnk.id, razorpayPaymentLinkUrl: lnk.url,
    }
  });

  const promisedDate = daysFromNow(futureDays);

  await addEvent(invId, 'STATE_CHANGE', { from: 'DUE', to: 'GENTLE', reason: '1_days_overdue' }, dueDaysAgo - 1);
  await addReminder(invId, 'GENTLE', debtor.preferredLanguage, M.gentle(debtor.name, amtPaise, debtor.preferredLanguage), dueDaysAgo - 1);
  await addEvent(invId, 'REMINDER_SENT', { tier: 'GENTLE' }, dueDaysAgo - 1);
  await addEvent(invId, 'STATE_CHANGE', { from: 'GENTLE', to: 'PROMISED', reason: 'promise_captured' }, 0);

  await prisma.promise.create({
    data: {
      id: promiseId, invoiceId: invId,
      rawReplyText: replyText,
      promisedDate,
      extractionConfidence: confidence,
      status: 'PENDING',
    }
  });

  await addEvent(invId, 'PROMISE_CAPTURED', { promiseId, promisedDate: promisedDate.toISOString(), confidence }, 0);
}

/**
 * Group D: PROMISED but promisedDate is already in the PAST, status still PENDING.
 * ⚡ The DEMO MONEY SHOT — on the first POST /api/cron/tick, the engine will:
 *    1. Detect promisedDate < effectiveDate for these 6 invoices
 *    2. Mark promises BROKEN
 *    3. Drop debtor reliabilityScore by 20 each
 *    4. Skip a tier: PROMISED → ESCALATION (not FIRM)
 *    5. Send an escalation reminder referencing the broken commitment
 * All 6 transitions appear in the tick result UI instantly.
 */
async function createBrokenPending(invId, promiseId, debtorId, debtor, amtPaise, dueDaysAgo, replyText, pastDays, confidence) {
  const lnk = mockLink(invId);
  await prisma.invoice.create({
    data: {
      id: invId, debtorId,
      amountPaise: BigInt(amtPaise),
      dueDate: daysAgo(dueDaysAgo),
      status: 'PROMISED',          // ← still PROMISED — engine hasn't ticked yet
      razorpayPaymentLinkId: lnk.id, razorpayPaymentLinkUrl: lnk.url,
    }
  });

  const promisedDate = daysAgo(pastDays);    // ← already in the past!
  const captureDaysAgo = pastDays + 2;         // promise was captured 2 days before the promised date

  await addEvent(invId, 'STATE_CHANGE', { from: 'DUE', to: 'GENTLE', reason: '1_days_overdue' }, dueDaysAgo - 1);
  await addReminder(invId, 'GENTLE', debtor.preferredLanguage, M.gentle(debtor.name, amtPaise, debtor.preferredLanguage), dueDaysAgo - 1);
  await addEvent(invId, 'REMINDER_SENT', { tier: 'GENTLE' }, dueDaysAgo - 1);
  await addEvent(invId, 'STATE_CHANGE', { from: 'GENTLE', to: 'PROMISED', reason: 'promise_captured' }, captureDaysAgo);

  await prisma.promise.create({
    data: {
      id: promiseId, invoiceId: invId,
      rawReplyText: replyText,
      promisedDate,               // ← past date — engine will break this
      extractionConfidence: confidence,
      status: 'PENDING',          // ← engine hasn't run yet
      createdAt: daysAgo(captureDaysAgo),
    }
  });

  await addEvent(invId, 'PROMISE_CAPTURED', {
    promiseId, promisedDate: promisedDate.toISOString(), confidence,
  }, captureDaysAgo);
}

/**
 * Group E: Fully escalated to LEGAL_FLAG — never paid, full audit trail.
 */
async function createLegalFlag(invId, debtorId, debtor, amtPaise, dueDaysAgo) {
  const lnk = mockLink(invId);
  await prisma.invoice.create({
    data: {
      id: invId, debtorId,
      amountPaise: BigInt(amtPaise),
      dueDate: daysAgo(dueDaysAgo),
      status: 'LEGAL_FLAG',
      razorpayPaymentLinkId: lnk.id, razorpayPaymentLinkUrl: lnk.url,
    }
  });
  await addEvent(invId, 'STATE_CHANGE', { from: 'DUE', to: 'GENTLE', reason: '1_days_overdue' }, dueDaysAgo - 1);
  await addReminder(invId, 'GENTLE', debtor.preferredLanguage, M.gentle(debtor.name, amtPaise, debtor.preferredLanguage), dueDaysAgo - 1);
  await addEvent(invId, 'REMINDER_SENT', { tier: 'GENTLE' }, dueDaysAgo - 1);
  await addEvent(invId, 'STATE_CHANGE', { from: 'GENTLE', to: 'FIRM', reason: '4_days_overdue' }, dueDaysAgo - 4);
  await addReminder(invId, 'FIRM', debtor.preferredLanguage, M.firm(debtor.name, amtPaise, 4, debtor.preferredLanguage), dueDaysAgo - 4);
  await addEvent(invId, 'REMINDER_SENT', { tier: 'FIRM' }, dueDaysAgo - 4);
  await addEvent(invId, 'STATE_CHANGE', { from: 'FIRM', to: 'ESCALATION', reason: '8_days_overdue' }, dueDaysAgo - 8);
  await addReminder(invId, 'ESCALATION', debtor.preferredLanguage, M.escalation(debtor.name, amtPaise, null, debtor.preferredLanguage), dueDaysAgo - 8);
  await addEvent(invId, 'REMINDER_SENT', { tier: 'ESCALATION' }, dueDaysAgo - 8);
  await addEvent(invId, 'STATE_CHANGE', { from: 'ESCALATION', to: 'LEGAL_FLAG', reason: '15_days_overdue' }, dueDaysAgo - 15);
}

// ── Debtors — Shreeji Textiles' retail shop clients across India ──────────

const DEBTORS = [
  { id: 'd001', name: 'Meena Garments, Jaipur', contactEmail: 'meena.garments@example.com', contactPhone: '+919810000001', preferredLanguage: 'hi-en', reliabilityScore: 100 },
  { id: 'd002', name: 'Royal Fashion House, Delhi', contactEmail: 'royalfashion@example.com', contactPhone: '+919810000002', preferredLanguage: 'en', reliabilityScore: 100 },
  { id: 'd003', name: 'Shubham Textiles, Indore', contactEmail: 'shubham.tex@example.com', contactPhone: '+919810000003', preferredLanguage: 'hi-en', reliabilityScore: 100 },
  { id: 'd004', name: 'Priya Boutique, Pune', contactEmail: 'priyaboutique@example.com', contactPhone: '+919810000004', preferredLanguage: 'en', reliabilityScore: 100 },
  { id: 'd005', name: 'New Look Collection, Lucknow', contactEmail: 'newlook.col@example.com', contactPhone: '+919810000005', preferredLanguage: 'hi-en', reliabilityScore: 100 },
  { id: 'd006', name: 'Ashirwad Clothing, Ahmedabad', contactEmail: 'ashirwad.cloth@example.com', contactPhone: '+919810000006', preferredLanguage: 'hi-en', reliabilityScore: 100 },
  { id: 'd007', name: 'Trendz Wear, Bangalore', contactEmail: 'trendzwear@example.com', contactPhone: '+919810000007', preferredLanguage: 'en', reliabilityScore: 100 },
  { id: 'd008', name: 'Om Sai Fabrics, Nagpur', contactEmail: 'omsaifabrics@example.com', contactPhone: '+919810000008', preferredLanguage: 'hi-en', reliabilityScore: 100 },
  { id: 'd009', name: 'Elegance Store, Chandigarh', contactEmail: 'elegancestore@example.com', contactPhone: '+919810000009', preferredLanguage: 'en', reliabilityScore: 100 },
  { id: 'd010', name: 'Krishna Textile Mart, Kanpur', contactEmail: 'krishnamart@example.com', contactPhone: '+919810000010', preferredLanguage: 'hi-en', reliabilityScore: 100 },
  { id: 'd011', name: 'Fashion Point, Bhopal', contactEmail: 'fashionpoint@example.com', contactPhone: '+919810000011', preferredLanguage: 'hi-en', reliabilityScore: 100 },
  { id: 'd012', name: 'Style Studio, Chennai', contactEmail: 'stylestudio@example.com', contactPhone: '+919810000012', preferredLanguage: 'en', reliabilityScore: 100 },
  { id: 'd013', name: 'Radhe Krishna Cloth Co, Rajkot', contactEmail: 'radhekrishna@example.com', contactPhone: '+919810000013', preferredLanguage: 'hi-en', reliabilityScore: 100 },
  { id: 'd014', name: 'Urban Threads, Hyderabad', contactEmail: 'urbanthreads@example.com', contactPhone: '+919810000014', preferredLanguage: 'en', reliabilityScore: 100 },
  { id: 'd015', name: 'Sitaram & Sons, Varanasi', contactEmail: 'sitaramsons@example.com', contactPhone: '+919810000015', preferredLanguage: 'hi-en', reliabilityScore: 100 },
  { id: 'd016', name: 'Classic Wear, Mumbai', contactEmail: 'classicwear@example.com', contactPhone: '+919810000016', preferredLanguage: 'en', reliabilityScore: 100 },
  { id: 'd017', name: 'Ganpati Garments, Nashik', contactEmail: 'ganpatigarments@example.com', contactPhone: '+919810000017', preferredLanguage: 'hi-en', reliabilityScore: 100 },
  { id: 'd018', name: 'The Fabric Store, Kolkata', contactEmail: 'fabricstore@example.com', contactPhone: '+919810000018', preferredLanguage: 'en', reliabilityScore: 100 },
];

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding PayBack — Shreeji Textiles demo data...\n');

  // Wipe all tables in dependency order
  await prisma.event.deleteMany();
  await prisma.promise.deleteMany();
  await prisma.reminder.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.debtor.deleteMany();

  // Create debtors (all start at reliabilityScore 100 — Group D breaks reduce them on first tick)
  const D = {};
  for (const data of DEBTORS) {
    D[data.id] = await prisma.debtor.create({ data });
  }
  console.log('✅ 18 debtors (Shreeji Textiles retail clients across India)');

  // ── GROUP A — PAID via GENTLE (22 invoices) ───────────────────────────
  // [invId, debtorId, amtPaise, dueDaysAgo, paidDaysAgo]
  const GA = [
    ['inv001', 'd001', 1250000, 2, 1], ['inv002', 'd002', 3400000, 1, 0],
    ['inv003', 'd003', 850000, 3, 2], ['inv004', 'd004', 2200000, 2, 1],
    ['inv005', 'd005', 1800000, 1, 0], ['inv006', 'd006', 4500000, 3, 2],
    ['inv007', 'd007', 950000, 2, 1], ['inv008', 'd008', 3100000, 1, 0],
    ['inv009', 'd009', 1600000, 2, 1], ['inv010', 'd010', 2750000, 3, 1],
    ['inv011', 'd011', 700000, 1, 0], ['inv012', 'd012', 5200000, 2, 1],
    ['inv013', 'd013', 1400000, 3, 2], ['inv014', 'd014', 3900000, 1, 0],
    ['inv015', 'd015', 2100000, 2, 1], ['inv016', 'd016', 6000000, 3, 2],
    ['inv017', 'd017', 1150000, 1, 0], ['inv018', 'd018', 2900000, 2, 1],
    ['inv019', 'd001', 800000, 3, 2], ['inv020', 'd004', 3600000, 1, 0],
    ['inv021', 'd007', 1950000, 2, 1], ['inv022', 'd012', 4100000, 3, 1],
  ];
  for (const [i, d, a, due, paid] of GA) await createPaidGentle(i, d, D[d], a, due, paid);
  console.log('✅ 22 PAID-via-GENTLE (Group A)');

  // ── GROUP B — PAID via FIRM (14 invoices) ─────────────────────────────
  // [invId, debtorId, amtPaise, dueDaysAgo, paidDaysAgo]
  const GB = [
    ['inv023', 'd002', 2800000, 6, 1], ['inv024', 'd005', 1700000, 5, 1],
    ['inv025', 'd008', 3300000, 7, 2], ['inv026', 'd011', 2000000, 6, 1],
    ['inv027', 'd014', 4700000, 5, 1], ['inv028', 'd017', 1300000, 7, 2],
    ['inv029', 'd003', 2600000, 6, 1], ['inv030', 'd006', 3800000, 5, 1],
    ['inv031', 'd009', 1900000, 7, 2], ['inv032', 'd013', 2400000, 6, 1],
    ['inv033', 'd016', 5500000, 5, 1], ['inv034', 'd018', 1600000, 7, 2],
    ['inv035', 'd001', 2100000, 6, 1], ['inv036', 'd010', 3200000, 5, 1],
  ];
  for (const [i, d, a, due, paid] of GB) await createPaidFirm(i, d, D[d], a, due, paid);
  console.log('✅ 14 PAID-via-FIRM (Group B)');

  // ── GROUP C — PROMISED, FUTURE date, PENDING (8 invoices) ────────────
  // Escalation engine clock is held until promisedDate passes.
  // [invId, promiseId, debtorId, amtPaise, dueDaysAgo, replyText, futureDays, confidence]
  const GC = [
    ['inv037', 'p001', 'd004', 4200000, 4, 'Sir payment kal tak ho jayega, thoda cash flow issue tha', 1, 0.91],
    ['inv038', 'p002', 'd007', 1850000, 5, 'Apologies for the delay, will clear this by Friday.', 2, 0.95],
    ['inv039', 'p003', 'd010', 3600000, 4, 'Bhai 2 din mein kar dete hain, order aane wala hai', 2, 0.88],
    ['inv040', 'p004', 'd013', 2300000, 6, 'Payment will be released from our end by next week Monday.', 3, 0.90],
    ['inv041', 'p005', 'd016', 5100000, 5, 'Kal subah tak transfer kar denge, confirm kar dena.', 1, 0.89],
    ['inv042', 'p006', 'd002', 1700000, 4, 'Will process this by end of this week for sure.', 2, 0.85],
    ['inv043', 'p007', 'd005', 2900000, 6, 'Do din mein ho jayega sir, GST filing ke baad karte hain.', 2, 0.87],
    ['inv044', 'p008', 'd008', 3400000, 5, 'Confirming payment by tomorrow evening.', 1, 0.93],
  ];
  for (const [i, p, d, a, due, reply, fut, conf] of GC)
    await createPromisedFuture(i, p, d, D[d], a, due, reply, fut, conf);
  console.log('✅  8 PROMISED, future date, PENDING (Group C) — clock held');

  // ── GROUP D — PROMISED, PAST date, PENDING — DEMO MONEY SHOT ─────────
  // promisedDate is already in the past, status is still PENDING.
  // POST /api/cron/tick will break all 6 simultaneously:
  //   • 6 promises → BROKEN
  //   • 6 invoices → ESCALATION (tier skipped)
  //   • 6 debtors  → reliabilityScore -20 each
  //   • 6 escalation reminders sent (via Gemini or template)
  // [invId, promiseId, debtorId, amtPaise, dueDaysAgo, replyText, pastDays, confidence]
  const GD = [
    ['inv045', 'p009', 'd003', 3900000, 9, 'Parso tak pakka kar denge, promise.', 3, 0.90],
    ['inv046', 'p010', 'd006', 2100000, 10, 'Will pay by this Wednesday without fail.', 4, 0.92],
    ['inv047', 'p011', 'd009', 4600000, 9, 'Ek din mein clear kar denge, tension mat lo.', 3, 0.86],
    ['inv048', 'p012', 'd012', 1800000, 11, 'Payment confirmed for last Monday, will be done.', 5, 0.88],
    ['inv049', 'p013', 'd015', 3300000, 9, 'Do din mein ho jayega, vaada hai.', 3, 0.91],
    ['inv050', 'p014', 'd018', 2700000, 10, 'By Thursday this will be settled.', 4, 0.87],
  ];
  for (const [i, p, d, a, due, reply, past, conf] of GD)
    await createBrokenPending(i, p, d, D[d], a, due, reply, past, conf);
  console.log('✅  6 PROMISED, PAST date, PENDING (Group D) ⚡ — will break on first tick');

  // ── GROUP E — LEGAL_FLAG, terminal (5 invoices) ───────────────────────
  // [invId, debtorId, amtPaise, dueDaysAgo]
  const GE = [
    ['inv051', 'd011', 5800000, 20],
    ['inv052', 'd014', 3200000, 22],
    ['inv053', 'd017', 2600000, 19],
    ['inv054', 'd001', 4400000, 25],
    ['inv055', 'd010', 1900000, 21],
  ];
  for (const [i, d, a, due] of GE) await createLegalFlag(i, d, D[d], a, due);
  console.log('✅  5 LEGAL_FLAG (Group E)');

  console.log(`
╔════════════════════════════════════════════════════════════╗
║  🌱  Seed complete — Shreeji Textiles, Surat              ║
║  Garment wholesaler · retail shop clients across India    ║
╠════════════════════════════════════════════════════════════╣
║  Debtors:  18  (all reliabilityScore 100 to start)        ║
║  Invoices: 55                                             ║
║  Promises: 14  (8 future-pending · 6 past-pending)        ║
╠════════════════════════════════════════════════════════════╣
║  ⚡  Demo flow:                                            ║
║  1. Open dashboard — see full ledger                      ║
║  2. POST /api/cron/tick  — 6 broken promises fire at once ║
║     Shubham Textiles, Ashirwad Clothing, Elegance Store,  ║
║     Style Studio, Sitaram & Sons, The Fabric Store        ║
║     → all jump to ESCALATION, scores drop to 80           ║
║  3. Tick again — active GENTLE invoices escalate to FIRM  ║
║  4. Simulate reply on any FIRM invoice to show Gemini     ║
║     promise extraction live                               ║
╚════════════════════════════════════════════════════════════╝
  `);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
