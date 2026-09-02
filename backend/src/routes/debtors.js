'use strict';

const express    = require('express');
const { prisma } = require('../db');

const router = express.Router();

/** Serialise BigInt amountPaise fields. */
function serInvoice(inv) { return { ...inv, amountPaise: Number(inv.amountPaise) }; }

// ── GET /api/debtors — leaderboard list ───────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const debtors = await prisma.debtor.findMany({
      include: {
        invoices: {
          include: { promises: true },
          select:  { id: true, status: true, amountPaise: true, promises: true },
        },
      },
      orderBy: { reliabilityScore: 'asc' }, // worst first
    });

    const result = debtors.map(d => {
      const allPromises    = d.invoices.flatMap(i => i.promises);
      const promisesKept   = allPromises.filter(p => p.status === 'KEPT').length;
      const promisesBroken = allPromises.filter(p => p.status === 'BROKEN').length;
      return {
        ...d,
        invoices: d.invoices.map(i => ({ ...serInvoice(i), promises: undefined })),
        promiseStats: { kept: promisesKept, broken: promisesBroken, pending: allPromises.filter(p => p.status === 'PENDING').length },
      };
    });

    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/debtors/:id — detail ─────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const d = await prisma.debtor.findUnique({
      where:   { id: req.params.id },
      include: {
        invoices: {
          include: { promises: { orderBy: { createdAt: 'desc' } }, events: { orderBy: { createdAt: 'asc' } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!d) return res.status(404).json({ error: 'Debtor not found' });

    const allPromises    = d.invoices.flatMap(i => i.promises);
    const promisesKept   = allPromises.filter(p => p.status === 'KEPT').length;
    const promisesBroken = allPromises.filter(p => p.status === 'BROKEN').length;

    res.json({
      ...d,
      invoices: d.invoices.map(serInvoice),
      promiseStats: { kept: promisesKept, broken: promisesBroken, pending: allPromises.filter(p => p.status === 'PENDING').length },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
