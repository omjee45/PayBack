import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api'
import RecoveryLedger      from '../components/RecoveryLedger'
import InvoiceTable        from '../components/InvoiceTable'
import ExceptionsPanel     from '../components/ExceptionsPanel'
import DebtorLeaderboard   from '../components/DebtorLeaderboard'
import TickButton          from '../components/TickButton'
import CreateInvoiceModal  from '../components/CreateInvoiceModal'
import StatusBadge         from '../components/StatusBadge'

export default function Dashboard() {
  const [summary,      setSummary]      = useState(null)
  const [invoices,     setInvoices]     = useState([])
  const [debtors,      setDebtors]      = useState([])
  const [loading,      setLoading]      = useState(true)
  const [dayOffset,    setDayOffset]    = useState(0)
  const [statusFilter, setStatusFilter] = useState('')
  const [lastTick,     setLastTick]     = useState(null)
  const [tickLoading,  setTickLoading]  = useState(false)
  const [showCreate,   setShowCreate]   = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [s, i, d, cs] = await Promise.all([
        api.getSummary(),
        api.getInvoices(statusFilter),
        api.getDebtors(),
        api.getCronStatus(),
      ])
      setSummary(s)
      setInvoices(i)
      setDebtors(d)
      setDayOffset(cs.dayOffset)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [statusFilter])

  useEffect(() => { loadData() }, [loadData])

  const handleTick = async () => {
    setTickLoading(true)
    try {
      const result = await api.tick()
      setDayOffset(result.dayOffset)
      setLastTick(result)
      await loadData()
    } catch (err) { console.error(err) }
    finally { setTickLoading(false) }
  }

  const handleReset = async () => {
    if (!confirm('Reset demo day offset to 0?')) return
    await api.resetDemo()
    setDayOffset(0)
    setLastTick(null)
    await loadData()
  }

  const exceptions = invoices.filter(i => i.status === 'LEGAL_FLAG')

  return (
    <div className="p-6 animate-fade-in min-h-screen">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-7 gap-4">
        <div>
          <h1 className="page-title">Recovery Dashboard</h1>
          <p className="page-sub">AI-powered invoice collections · real-time escalation engine</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <button onClick={handleReset} className="btn-ghost text-xs px-3 py-1.5">
            Reset Demo
          </button>
          <button onClick={() => setShowCreate(true)} className="btn-ghost">
            + New Invoice
          </button>
          <TickButton dayOffset={dayOffset} loading={tickLoading} onTick={handleTick} />
        </div>
      </div>

      {/* ── Recovery Ledger ─────────────────────────────────────────────── */}
      <RecoveryLedger summary={summary} loading={loading} />

      {/* ── Main grid ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mt-5">
        {/* Invoice table — 2/3 */}
        <div className="xl:col-span-2">
          <InvoiceTable
            invoices={invoices}
            loading={loading}
            statusFilter={statusFilter}
            onFilterChange={f => setStatusFilter(f === statusFilter ? '' : f)}
          />
        </div>

        {/* Right panel */}
        <div className="flex flex-col gap-5">
          <ExceptionsPanel invoices={exceptions} loading={loading} />
          <DebtorLeaderboard debtors={debtors} loading={loading} />
        </div>
      </div>

      {/* ── Last tick result ────────────────────────────────────────────── */}
      {lastTick && (
        <div className="mt-5 glass-card p-4 border border-pb-primary/20 animate-slide-up">
          <p className="text-xs font-semibold text-pb-primary-l mb-3 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-pb-primary animate-ping-slow" />
            ⚡ Day +{lastTick.dayOffset} tick — {lastTick.processed} invoices processed,&nbsp;
            {lastTick.remindersSent} reminder{lastTick.remindersSent !== 1 ? 's' : ''} sent
          </p>
          {lastTick.transitions.length === 0 ? (
            <p className="text-pb-muted text-xs">No state transitions — all invoices up to date.</p>
          ) : (
            <div className="space-y-1.5">
              {lastTick.transitions.map((t, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="text-pb-text font-medium w-40 truncate">{t.debtorName}</span>
                  <StatusBadge status={t.fromStatus} size="sm" />
                  <span className="text-pb-muted">→</span>
                  <StatusBadge status={t.toStatus}   size="sm" />
                  <span className="text-pb-muted truncate">{t.reason}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showCreate && (
        <CreateInvoiceModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); loadData() }}
        />
      )}
    </div>
  )
}
