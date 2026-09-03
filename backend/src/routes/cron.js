'use strict';

const express  = require('express');
const { runEscalationTick, getDemoDayOffset, incrementDayOffset, resetDayOffset } = require('../escalation_engine');
const { reseedDatabase } = require('../seed_data');

const router = express.Router();

// Simple in-memory lock — prevents concurrent reset calls causing partial wipe/reseed
let resetting = false;

/**
 * POST /api/cron/tick
 * Advances the demo day counter by 1 and runs one full escalation cycle.
 * The key demo mechanism — call this to simulate days passing.
 */
router.post('/tick', async (req, res) => {
  try {
    incrementDayOffset();
    const result = await runEscalationTick();
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/**
 * GET /api/cron/status
 * Returns current demo day offset.
 */
router.get('/status', (_req, res) => {
  res.json({ dayOffset: getDemoDayOffset() });
});

/**
 * POST /api/cron/reset
 * Wipes all DB data, re-seeds the full 55-invoice Shreeji Textiles demo,
 * and resets the demo day offset to 0. Full clean slate in one click.
 */
router.post('/reset', async (_req, res) => {
  if (resetting) {
    return res.status(429).json({ error: 'Reset already in progress — please wait and try again.' });
  }
  resetting = true;
  try {
    console.log('[Reset] Wiping and reseeding database...');
    await reseedDatabase();
    resetDayOffset();
    console.log('[Reset] Done — 55 invoices, 18 debtors, 14 promises restored.');
    res.json({ message: 'Demo reset — full seed restored', dayOffset: 0, invoices: 55, debtors: 18, promises: 14 });
  } catch (err) {
    console.error('[Reset] Error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    resetting = false;
  }
});

module.exports = router;
