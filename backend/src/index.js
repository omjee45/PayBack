'use strict';

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const cron    = require('node-cron');

const invoicesRouter  = require('./routes/invoices');
const webhooksRouter  = require('./routes/webhooks');
const dashboardRouter = require('./routes/dashboard');
const debtorsRouter   = require('./routes/debtors');
const cronRouter      = require('./routes/cron');
const { runEscalationTick, incrementDayOffset } = require('./escalation_engine');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── CORS ───────────────────────────────────────────────────────────────────
app.use(cors({
  origin:      process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// ── Raw body capture (for Razorpay webhook signature verification) ─────────
app.use((req, _res, next) => {
  if (req.path.startsWith('/api/webhooks')) {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end',  ()    => { req.rawBody = raw; next(); });
  } else {
    next();
  }
});

app.use(express.json());

// ── BigInt → string in JSON responses ─────────────────────────────────────
app.set('json replacer', (_k, v) => (typeof v === 'bigint' ? v.toString() : v));

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/invoices',  invoicesRouter);
app.use('/api/webhooks',  webhooksRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/debtors',   debtorsRouter);
app.use('/api/cron',      cronRouter);

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
);

// ── Optional auto-cron (every 5 min, disabled by default) ─────────────────
if (process.env.AUTO_CRON_ENABLED === 'true') {
  cron.schedule('*/5 * * * *', async () => {
    console.log('[AutoCron] Ticking...');
    try {
      incrementDayOffset();
      const r = await runEscalationTick();
      console.log(`[AutoCron] Processed ${r.processed} invoices, ${r.transitions.length} transitions`);
    } catch (err) {
      console.error('[AutoCron] Error:', err.message);
    }
  });
}

// ── Start ──────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║  🚀  PayBack API ready                   ║
║      http://localhost:${PORT}               ║
║  📊  Dashboard → http://localhost:3000   ║
║  🔑  Gemini: ${process.env.GEMINI_API_KEY ? '✅ configured' : '⚠️  not set (mock mode)  '}  ║
║  💳  Razorpay: ${process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_ID !== 'rzp_test_YOUR_KEY_HERE' ? '✅ configured' : '⚠️  not set (mock mode)'}  ║
╚══════════════════════════════════════════╝
  `);
});
