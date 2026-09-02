import { useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'

function fmt(paise) { return `₹${(Number(paise) / 100).toLocaleString('en-IN')}` }

export default function ExceptionsPanel({ invoices, loading }) {
  const navigate = useNavigate()

  return (
    <div className="glass-card overflow-hidden border border-rose-500/10">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-rose-500/15 bg-rose-500/5">
        <AlertTriangle size={14} className="text-rose-400 flex-shrink-0" />
        <h2 className="text-sm font-semibold text-rose-300">Could Not Recover</h2>
        {!loading && (
          <span className="ml-auto text-rose-400 text-xs font-bold">{invoices.length}</span>
        )}
      </div>

      {loading ? (
        <div className="p-4 space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton h-10 rounded-lg" />
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <p className="text-pb-subtext text-sm">No LEGAL_FLAG invoices 🎉</p>
          <p className="text-pb-muted text-xs mt-1">All recoveries still in progress</p>
        </div>
      ) : (
        <div className="divide-y divide-rose-500/10 max-h-52 overflow-y-auto">
          {invoices.map(inv => (
            <div key={inv.id} onClick={() => navigate(`/invoices/${inv.id}`)}
              className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-rose-500/5 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-rose-300 text-xs font-medium truncate">
                  {inv.debtor?.name ?? inv.debtorId}
                </p>
                <p className="text-rose-400/60 text-[10px]">{inv.daysOverdue ?? 0}d overdue</p>
              </div>
              <p className="text-rose-400 text-sm font-bold flex-shrink-0">{fmt(inv.amountPaise)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
