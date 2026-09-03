# PayBack

**B2B Receivables Chaser with Promise-to-Pay Tracking**

![Track](https://img.shields.io/badge/Track_03-AI_Revenue_Recovery-7c3aed?style=flat-square)
![Stack](https://img.shields.io/badge/Stack-Node_·_Express_·_React_·_Prisma-0ea5e9?style=flat-square)
![AI](https://img.shields.io/badge/AI-Gemini_3.1_Flash_Lite-4ade80?style=flat-square&logo=google)
![Payments](https://img.shields.io/badge/Payments-Razorpay_Payment_Links-2563eb?style=flat-square)
![Hackathon](https://img.shields.io/badge/Razorpay_Hackathon-2026-e11d48?style=flat-square)

---

## The Problem

Indian SMEs chase overdue invoices manually — WhatsApp messages typed one by one, no tracking, no escalation logic, no record of what a debtor promised. When a debtor says *"kal tak kar deta hoon"*, that commitment disappears into a chat thread. When they don't pay, the chase starts from scratch.

PayBack automates the entire collection cycle — from the first gentle nudge to legal referral — while tracking every promise a debtor makes and using it against them (politely) if they break it.

---

## What It Does

### Escalation State Machine

Every invoice moves through a deterministic pipeline:

```
DUE → GENTLE → FIRM → ESCALATION → LEGAL_FLAG (terminal, human handoff)
                                 ↑
                         PAID (terminal, from any state via webhook)
```

Each transition is triggered by elapsed days. The escalation engine runs on a tick-based demo clock (one click = one day passes) so judges can watch the full lifecycle in minutes.

### Promise-to-Pay Tracking

When a debtor replies — in English, Hindi, or Hinglish — their message goes to Gemini:

```
Input:  "bhai thoda time chahiye, 15 tak pakka kar deta hoon"
Output: { has_promise: true, promised_date: "2026-09-15", confidence: 0.91 }
```

If a promise exists:
- The escalation clock **pauses** until the promised date
- If the date passes without payment → the invoice **skips a tier** and the next reminder explicitly references the broken commitment
- If payment arrives before the date → promise is marked `KEPT`, debtor reliability score increases

### Stopping Rule

`payment.captured` webhook from Razorpay immediately marks the invoice `PAID` and halts all future reminders — permanently, from any state. No polling, no cron check, no race condition.

### Hinglish Safety Net

Gemini occasionally ignores language instructions and returns pure English for `hi-en` debtors. The fix is not more prompt engineering — it's a verification layer:

```
Gemini response → looksLikeHinglish()? (checks ≥2 Hindi word markers, whole-word regex)
  YES → ship it
  NO  → retry once with explicit correction prompt
         └── still English? → deterministic Hinglish template (always correct)
```

Wrong-language output never reaches a debtor.

---

## Demo Numbers

Shreeji Textiles, Surat — a garment wholesaler with 55 outstanding invoices across 18 debtors.

| Metric | Value |
|---|---|
| Total invoiced | ₹15.6L |
| Recovered | ₹9.5L |
| Recovery rate | 60.78% |
| Paid at GENTLE tier | 22 invoices |
| Paid after FIRM reminder | 14 invoices |
| Broken-promise skip-tier escalations | 6 invoices |
| LEGAL_FLAG (could not recover) | 5 invoices |

The 5 LEGAL_FLAG exceptions are shown plainly in a "Could Not Recover" panel on the dashboard — not hidden in a filter.

---

## AI Judgment

This is the part that usually goes unsaid. Here's exactly where Gemini is used, and where it deliberately isn't:

| What | Approach | Why |
|---|---|---|
| Reminder generation | **Gemini** | Tone + language + broken-promise context = too many variables for a template |
| Promise extraction | **Gemini** | Resolves relative dates from natural Hinglish — *"kal"*, *"next Friday"*, *"end of month"* |
| Hinglish detection | **Rule-based word list** | Binary check — faster, cheaper, and more reliable than an LLM call |
| Escalation thresholds | **Deterministic day-count** | Compliance decision — AI shouldn't decide when to escalate |
| Stopping rule | **Razorpay webhook** | Must be instant and guaranteed — no AI in the loop |

Gemini handles exactly two things: writing and understanding language. Everything else is deterministic.

---

## What Broke (Read This)

### 1 — Gemini API key format migration (AIza → AQ.)

Google migrated AI Studio to issue `AQ.` format auth keys in mid-2026. The `@google/generative-ai` SDK was hardcoded to reject anything that didn't start with `AIza`. The backend started and logged `Gemini: ✅ configured` (a non-empty key check) while silently falling back to regex extraction on every call.

**Root cause hunt:** We spent 45 minutes checking the wrong things — network calls, model names, quota limits — before running a prefix log that showed the key being sent was `AQ.Ab8RN6J...` and the SDK was the one rejecting it.

**Fix:** Migrated to `@google/genai` (the new unified SDK). Also discovered that `dotenv` doesn't overwrite existing Windows environment variables by default — a stale `GEMINI_API_KEY=AIzaSy...` set months earlier in the system environment was silently winning over `.env`. Fixed with `dotenv.config({ override: true })`.

### 2 — Webhook "stream is not readable" on first real payment

`express.json()` was registered globally. When Razorpay's webhook fired, the JSON middleware consumed the raw request body before the webhook route could read it for HMAC signature verification. The handler crashed, the payment went unprocessed.

**Fix:** Mounted the webhook route *before* `express.json()`, using `express.raw({ type: 'application/json' })` specifically for `/api/webhooks`. The raw Buffer is now converted to a string for signature verification, then JSON-parsed for logic — in that order.

### 3 — Race condition on double-click Reset Demo

Two concurrent resets produced orphaned invoice rows — invoices pointing to debtors that had already been deleted by the first reset. The invoice list query crashed with a Prisma relation error.

**Root cause:** SQLite doesn't enforce foreign keys by default. `PRAGMA foreign_keys = ON` must be explicitly set per connection — it's not a schema-level setting. Without it, deleting debtors while their invoices still exist succeeds silently.

**Fix:** Enabled `PRAGMA foreign_keys = ON` in `db.js` on connect (the actual root fix). Also added an in-memory concurrency lock on the reset endpoint — a second request while a reset is in progress returns 429 immediately.

---

## Stack

**Backend:** Node.js · Express · Prisma ORM · SQLite · `@google/genai` · Razorpay Node SDK

**Frontend:** React 18 · Vite · Tailwind CSS

**AI:** Gemini 3.1 Flash Lite (via `@google/genai`, AQ. key format)

**Payments:** Razorpay Payment Links API · `payment.captured` webhook with HMAC verification

---

## Run It

```bash
# 1. Clone
git clone https://github.com/omjee45/PayBack.git && cd PayBack

# 2. Backend
cd backend
cp .env.example .env          # fill in GEMINI_API_KEY, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET
npm install
npm run db:push               # create SQLite schema
npm run seed                  # 55 invoices, 18 debtors, 14 promises
npm run dev                   # starts on :3001

# 3. Frontend (new terminal)
cd frontend
npm install
npm run dev                   # starts on :3000
```

Open `http://localhost:3000`. Click **Tick Day** to advance the demo clock. Click **Simulate Reply** on any invoice to test Gemini promise extraction.

**Razorpay webhooks (local testing):**
```bash
# Use cloudflared or ngrok to expose :3001, then set the tunnel URL as webhook endpoint in Razorpay Dashboard
cloudflared tunnel --url http://localhost:3001
```

---

## Repo

[github.com/omjee45/PayBack](https://github.com/omjee45/PayBack)

---

## Built by

**[Your Name] · [College] · [Year]**

Razorpay Hackathon 2026 — Track 03: AI Revenue Recovery
