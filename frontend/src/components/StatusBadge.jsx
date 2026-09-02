/** Status → display config */
const STATUS = {
  DUE:        { label: 'Due',        cls: 'text-blue-400   bg-blue-400/10   border-blue-400/25'  },
  GENTLE:     { label: 'Gentle',     cls: 'text-amber-400  bg-amber-400/10  border-amber-400/25' },
  FIRM:       { label: 'Firm',       cls: 'text-orange-400 bg-orange-400/10 border-orange-400/25'},
  PROMISED:   { label: 'Promised',   cls: 'text-violet-400 bg-violet-400/10 border-violet-400/25'},
  ESCALATION: { label: 'Escalation', cls: 'text-red-400    bg-red-400/10    border-red-400/25'   },
  LEGAL_FLAG: { label: 'Legal Flag', cls: 'text-rose-300   bg-rose-900/25   border-rose-500/30'  },
  PAID:       { label: 'Paid ✓',     cls: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/25' },
}

/**
 * @param {{ status: string, size?: 'sm'|'md' }} props
 */
export default function StatusBadge({ status, size = 'md' }) {
  const cfg = STATUS[status] ?? { label: status, cls: 'text-pb-subtext bg-white/5 border-pb-border' }
  return (
    <span className={`badge ${cfg.cls} ${size === 'sm' ? 'text-[10px] px-1.5' : ''}`}>
      {cfg.label}
    </span>
  )
}

export { STATUS }
