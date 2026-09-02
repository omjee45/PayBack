'use strict';

const express  = require('express');
const { prisma } = require('../db');

const router = express.Router();

/**
 * GET /api/dashboard/summary
 * Returns top-line recovery metrics used by the dashboard.
 */
router.get('/summary', async (req, res) => {
  try {
    const all = await prisma.invoice.findMany({
      select: { amountPaise: true, status: true },
    });

    let outstanding = 0n;
    let recovered   = 0n;
    let exceptions  = 0;
    const statusCounts = {};

    for (const inv of all) {
      statusCounts[inv.status] = (statusCounts[inv.status] ?? 0) + 1;
      if (inv.status === 'PAID') {
        recovered += inv.amountPaise;
      } else {
        outstanding += inv.amountPaise;
        if (inv.status === 'LEGAL_FLAG') exceptions++;
      }
    }

    const total = outstanding + recovered;
    const recoveryRate = total > 0n
      ? parseFloat((Number(recovered * 10000n / total) / 100).toFixed(2))
      : 0;

    // ── By-tier breakdown (how much ₹ recovered at each stage) ────────────
    // Reads STATE_CHANGE events where payload.to === 'PAID'
    const paidEvents = await prisma.event.findMany({
      where:   { eventType: 'STATE_CHANGE', payload: { contains: '"to":"PAID"' } },
      include: { invoice: { select: { amountPaise: true } } },
    });

    const byTier = { GENTLE: 0, FIRM: 0, ESCALATION: 0, PROMISED: 0, DUE: 0, OTHER: 0 };
    for (const evt of paidEvents) {
      try {
        const p = JSON.parse(evt.payload ?? '{}');
        const k = Object.prototype.hasOwnProperty.call(byTier, p.from ?? '') ? p.from : 'OTHER';
        byTier[k] += Number(evt.invoice.amountPaise);
      } catch { /* skip malformed */ }
    }

    res.json({
      totalOutstandingPaise: Number(outstanding),
      totalRecoveredPaise:   Number(recovered),
      recoveryRate,
      exceptionCount:        exceptions,
      totalInvoices:         all.length,
      statusCounts,
      byTier,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
