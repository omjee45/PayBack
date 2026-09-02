import { useState, useEffect } from 'react'
import { useParams, Link }      from 'react-router-dom'
import { ArrowLeft, ExternalLink, MessageSquare } from 'lucide-react'
import { api }             from '../lib/api'
import StatusBadge         from '../components/StatusBadge'
import Timeline            from '../components/Timeline'
import SimulateReplyModal  from '../components/SimulateReplyModal'

function fmt(paise) {
  return `₹${(Number(paise) / 100).toLocaleString('en-IN')}`
}
function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function InvoiceDetail() {
  const { id }             = useParams()
  const [invoice, setInv]  = useState(null)
  const [loading, setLoad] = useState(true)
  const [showReply, setReply] = useState(false)

  const load = async () => {
    setLoad(true)
    try { setInv(await api.getInvoice(id)) }
    catch (e) { console.error(e) }
    finally { setLoad(false) }
  }

  useEffect(() => { load() }, [id])

  if (loading) return (
    <div className="p-6 space-y-4 animate-fade-in">
      <div className="skeleton h-8 w-48" />
      <div className="skeleton h-32 rounded-xl" />
      <div className="skeleton h-64 rounded-xl" />
    </div>
  )

  if (!invoice) return (
    <div className="p-6 text-pb-subtext">Invoice not found.</div>
  )

  const canSimulate = !['PAID','LEGAL_FLAG'].includes(invoice.status)

  return (
    <div className="p-6 animate-fade-in max-w-4xl">
      {/* Back */}
      <Link to="/" className="inline-flex items-center gap-1.5 text-pb-subtext hover:text-pb-text text-sm mb-5 transition-colors">
        <ArrowLeft size={15} /> Back to Dashboard
      </Link>

      {/* ── Invoice header ──────────────────────────────────────────────── */}
      <div className="glass-card p-6 mb-5 glow-purple">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <StatusBadge status={invoice.status} />
              {invoice.status === 'LEGAL_FLAG' && (
                <span className="text-xs text-rose-400 font-medium">⚠ Human takeover required</span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-pb-text mt-2">{fmt(invoice.amountPaise)}</h1>
            <Link to={`/debtors/${invoice.debtorId}`}
              className="text-pb-primary-l hover:underline text-sm font-medium">
              {invoice.debtor.name}
            </Link>
            <p className="text-pb-subtext text-sm mt-1">
              Due: {fmtDate(invoice.dueDate)}
              {invoice.daysOverdue > 0 && (
                <span className="ml-2 text-pb-warning font-medium">{invoice.daysOverdue} days overdue</span>
              )}
            </p>
            {invoice.paidAt && (
              <p className="text-pb-success text-sm mt-1">✓ Paid on {fmtDate(invoice.paidAt)}</p>
            )}
          </div>

          <div className="flex flex-col items-end gap-2">
            {invoice.razorpayPaymentLinkUrl && (
              <a href={invoice.razorpayPaymentLinkUrl} target="_blank" rel="noopener noreferrer"
                className="btn-ghost text-xs gap-1.5">
                Payment Link <ExternalLink size={12} />
              </a>
            )}
            {canSimulate && (
              <button onClick={() => setReply(true)} className="btn-primary text-xs gap-1.5">
                <MessageSquare size={13} /> Simulate Reply
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Two-column layout ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Event timeline */}
        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold text-pb-text mb-4">Audit Trail</h2>
          <Timeline events={invoice.events} />
        </div>

        {/* Reminders + Promises */}
        <div className="space-y-5">

          {/* Promises */}
          {invoice.promises.length > 0 && (
            <div className="glass-card p-5">
              <h2 className="text-sm font-semibold text-pb-text mb-3">Promises</h2>
              <div className="space-y-3">
                {invoice.promises.map(p => (
                  <div key={p.id} className="p-3 rounded-lg bg-white/[0.03] border border-pb-border text-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`badge text-[10px] border ${
                        p.status === 'KEPT'    ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' :
                        p.status === 'BROKEN'  ? 'text-rose-400    bg-rose-400/10    border-rose-400/20'    :
                                                  'text-violet-400  bg-violet-400/10  border-violet-400/20'
                      }`}>{p.status}</span>
                      <span className="text-pb-muted text-xs">{Math.round((p.extractionConfidence ?? 0) * 100)}% confidence</span>
                    </div>
                    <p className="text-pb-text font-medium">By {fmtDate(p.promisedDate)}</p>
                    <p className="text-pb-subtext text-xs mt-1 italic">"{p.rawReplyText}"</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reminders sent */}
          {invoice.reminders.length > 0 && (
            <div className="glass-card p-5">
              <h2 className="text-sm font-semibold text-pb-text mb-3">Reminders Sent</h2>
              <div className="space-y-3">
                {invoice.reminders.map(r => (
                  <div key={r.id} className="p-3 rounded-lg bg-white/[0.03] border border-pb-border text-sm">
                    <div className="flex items-center justify-between mb-1.5">
                      <StatusBadge status={r.tier} size="sm" />
                      <span className="text-pb-muted text-xs">{new Date(r.sentAt).toLocaleString('en-IN')}</span>
                    </div>
                    <p className="text-pb-subtext text-xs leading-relaxed">{r.messageText}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showReply && (
        <SimulateReplyModal
          invoiceId={invoice.id}
          onClose={() => setReply(false)}
          onSuccess={() => { setReply(false); load() }}
        />
      )}
    </div>
  )
}
