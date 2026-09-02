import { useNavigate }  from 'react-router-dom'
import { ArrowUpDown }  from 'lucide-react'
import { useState }     from 'react'
import StatusBadge      from './StatusBadge'

const STATUS_FILTERS = ['', 'DUE', 'GENTLE', 'FIRM', 'PROMISED', 'ESCALATION', 'LEGAL_FLAG', 'PAID']
const FILTER_LABELS  = { '': 'All', DUE: 'Due', GENTLE: 'Gentle', FIRM: 'Firm',
  PROMISED: 'Promised', ESCALATION: 'Escalation', LEGAL_FLAG: 'Legal Flag', PAID: 'Paid' }

function fmt(paise)  { return `₹${(Number(paise) / 100).toLocaleString('en-IN')}` }
function fmtDate(d)  { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) }

function SkelRow() {
  return (
    <tr>
      {[...Array(6)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="skeleton h-3 rounded" style={{ width: `${40 + i * 10}%` }} />
        </td>
      ))}
    </tr>
  )
}

export default function InvoiceTable({ invoices, loading, statusFilter, onFilterChange }) {
  const navigate = useNavigate()
  const [sort, setSort] = useState({ key: 'updatedAt', dir: 'desc' })

  const toggle = (key) => setSort(s => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }))

  const sorted = [...invoices].sort((a, b) => {
    let av = a[sort.key], bv = b[sort.key]
    if (sort.key === 'amountPaise') { av = Number(av); bv = Number(bv) }
    if (sort.key === 'dueDate' || sort.key === 'updatedAt') { av = new Date(av); bv = new Date(bv) }
    if (av < bv) return sort.dir === 'asc' ? -1 : 1
    if (av > bv) return sort.dir === 'asc' ? 1  : -1
    return 0
  })

  function Th({ label, skey }) {
    return (
      <th>
        <button onClick={() => toggle(skey)}
          className="flex items-center gap-1 hover:text-pb-text transition-colors">
          {label}
          <ArrowUpDown size={11} className={sort.key === skey ? 'text-pb-primary-l' : ''} />
        </button>
      </th>
    )
  }

  return (
    <div className="glass-card overflow-hidden">
      {/* Filter tabs */}
      <div className="flex items-center gap-1 p-3 border-b border-pb-border overflow-x-auto">
        {STATUS_FILTERS.map(f => (
          <button key={f} onClick={() => onFilterChange(f)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
              statusFilter === f
                ? 'bg-pb-primary/25 text-pb-primary-l border border-pb-primary/30'
                : 'text-pb-muted hover:text-pb-subtext hover:bg-white/5'
            }`}>
            {FILTER_LABELS[f]}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <Th label="Debtor"     skey="debtorId" />
              <Th label="Amount"     skey="amountPaise" />
              <Th label="Due"        skey="dueDate" />
              <th>Overdue</th>
              <th>Status</th>
              <Th label="Updated"    skey="updatedAt" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(8)].map((_, i) => <SkelRow key={i} />)
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-10 text-pb-muted text-sm">
                  No invoices for this filter.
                </td>
              </tr>
            ) : sorted.map(inv => {
              const overdue = inv.daysOverdue ?? 0
              return (
                <tr key={inv.id} className="cursor-pointer" onClick={() => navigate(`/invoices/${inv.id}`)}>
                  <td>
                    <div>
                      <p className="text-pb-text font-medium text-sm truncate max-w-[160px]">
                        {inv.debtor?.name ?? '—'}
                      </p>
                      <p className="text-pb-muted text-xs font-mono">{inv.id.slice(0, 8)}…</p>
                    </div>
                  </td>
                  <td className="font-semibold text-pb-text">{fmt(inv.amountPaise)}</td>
                  <td className="text-pb-subtext">{fmtDate(inv.dueDate)}</td>
                  <td>
                    {overdue > 0 ? (
                      <span className={`text-sm font-medium ${
                        overdue > 14 ? 'text-rose-400' :
                        overdue > 7  ? 'text-orange-400' :
                                       'text-pb-warning'
                      }`}>{overdue}d</span>
                    ) : <span className="text-pb-muted text-sm">—</span>}
                  </td>
                  <td><StatusBadge status={inv.status} /></td>
                  <td className="text-pb-muted text-xs">
                    {new Date(inv.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {!loading && (
        <p className="text-pb-muted text-xs px-4 py-2 border-t border-pb-border/50">
          {sorted.length} invoice{sorted.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}
