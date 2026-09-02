'use strict';

const express  = require('express');
const { runEscalationTick, getDemoDayOffset, incrementDayOffset, resetDayOffset } = require('../escalation_engine');

const router = express.Router();

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
 * Resets demo day offset to 0 (for re-running demos without reseeding).
 */
router.post('/reset', (_req, res) => {
  resetDayOffset();
  res.json({ message: 'Demo day offset reset to 0', dayOffset: 0 });
});

module.exports = router;
