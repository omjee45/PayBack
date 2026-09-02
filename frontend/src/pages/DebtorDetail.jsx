import { useState, useEffect } from 'react'
import { useParams, Link }      from 'react-router-dom'
import { ArrowLeft }            from 'lucide-react'
import { api }                  from '../lib/api'
import StatusBadge              from '../components/StatusBadge'

function fmt(paise) { return `₹${(Number(paise) / 100).toLocaleString('en-IN')}` }
function fmtDate(d) { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) }

function ScoreRing({ score }) {
  const colour = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444'
  const r = 28, circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  return (
    <div className="relative w-20 h-20 flex items-center justify-center">
      <svg width="80" height="80" className="-rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
        <circle cx="40" cy="40" r={r} fill="none" stroke={colour} strokeWidth="6"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.6s ease' }} />
      </svg>
      <span className="absolute text-lg font-bold" style={{ color: colour }}>{score}</span>
    </div>
  )
}

export default function DebtorDetail() {
  const { id }                = useParams()
  const [debtor, setDebtor]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.getDebtor(id)
      .then(setDebtor)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="p-6 space-y-4 animate-fade-in">
      <div className="skeleton h-8 w-48" />
      <div className="skeleton h-40 rounded-xl" />
      <div className="skeleton h-64 rounded-xl" />
    </div>
  )

  if (!debtor) return <div className="p-6 text-pb-subtext">Debtor not found.</div>

  const { promiseStats } = debtor
  const allPromises = debtor.invoices.flatMap(i => i.promises ?? [])

  return (
    <div className="p-6 animate-fade-in max-w-4xl">
      <Link to="/" className="inline-flex items-center gap-1.5 text-pb-subtext hover:text-pb-text text-sm mb-5 transition-colors">
        <ArrowLeft size={15} /> Back to Dashboard
      </Link>

      {/* ── Header card ───────────────────────────────────────────────── */}
      <div className="glass-card p-6 mb-5 flex items-start gap-6 flex-wrap">
        <ScoreRing score={Math.round(debtor.reliabilityScore)} />
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-pb-text">{debtor.name}</h1>
          <p className="text-pb-subtext text-sm">{debtor.contactEmail} · {debtor.contactPhone}</p>
          <p className="text-pb-subtext text-xs mt-0.5">Language: {debtor.preferredLanguage === 'hi-en' ? 'Hinglish' : 'English'}</p>
          <div className="flex items-center gap-4 mt-3">
            <span className="text-xs text-emerald-400 font-medium">{promiseStats.kept} promise{promiseStats.kept !== 1 ? 's' : ''} kept</span>
            <span className="text-xs text-rose-400   font-medium">{promiseStats.broken} broken</span>
            {promiseStats.pending > 0 && (
              <span className="text-xs text-violet-400 font-medium">{promiseStats.pending} pending</span>
            )}
          </div>
        </div>
        <div className="text-right text-xs text-pb-muted">
          <p>Member since {fmtDate(debtor.createdAt)}</p>
          <p className="mt-1">{debtor.invoices.length} invoice{debtor.invoices.length !== 1 ? 's' : ''} total</p>
        </div>
      </div>

      {/* ── Promise history ────────────────────────────────────────────── */}
      {allPromises.length > 0 && (
        <div className="glass-card p-5 mb-5">
          <h2 className="text-sm font-semibold text-pb-text mb-3">Promise History</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Reply</th><th>Promised Date</th><th>Confidence</th><th>Outcome</th>
              </tr>
            </thead>
            <tbody>
              {allPromises.map(p => (
                <tr key={p.id}>
                  <td className="text-pb-subtext text-xs italic max-w-[200px] truncate">"{p.rawReplyText}"</td>
                  <td className="text-pb-text">{fmtDate(p.promisedDate)}</td>
                  <td className="text-pb-subtext">{Math.round((p.extractionConfidence ?? 0) * 100)}%</td>
                  <td>
                    <span className={`badge text-[10px] border ${
                      p.status === 'KEPT'   ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' :
                      p.status === 'BROKEN' ? 'text-rose-400    bg-rose-400/10    border-rose-400/20'    :
                                              'text-violet-400  bg-violet-400/10  border-violet-400/20'
                    }`}>{p.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Invoice list ───────────────────────────────────────────────── */}
      <div className="glass-card p-5">
        <h2 className="text-sm font-semibold text-pb-text mb-3">Invoice History</h2>
        <table className="data-table">
          <thead>
            <tr><th>Invoice</th><th>Amount</th><th>Due Date</th><th>Status</th></tr>
          </thead>
          <tbody>
            {debtor.invoices.map(inv => (
              <tr key={inv.id} className="cursor-pointer" onClick={() => window.location.href = `/invoices/${inv.id}`}>
                <td className="font-mono text-pb-muted text-xs">{inv.id.slice(0, 8)}…</td>
                <td className="text-pb-text font-medium">{fmt(inv.amountPaise)}</td>
                <td className="text-pb-subtext">{fmtDate(inv.dueDate)}</td>
                <td><StatusBadge status={inv.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
