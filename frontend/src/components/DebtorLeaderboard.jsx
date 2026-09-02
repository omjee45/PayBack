import { Link } from 'react-router-dom'

function ScorePill({ score }) {
  const colour = score >= 80 ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
               : score >= 60 ? 'text-amber-400  bg-amber-400/10  border-amber-400/20'
                             : 'text-rose-400   bg-rose-400/10   border-rose-400/20'
  return (
    <span className={`badge ${colour} font-mono font-bold text-xs`}>{score}</span>
  )
}

function fmt(paise) {
  const r = paise / 100
  if (r >= 100_000) return `₹${(r / 100_000).toFixed(1)}L`
  if (r >= 1_000)   return `₹${(r / 1_000).toFixed(0)}K`
  return `₹${r}`
}

export default function DebtorLeaderboard({ debtors, loading }) {
  return (
    <div className="glass-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-pb-border">
        <h2 className="text-sm font-semibold text-pb-text">Debtor Reliability</h2>
        <span className="text-pb-muted text-xs">{debtors.length} debtors</span>
      </div>

      {loading ? (
        <div className="p-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="skeleton h-3 w-3 rounded-full" />
              <div className="skeleton h-3 flex-1 rounded" />
              <div className="skeleton h-4 w-8 rounded-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="divide-y divide-pb-border/50 max-h-[340px] overflow-y-auto">
          {debtors.slice(0, 12).map((d, i) => {
            const outstanding = d.invoices
              .filter(v => v.status !== 'PAID')
              .reduce((s, v) => s + Number(v.amountPaise), 0)

            return (
              <Link key={d.id} to={`/debtors/${d.id}`}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.03] transition-colors">
                <span className="text-pb-muted text-xs w-4">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-pb-text text-xs font-medium truncate">{d.name}</p>
                  {outstanding > 0 && (
                    <p className="text-pb-muted text-[10px]">{fmt(outstanding)} outstanding</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {(d.promiseStats?.broken ?? 0) > 0 && (
                    <span className="text-[10px] text-rose-400">{d.promiseStats.broken}✗</span>
                  )}
                  <ScorePill score={Math.round(d.reliabilityScore)} />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
