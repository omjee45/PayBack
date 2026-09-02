// Central API client — uses Vite proxy in dev (no CORS config needed)
// In prod, set VITE_API_URL to the backend base URL

const BASE = import.meta.env.VITE_API_URL || ''

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  // Dashboard
  getSummary:   ()           => req('/api/dashboard/summary'),

  // Invoices
  getInvoices:  (status)     => req(`/api/invoices${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  getInvoice:   (id)         => req(`/api/invoices/${id}`),
  createInvoice:(data)       => req('/api/invoices',            { method: 'POST', body: JSON.stringify(data) }),
  simulateReply:(id, text)   => req(`/api/invoices/${id}/simulate-reply`, { method: 'POST', body: JSON.stringify({ reply_text: text }) }),

  // Debtors
  getDebtors:   ()           => req('/api/debtors'),
  getDebtor:    (id)         => req(`/api/debtors/${id}`),

  // Cron / demo
  tick:         ()           => req('/api/cron/tick',   { method: 'POST' }),
  getCronStatus:()           => req('/api/cron/status'),
  resetDemo:    ()           => req('/api/cron/reset',  { method: 'POST' }),
}
