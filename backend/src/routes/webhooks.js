'use strict';

const express                    = require('express');
const { prisma }                 = require('../db');
const { verifyWebhookSignature } = require('../razorpay_client');

const router = express.Router();

/**
 * POST /api/webhooks/razorpay
 * Receives Razorpay events. Handles payment.captured to immediately mark invoice PAID.
 * This is the critical stopping rule: fires regardless of current invoice state.
 */
router.post('/razorpay', async (req, res) => {
  const rawBody  = req.rawBody ?? JSON.stringify(req.body ?? {});
  const signature= req.headers['x-razorpay-signature'] ?? '';
  const secret   = process.env.RAZORPAY_WEBHOOK_SECRET ?? '';

  // Signature verification
  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    console.warn('[Webhook] Invalid signature — rejected');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  let event;
  try { event = JSON.parse(rawBody); }
  catch { return res.status(400).json({ error: 'Invalid JSON' }); }

  // Only care about payment.captured
  if (event.event !== 'payment.captured') {
    return res.json({ status: 'ignored', event: event.event });
  }

  const payment      = event.payload?.payment?.entity ?? {};
  const paymentLinkId= payment.payment_link_id ?? event.payload?.payment_link?.entity?.id;
  const invoiceId    = payment.notes?.invoice_id;

  // Find matching invoice
  let invoice = null;
  if (invoiceId) {
    invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  }
  if (!invoice && paymentLinkId) {
    invoice = await prisma.invoice.findFirst({ where: { razorpayPaymentLinkId: paymentLinkId } });
  }

  if (!invoice) {
    console.warn('[Webhook] No matching invoice found for payment', payment.id);
    return res.status(404).json({ error: 'No matching invoice' });
  }

  if (invoice.status === 'PAID') {
    return res.json({ status: 'already_paid', invoiceId: invoice.id });
  }

  const prevStatus = invoice.status;
  const paidAt     = new Date();

  // ── Mark PAID (terminal) ────────────────────────────────────────────────
  await prisma.invoice.update({
    where: { id: invoice.id },
    data:  { status: 'PAID', razorpayPaymentId: payment.id, paidAt },
  });

  // ── If there was a PENDING promise, mark it KEPT ────────────────────────
  const pending = await prisma.promise.findFirst({
    where:   { invoiceId: invoice.id, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
  });
  if (pending) {
    await prisma.promise.update({
      where: { id: pending.id },
      data:  { status: 'KEPT', resolvedAt: paidAt },
    });
    // Boost debtor reliability score (+5, capped at 100)
    const debtor = await prisma.debtor.findUnique({ where: { id: invoice.debtorId } });
    await prisma.debtor.update({
      where: { id: invoice.debtorId },
      data:  { reliabilityScore: Math.min(100, debtor.reliabilityScore + 5) },
    });
    await prisma.event.create({ data: {
      invoiceId: invoice.id, eventType: 'PROMISE_KEPT',
      payload: JSON.stringify({ promiseId: pending.id, promisedDate: pending.promisedDate }),
    }});
  }

  // ── Audit trail ─────────────────────────────────────────────────────────
  await prisma.event.create({ data: {
    invoiceId: invoice.id, eventType: 'WEBHOOK_RECEIVED',
    payload: JSON.stringify({ event: 'payment.captured', paymentId: payment.id, amountPaise: payment.amount }),
  }});
  await prisma.event.create({ data: {
    invoiceId: invoice.id, eventType: 'STATE_CHANGE',
    payload: JSON.stringify({ from: prevStatus, to: 'PAID', reason: 'payment_captured', paymentId: payment.id }),
  }});

  console.log(`[Webhook] Invoice ${invoice.id} marked PAID via payment ${payment.id}`);
  res.json({ status: 'ok', invoiceId: invoice.id, paidAt, previousStatus: prevStatus });
});

module.exports = router;
