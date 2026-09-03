<div align="center">

# PayBack
### AI Collections Agent · Razorpay Hackathon 2026 · Track 03: AI Revenue Recovery

**PayBack doesn't send reminders. It holds debtors accountable to their own promises.**

[![Track](https://img.shields.io/badge/Track-03%20AI%20Revenue%20Recovery-7c3aed?style=flat-square)](https://razorpay.com)
[![Stack](https://img.shields.io/badge/Stack-Node%20·%20Express%20·%20React%20·%20Prisma-0f172a?style=flat-square)](https://github.com/omjee45/PayBack)
[![AI](https://img.shields.io/badge/AI-Gemini%203.1%20Flash%20Lite-4285f4?style=flat-square)](https://ai.google.dev)
[![Payments](https://img.shields.io/badge/Payments-Razorpay%20Test%20Mode-072654?style=flat-square)](https://razorpay.com)

</div>

---

## The problem

Indian SMEs invoice clients via Razorpay Payment Links and Smart Collect, then chase payment manually over WhatsApp for weeks.

The chase is unstructured. There's no escalation logic. And when a client says *"will pay by Friday"* — that promise lives in someone's head, not a system. When Friday passes and no payment arrives, nobody escalates any harder than the first time.

**PayBack closes that loop end-to-end.**

---

## What it does

```
Invoice created → overdue detected → right message sent → promise captured
→ promise broken → tier skipped → escalation → payment received → chase stops
```

Every step is automated. Every step is auditable. Every step stops the moment Razorpay confirms payment.

### The core mechanic: Promise-to-Pay Tracking

When a debtor replies *"bhai kal tak kar denge, thoda issue tha"* — PayBack extracts a structured commitment:

```json
{
  "has_promise": true,
  "promised_date": "2026-09-10",
  "confidence": 0.88,
  "reasoning": "Debtor used 'kal' which resolves to tomorrow's date"
}
```

Escalation clock **pauses** until that date. If they pay — the chase stops permanently, via webhook. If they don't — they skip a tier and the next message explicitly references the broken commitment. That's a real collections-industry technique, not a reminder bot with a fancier UI.

---

## Results across 55 invoices

| Metric | Value |
|---|---|
| Total recovered | ₹9.5L |
| Recovery rate | 60.78% |
| Invoices recovered at GENTLE tier | 22 |
| Invoices recovered after FIRM reminder | 14 |
| Promises kept | 8 |
| Promises broken → tier-skipped escalation | 6 |
| Could not recover (LEGAL_FLAG) | 5 |

The 5 failures are shown plainly on the dashboard. An agent that claims 100% recovery is lying.

---

## Escalation state machine

```
DUE ──(1-3 days overdue)──► GENTLE
    ──(4-7 days)──────────► FIRM
    ──(8-14 days)─────────► ESCALATION ──(15+ days)──► LEGAL_FLAG (terminal)

Promise captured at any tier → status: PROMISED (clock paused)
  ├── Promise kept (paid before date) → PAID + reliability score +5
  └── Promise broken (date passed) → skip one tier up + message references broken date

payment.captured webhook (any state) → PAID immediately, permanently, stops everything
```

---

## AI usage — right tool, right place

| What | Model | Why AI, not a rule |
|---|---|---|
| Reminder generation | Gemini 3.1 Flash Lite | Tone must match tier + language + broken-promise context — too many variables for a template |
| Promise extraction | Gemini 3.1 Flash Lite | Resolves relative dates ("kal", "next Friday", "end of month") from natural language, including Hinglish |
| Hinglish detection | Rule-based word list | AI isn't needed here — a 20-word Hindi marker list is faster, cheaper, and more reliable for a binary check |
| Escalation thresholds | Deterministic (day count) | AI shouldn't decide when to escalate — that's a compliance decision, not a judgment call |
| Stopping rule | Razorpay webhook | The moment money lands, the chase stops. No AI in the loop — this must be instant and guaranteed |

---

## Tech stack

```
backend/          Node.js · Express · Prisma ORM · SQLite
  escalation_engine.js   State machine — the core of the system
  reminder_generator.js  Gemini API · English + Hinglish · retry-on-language-slip
  promise_extractor.js   Gemini API · strict JSON output · relative date resolution
  razorpay_client.js     Payment Links API · webhook signature verification

frontend/         React · Vite · Tailwind CSS
  Recovery Dashboard     Live ledger · invoice table · tick mechanism
  Invoice Detail         Full audit trail per invoice (straight from events table)
  Debtor Reliability     Per-debtor reliability score · promise history
  Exceptions Panel       LEGAL_FLAG invoices — honest, not hidden
```

---

## What broke (read this — it's more useful than what worked)

**1. Gemini's API key format changed mid-build.**
Google migrated from `AIza...` Standard keys to `AQ...` Auth keys in June 2026. Our SDK was outdated and rejected the new format with `401 UNAUTHENTICATED`. The error message said "invalid key" even though the key was correct, which sent us hunting in the wrong direction. Fix: updated `@google/generative-ai` to latest, forced `dotenv.config({ override: true })` after discovering a stale Windows environment variable was winning over `.env` (dotenv's default doesn't overwrite existing env vars).

**2. Webhook handler crashed on first real payment.**
`express.json()` was consuming the request body globally before our webhook route could read the raw bytes needed for Razorpay's HMAC signature verification. Error: `"stream is not readable"`. Fix: mounted the webhook route before `express.json()` using `express.raw({ type: 'application/json' })` specifically for that path — a standard pattern we should have used from the start.

**3. Double-click on Reset Demo caused a race condition.**
Two concurrent resets ran simultaneously — the first deleted debtors while the second was still inserting invoices that referenced them, producing orphaned rows that crashed the invoice list query. Fix: in-memory concurrency lock on the reset endpoint (returns `429` on concurrent call) + enabled `PRAGMA foreign_keys = ON` on SQLite, which is **off by default** and was the real root cause that allowed orphaned rows to exist at all.

None of these were logic bugs. All three were environment and integration issues you only find by building against real APIs.

---

## Running locally

```bash
# Clone
git clone https://github.com/omjee45/PayBack
cd PayBack

# Backend
cd backend
cp .env.example .env
# Fill in RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET, GEMINI_API_KEY
npm install
npx prisma migrate dev
node prisma/seed.js
npm run dev          # runs on :3001

# Frontend (separate terminal)
cd ../frontend
npm install
npm run dev          # runs on :5173

# Webhook tunnel (separate terminal, for payment testing)
cloudflared tunnel --url http://localhost:3001
# Paste the generated URL into Razorpay Dashboard → Settings → Webhooks
```

**Test card for Razorpay test mode:**
`4012 8888 8888 1881` · Expiry: any future · CVV: any 3 digits · OTP: `123456`

---

## Demo flow (in order)

1. Open dashboard — see full recovery ledger across 55 invoices
2. Click **Tick Day** — watch 6 broken promises escalate simultaneously, tier skipped
3. Click into any invoice — read the Gemini-generated Hinglish reminder
4. Use **Simulate Reply** on a GENTLE invoice — type a casual Hinglish promise, watch Gemini extract a date
5. Create a new invoice → open its Payment Link → pay with test card → watch the webhook flip it to PAID instantly
6. Show the "Could Not Recover" panel — 5 honest exceptions, not hidden

---

## Built by

**[Your Name]** · [College] · [Year]
[github.com/omjee45](https://github.com/omjee45)

---

<div align="center">

*Razorpay Hackathon 2026 · Track 03: AI Revenue Recovery*

</div>