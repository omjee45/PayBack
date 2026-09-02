import { Zap } from 'lucide-react'

/**
 * @param {{ dayOffset: number, loading: boolean, onTick: () => void }} props
 */
export default function TickButton({ dayOffset, loading, onTick }) {
  return (
    <button
      id="tick-day-btn"
      onClick={onTick}
      disabled={loading}
      className="relative group flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold
                 bg-gradient-to-r from-pb-primary to-violet-500 text-white
                 hover:from-violet-500 hover:to-pb-primary
                 disabled:opacity-60 disabled:cursor-not-allowed
                 transition-all duration-200 select-none overflow-hidden
                 shadow-[0_0_20px_rgba(124,58,237,0.35)]
                 hover:shadow-[0_0_35px_rgba(124,58,237,0.55)]"
    >
      {/* animated pulse ring */}
      {!loading && (
        <span className="absolute inset-0 rounded-xl border border-pb-primary-l/40 animate-ping-slow opacity-60 pointer-events-none" />
      )}

      <Zap size={15} fill={loading ? 'none' : 'white'} className={loading ? 'animate-spin-slow' : ''} />

      <span>
        {loading ? 'Ticking…' : 'Tick Day'}
      </span>

      {/* day counter badge */}
      <span className="ml-1 px-2 py-0.5 rounded-full bg-white/20 text-xs font-mono">
        +{dayOffset}
      </span>
    </button>
  )
}
