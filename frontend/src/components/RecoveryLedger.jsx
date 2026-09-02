import { TrendingUp, TrendingDown, AlertTriangle, BarChart3 } from 'lucide-react'

function fmt(paise) {
  const r = paise / 100
  if (r >= 10_000_000) return `₹${(r / 10_000_000).toFixed(1)}Cr`
  if (r >=    100_000) return `₹${(r /    100_000).toFixed(1)}L`
  if (r >=      1_000) return `₹${(r /      1_000).toFixed(1)}K`
  return `₹${r.toLocaleString('en-IN')}`
}

function Skeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="stat-card space-y-3">
          <div className="skeleton h-3 w-20 rounded" />
          <div className="skeleton h-8 w-28 rounded" />
          <div className="skeleton h-2 w-16 rounded" />
        </div>
      ))}
    </div>
  )
}

export default function RecoveryLedger({ summary, loading }) {
  if (loading) return <Skeleton />
  if (!summary)return null

  const sc = summary.statusCounts ?? {}
  const activeCount = Object.entries(sc)
    .filter(([s]) => !['PAID','LEGAL_FLAG'].includes(s))
    .reduce((a, [, n]) => a + n, 0)

  const cards = [
    {
      label:   'Total Outstanding',
      value:   fmt(summary.totalOutstandingPaise),
      sub:     `${activeCount} active invoice${activeCount !== 1 ? 's' : ''}`,
      icon:    TrendingDown,
      accent:  { text: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/20', glow: 'rgba(251,146,60,0.12)' },
    },
    {
      label:   'Total Recovered',
      value:   fmt(summary.totalRecoveredPaise),
      sub:     `${sc.PAID ?? 0} paid invoice${(sc.PAID ?? 0) !== 1 ? 's' : ''}`,
      icon:    TrendingUp,
      accent:  { text: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20', glow: 'rgba(16,185,129,0.12)' },
    },
    {
      label:   'Recovery Rate',
      value:   `${summary.recoveryRate}%`,
      sub:     `${summary.totalInvoices} total invoices`,
      icon:    BarChart3,
      accent:  { text: 'text-violet-400', bg: 'bg-violet-400/10', border: 'border-violet-400/20', glow: 'rgba(124,58,237,0.15)' },
      extra:   (
        <div className="mt-2 h-1 rounded-full bg-white/5 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-pb-primary to-pb-accent transition-all duration-700"
            style={{ width: `${Math.min(100, summary.recoveryRate)}%` }} />
        </div>
      ),
    },
    {
      label:   'Exceptions',
      value:   summary.exceptionCount,
      sub:     'Could not recover',
      icon:    AlertTriangle,
      accent:  { text: 'text-rose-400', bg: 'bg-rose-400/10', border: 'border-rose-400/20', glow: 'rgba(244,63,94,0.12)' },
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(({ label, value, sub, icon: Icon, accent, extra }) => (
        <div key={label} className="stat-card animate-fade-in"
          style={{ boxShadow: `0 0 30px ${accent.glow}` }}>
          <div className="flex items-start justify-between mb-3">
            <p className="text-pb-subtext text-xs font-medium">{label}</p>
            <span className={`w-7 h-7 rounded-lg ${accent.bg} border ${accent.border} flex items-center justify-center flex-shrink-0`}>
              <Icon size={14} className={accent.text} />
            </span>
          </div>
          <p className={`text-2xl font-bold ${accent.text}`}>{value}</p>
          <p className="text-pb-muted text-xs mt-1">{sub}</p>
          {extra}
        </div>
      ))}
    </div>
  )
}
