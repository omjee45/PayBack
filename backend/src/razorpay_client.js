'use strict';

require('dotenv').config();
const Razorpay = require('razorpay');
const crypto   = require('crypto');

// ─── JSDoc types ──────────────────────────────────────────────────────────

/**
 * @typedef {Object} PaymentLinkResult
 * @property {string} id
 * @property {string} short_url
 */

/**
 * @typedef {Object} CreateLinkParams
 * @property {number}  amountPaise
 * @property {string}  invoiceId
 * @property {string}  debtorName
 * @property {string}  [debtorEmail]
 * @property {string}  [debtorPhone]
 * @property {string}  description
 */

// ─── Client ───────────────────────────────────────────────────────────────

const isMock = !process.env.RAZORPAY_KEY_ID ||
               process.env.RAZORPAY_KEY_ID === 'rzp_test_YOUR_KEY_HERE';

let rzpClient = null;
function getClient() {
  if (!rzpClient) {
    rzpClient = new Razorpay({
      key_id:     process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return rzpClient;
}

// ─── Create Payment Link ──────────────────────────────────────────────────

/**
 * Creates a Razorpay Payment Link. Returns a mock link if keys are not configured.
 * @param {CreateLinkParams} params
 * @returns {Promise<PaymentLinkResult>}
 */
async function createPaymentLink(params) {
  if (isMock) {
    console.log('[Razorpay] MOCK MODE — returning fake payment link');
    const shortId = params.invoiceId.slice(0, 8);
    return { id: `mock_pl_${shortId}`, short_url: `https://rzp.io/mock/${shortId}` };
  }

  const rzp = getClient();
  const link = await rzp.paymentLink.create({
    amount:         params.amountPaise,
    currency:       'INR',
    accept_partial: false,
    description:    params.description,
    customer: {
      name:    params.debtorName,
      email:   params.debtorEmail  ?? '',
      contact: params.debtorPhone  ?? '',
    },
    notify:          { sms: !!params.debtorPhone, email: !!params.debtorEmail },
    reminder_enable: false, // PayBack does its own reminders
    notes:           { invoice_id: params.invoiceId, source: 'payback' },
    callback_url:    `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/payment-success`,
    callback_method: 'get',
  });

  return { id: link.id, short_url: link.short_url };
}

// ─── Webhook signature verification ──────────────────────

/**
 * Verifies a Razorpay webhook signature.
 * Returns true if valid OR if no secret is configured (dev mode).
 * @param {string} rawBody   - raw request body string
 * @param {string} signature - X-Razorpay-Signature header value
 * @param {string} secret    - webhook secret
 * @returns {boolean}
 */
function verifyWebhookSignature(rawBody, signature, secret) {
  if (!secret) {
    console.warn('[Razorpay] No webhook secret configured — skipping signature verification');
    return true;
  }
  try {
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature ?? '', 'hex'));
  } catch {
    return false;
  }
}

module.exports = { createPaymentLink, verifyWebhookSignature };
