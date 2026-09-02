'use strict';

require('dotenv').config();
const { prisma }          = require('./db');
const { generateReminder } = require('./reminder_generator');

// ─── JSDoc typedefs ────────────────────────────────────────────────────────

/**
 * @typedef {Object} TickTransition
 * @property {string} invoiceId
 * @property {string} debtorName
 * @property {string} fromStatus
 * @property {string} toStatus
 * @property {string} reason
 */

/**
 * @typedef {Object} TickResult
 * @property {number}           dayOffset
 * @property {string}           effectiveDate
 * @property {number}           processed
 * @property {number}           skipped
 * @property {TickTransition[]} transitions
 * @property {number}           remindersSent
 */

// ─── Demo Day Offset ───────────────────────────────────────────────────────
// In-memory. POST /api/cron/tick increments it. Resets on server restart.

let demoDayOffset = 0;

function getDemoDayOffset()   { return demoDayOffset; }
function incrementDayOffset() { demoDayOffset++;       }
function resetDayOffset()     { demoDayOffset = 0;     }

/** Returns "today" adjusted by the demo offset (noon to avoid timezone edge cases). */
function getEffectiveDate() {
  const d = new Date();
  d.setDate(d.getDate() + demoDayOffset);
  d.setHours(12, 0, 0, 0);
  return d;
}

// ─── Thresholds (days overdue → tier) ────────────────────────────────────
const T = {
  GENTLE_START:    1,
  FIRM_START:      4,
  ESCALATION_START: 8,
  LEGAL_FLAG_START: 15,
};

// ─── Internal helpers ─────────────────────────────────────────────────────

function getDaysOverdue(dueDate, effectiveDate) {
  const due = new Date(dueDate); due.setHours(0, 0, 0, 0);
  const eff = new Date(effectiveDate); eff.setHours(0, 0, 0, 0);
  return Math.floor((eff - due) / 86_400_000);
}

function tierFromDays(days) {
  if (days < T.FIRM_START)       return 'GENTLE';
  if (days < T.ESCALATION_START) return 'FIRM';
  if (days < T.LEGAL_FLAG_START) return 'ESCALATION';
  return 'LEGAL_FLAG';
}

async function logEvent(invoiceId, eventType, payload, at) {
  await prisma.event.create({
    data: {
      invoiceId,
      eventType,
      payload:   JSON.stringify(payload),
      createdAt: at ?? new Date(),
    },
  });
}

async function setStatus(invoiceId, status) {
  await prisma.invoice.update({ where: { id: invoiceId }, data: { status } });
}

// ─── Main tick ────────────────────────────────────────────────────────────

/**
 * Runs one escalation cycle.
 * @returns {Promise<TickResult>}
 */
async function runEscalationTick() {
  const effectiveDate = getEffectiveDate();
  const now           = new Date();

  const activeInvoices = await prisma.invoice.findMany({
    where:   { status: { notIn: ['PAID', 'LEGAL_FLAG'] } },
    include: {
      debtor:   true,
      promises: { where: { status: 'PENDING' }, orderBy: { createdAt: 'desc' }, take: 1 },
      reminders:{ orderBy: { sentAt: 'desc' }, take: 1 },
    },
  });

  /** @type {TickTransition[]} */
  const transitions  = [];
  let remindersSent  = 0;
  let skipped        = 0;

  for (const invoice of activeInvoices) {
    const daysOverdue = getDaysOverdue(invoice.dueDate, effectiveDate);
    if (daysOverdue <= 0) { skipped++; continue; }

    const pendingPromise = invoice.promises[0] ?? null;

    // ── Promise branch ────────────────────────────────────────────────────
    if (pendingPromise) {
      const promisedDay = new Date(pendingPromise.promisedDate); promisedDay.setHours(0,0,0,0);
      const effDay      = new Date(effectiveDate);               effDay.setHours(0,0,0,0);

      if (effDay <= promisedDay) { skipped++; continue; } // clock is held

      // Promise BROKEN — escalate, skip a tier
      const newStatus = (invoice.status === 'GENTLE' || invoice.status === 'PROMISED')
        ? 'ESCALATION'   // skip FIRM
        : 'LEGAL_FLAG';  // was already at FIRM or higher

      await prisma.promise.update({
        where: { id: pendingPromise.id },
        data:  { status: 'BROKEN', resolvedAt: now },
      });

      const newScore = Math.max(0, invoice.debtor.reliabilityScore - 20);
      await prisma.debtor.update({ where: { id: invoice.debtorId }, data: { reliabilityScore: newScore } });

      await logEvent(invoice.id, 'PROMISE_BROKEN', {
        promiseId:   pendingPromise.id,
        promisedDate: pendingPromise.promisedDate,
        rawReply:    pendingPromise.rawReplyText,
        reliabilityScoreNow: newScore,
      });

      if (newStatus === 'LEGAL_FLAG') {
        await setStatus(invoice.id, 'LEGAL_FLAG');
        await logEvent(invoice.id, 'STATE_CHANGE', { from: invoice.status, to: 'LEGAL_FLAG', reason: 'broken_promise' });
        transitions.push({ invoiceId: invoice.id, debtorName: invoice.debtor.name, fromStatus: invoice.status, toStatus: 'LEGAL_FLAG', reason: 'Broken promise — escalated to LEGAL_FLAG' });
        continue;
      }

      // Send escalation reminder referencing the broken promise
      const brokenDateStr = new Date(pendingPromise.promisedDate)
        .toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

      const msg = await generateReminder({
        debtorName:       invoice.debtor.name,
        amountPaise:      invoice.amountPaise,
        dueDate:          invoice.dueDate,
        daysOverdue,
        tier:             'ESCALATION',
        language:         invoice.debtor.preferredLanguage,
        brokenPromiseDate: brokenDateStr,
      });

      await prisma.reminder.create({ data: {
        invoiceId: invoice.id, tier: 'ESCALATION', channel: 'whatsapp',
        messageText: msg, language: invoice.debtor.preferredLanguage, sentAt: now,
      }});

      await setStatus(invoice.id, newStatus);
      await logEvent(invoice.id, 'STATE_CHANGE', { from: invoice.status, to: newStatus, reason: 'broken_promise_escalation' });
      await logEvent(invoice.id, 'REMINDER_SENT', { tier: 'ESCALATION', channel: 'whatsapp', brokenPromise: true });

      transitions.push({ invoiceId: invoice.id, debtorName: invoice.debtor.name, fromStatus: invoice.status, toStatus: newStatus, reason: `Broken promise (was due ${brokenDateStr}) — skipped tier` });
      remindersSent++;
      continue;
    }

    // ── Normal escalation ─────────────────────────────────────────────────
    const targetTier = tierFromDays(daysOverdue);

    if (targetTier === 'LEGAL_FLAG') {
      if (invoice.status !== 'LEGAL_FLAG') {
        await setStatus(invoice.id, 'LEGAL_FLAG');
        await logEvent(invoice.id, 'STATE_CHANGE', { from: invoice.status, to: 'LEGAL_FLAG', reason: `${daysOverdue}_days_overdue` });
        transitions.push({ invoiceId: invoice.id, debtorName: invoice.debtor.name, fromStatus: invoice.status, toStatus: 'LEGAL_FLAG', reason: `${daysOverdue} days overdue — terminal` });
      }
      continue;
    }

    // Max 1 reminder per invoice per real calendar day
    const lastReminder = invoice.reminders[0];
    if (lastReminder) {
      const lastDay = new Date(lastReminder.sentAt); lastDay.setHours(0,0,0,0);
      const todayDay = new Date(now);                todayDay.setHours(0,0,0,0);
      if (lastDay.getTime() === todayDay.getTime()) {
        if (invoice.status !== targetTier) {
          await setStatus(invoice.id, targetTier);
          await logEvent(invoice.id, 'STATE_CHANGE', { from: invoice.status, to: targetTier, reason: 'status_sync' });
        }
        skipped++;
        continue;
      }
    }

    // Generate + log reminder
    const msg = await generateReminder({
      debtorName:  invoice.debtor.name,
      amountPaise: invoice.amountPaise,
      dueDate:     invoice.dueDate,
      daysOverdue,
      tier:        targetTier,
      language:    invoice.debtor.preferredLanguage,
    });

    await prisma.reminder.create({ data: {
      invoiceId: invoice.id, tier: targetTier, channel: 'whatsapp',
      messageText: msg, language: invoice.debtor.preferredLanguage, sentAt: now,
    }});

    const prevStatus = invoice.status;
    if (prevStatus !== targetTier) {
      await setStatus(invoice.id, targetTier);
      await logEvent(invoice.id, 'STATE_CHANGE', { from: prevStatus, to: targetTier, reason: `${daysOverdue}_days_overdue` });
      transitions.push({ invoiceId: invoice.id, debtorName: invoice.debtor.name, fromStatus: prevStatus, toStatus: targetTier, reason: `${daysOverdue} days overdue` });
    }
    await logEvent(invoice.id, 'REMINDER_SENT', { tier: targetTier, channel: 'whatsapp', daysOverdue });
    remindersSent++;
  }

  return { dayOffset: demoDayOffset, effectiveDate: effectiveDate.toISOString(), processed: activeInvoices.length, skipped, transitions, remindersSent };
}

module.exports = { getDemoDayOffset, incrementDayOffset, resetDayOffset, getEffectiveDate, runEscalationTick };
