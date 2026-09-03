'use strict';

const express              = require('express');
const { z }                = require('zod');
const { prisma }           = require('../db');
const { createPaymentLink} = require('../razorpay_client');
const { extractPromise }   = require('../promise_extractor');

const router = express.Router();

// ── Helpers ────────────────────────────────────────────────────────────────

/** Convert BigInt amountPaise to Number for JSON serialisation. */
function ser(inv) { return { ...inv, amountPaise: Number(inv.amountPaise) }; }

/** Days overdue relative to today (real clock). */
function daysOverdue(dueDate) {
  const due = new Date(dueDate); due.setHours(0,0,0,0);
  const now = new Date();        now.setHours(0,0,0,0);
  return Math.max(0, Math.floor((now - due) / 86_400_000));
}

// ── GET /api/invoices ──────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    const invoices = await prisma.invoice.findMany({
      where:   status ? { status } : {},
      include: { debtor: true },
      orderBy: { updatedAt: 'desc' },
    });
    // Extra guard: skip any orphan rows that somehow slipped through
    res.json(
      invoices
        .filter(i => i.debtor != null)
        .map(i => ({ ...ser(i), daysOverdue: daysOverdue(i.dueDate) }))
    );
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// ── GET /api/invoices/:id ──────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const inv = await prisma.invoice.findUnique({
      where:   { id: req.params.id },
      include: {
        debtor:    true,
        reminders: { orderBy: { sentAt: 'desc' } },
        promises:  { orderBy: { createdAt: 'desc' } },
        events:    { orderBy: { createdAt: 'asc'  } },
      },
    });
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });
    res.json({ ...ser(inv), daysOverdue: daysOverdue(inv.dueDate) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/invoices/:id/payment-link ────────────────────────────────────
// Generate (or regenerate) a real Razorpay Payment Link for any invoice.
// Useful for seeded invoices that never had a real link created.
router.post('/:id/payment-link', async (req, res) => {
  try {
    const inv = await prisma.invoice.findUnique({
      where:   { id: req.params.id },
      include: { debtor: true },
    });
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });
    if (inv.status === 'PAID') return res.status(400).json({ error: 'Invoice already PAID' });

    const link = await createPaymentLink({
      amountPaise:  Number(inv.amountPaise),
      invoiceId:    inv.id,
      debtorName:   inv.debtor.name,
      debtorEmail:  inv.debtor.contactEmail,
      debtorPhone:  inv.debtor.contactPhone,
      description:  `Invoice — ₹${(Number(inv.amountPaise) / 100).toLocaleString('en-IN')} (${inv.debtor.name})`,
    });

    const updated = await prisma.invoice.update({
      where:   { id: inv.id },
      data:    { razorpayPaymentLinkId: link.id, razorpayPaymentLinkUrl: link.short_url },
      include: { debtor: true },
    });

    res.json({ invoiceId: inv.id, paymentLinkId: link.id, paymentLinkUrl: link.short_url, ...ser(updated) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// ── POST /api/invoices ─────────────────────────────────────────────────────
const CreateSchema = z.object({
  debtorName:       z.string().min(1),
  contactEmail:     z.string().email().optional().or(z.literal('')),
  contactPhone:     z.string().optional(),
  preferredLanguage:z.enum(['en','hi-en']).default('en'),
  amountPaise:      z.number().int().positive(),
  dueDate:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
  existingDebtorId: z.string().optional(),
});

router.post('/', async (req, res) => {
  try {
    const body = CreateSchema.parse(req.body);

    // Get or create debtor
    let debtorId = body.existingDebtorId;
    if (!debtorId) {
      const d = await prisma.debtor.create({ data: {
        name:              body.debtorName,
        contactEmail:      body.contactEmail  || null,
        contactPhone:      body.contactPhone  || null,
        preferredLanguage: body.preferredLanguage,
      }});
      debtorId = d.id;
    }

    // Create invoice (need ID for payment link notes)
    const inv = await prisma.invoice.create({ data: {
      debtorId,
      amountPaise: BigInt(body.amountPaise),
      dueDate:     new Date(body.dueDate),
      status:      'DUE',
    }});

    // Create payment link (mocked or real)
    const debtor = await prisma.debtor.findUnique({ where: { id: debtorId } });
    const link   = await createPaymentLink({
      amountPaise:  body.amountPaise,
      invoiceId:    inv.id,
      debtorName:   debtor.name,
      debtorEmail:  debtor.contactEmail,
      debtorPhone:  debtor.contactPhone,
      description:  `Invoice — ₹${(body.amountPaise / 100).toLocaleString('en-IN')}`,
    });

    const updated = await prisma.invoice.update({
      where: { id: inv.id },
      data:  { razorpayPaymentLinkId: link.id, razorpayPaymentLinkUrl: link.short_url },
      include: { debtor: true },
    });

    await prisma.event.create({ data: {
      invoiceId: inv.id, eventType: 'STATE_CHANGE',
      payload: JSON.stringify({ from: null, to: 'DUE', reason: 'invoice_created' }),
    }});

    res.status(201).json(ser(updated));
  } catch (err) {
    if (err?.name === 'ZodError') return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/invoices/:id/simulate-reply ──────────────────────────────────
router.post('/:id/simulate-reply', async (req, res) => {
  try {
    const inv = await prisma.invoice.findUnique({
      where:   { id: req.params.id },
      include: { debtor: true },
    });
    if (!inv)                       return res.status(404).json({ error: 'Invoice not found' });
    if (inv.status === 'PAID')      return res.status(400).json({ error: 'Invoice already PAID' });
    if (inv.status === 'LEGAL_FLAG')return res.status(400).json({ error: 'LEGAL_FLAG — no auto-chasing' });

    const { reply_text } = req.body;
    if (!reply_text?.trim()) return res.status(400).json({ error: 'reply_text is required' });

    const todayDate = new Date().toISOString().split('T')[0];
    const extracted = await extractPromise(reply_text, todayDate);

    if (!extracted.has_promise || !extracted.promised_date) {
      return res.json({
        extracted,
        promise: null,
        message: 'No specific promise detected — invoice status unchanged',
        invoice: ser(inv),
      });
    }

    // Create promise record
    const promise = await prisma.promise.create({ data: {
      invoiceId:             inv.id,
      rawReplyText:          reply_text,
      promisedDate:          new Date(extracted.promised_date),
      extractionConfidence:  extracted.confidence,
      status:                'PENDING',
    }});

    // Update invoice → PROMISED
    const updated = await prisma.invoice.update({
      where: { id: inv.id }, data: { status: 'PROMISED' }, include: { debtor: true },
    });

    await prisma.event.create({ data: {
      invoiceId: inv.id, eventType: 'PROMISE_CAPTURED',
      payload: JSON.stringify({ promiseId: promise.id, promisedDate: extracted.promised_date, confidence: extracted.confidence, reasoning: extracted.reasoning, rawReply: reply_text }),
    }});
    await prisma.event.create({ data: {
      invoiceId: inv.id, eventType: 'STATE_CHANGE',
      payload: JSON.stringify({ from: inv.status, to: 'PROMISED', reason: 'promise_captured' }),
    }});

    res.json({
      extracted,
      promise,
      message: `Promise captured — escalation paused until ${extracted.promised_date}`,
      invoice: ser(updated),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
