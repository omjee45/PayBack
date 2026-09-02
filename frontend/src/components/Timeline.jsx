import { CheckCircle2, AlertOctagon, RefreshCw, MessageSquare, Webhook, ArrowRight } from 'lucide-react'

const EVENT_CONFIG = {
  STATE_CHANGE:     { icon: ArrowRight,    colour: 'text-pb-primary-l', bg: 'bg-pb-primary/20',   label: (p) => `${p.from ?? 'NEW'} → ${p.to}` },
  REMINDER_SENT:    { icon: MessageSquare, colour: 'text-amber-400',    bg: 'bg-amber-400/15',    label: (p) => `Reminder sent · ${p.tier}` },
  PROMISE_CAPTURED: { icon: CheckCircle2,  colour: 'text-violet-400',   bg: 'bg-violet-400/15',   label: ()  => 'Promise captured' },
  PROMISE_KEPT:     { icon: CheckCircle2,  colour: 'text-emerald-400',  bg: 'bg-emerald-400/15',  label: ()  => 'Promise kept ✓' },
  PROMISE_BROKEN:   { icon: AlertOctagon,  colour: 'text-rose-400',     bg: 'bg-rose-400/15',     label: ()  => 'Promise broken' },
  WEBHOOK_RECEIVED: { icon: Webhook,       colour: 'text-emerald-400',  bg: 'bg-emerald-400/15',  label: ()  => 'Payment captured via webhook' },
}
const FALLBACK    = { icon: RefreshCw, colour: 'text-pb-subtext', bg: 'bg-white/10', label: (_, type) => type }

function fmtTs(d) {
  return new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/**
 * @param {{ events: Array<{id:string, eventType:string, payload:string, createdAt:string}> }} props
 */
export default function Timeline({ events }) {
  if (!events?.length) return <p className="text-pb-muted text-sm">No events yet.</p>

  return (
    <div className="space-y-0">
      {[...events].reverse().map(evt => {
        const cfg  = EVENT_CONFIG[evt.eventType] ?? FALLBACK
        let payload = {}
        try { payload = JSON.parse(evt.payload ?? '{}') } catch { /**/ }
        const Icon  = cfg.icon
        const label = cfg.label(payload, evt.eventType)

        return (
          <div key={evt.id} className="tl-item animate-fade-in">
            {/* Dot */}
            <span className={`absolute left-0 top-1 w-[28px] h-[28px] rounded-full ${cfg.bg}
              flex items-center justify-center flex-shrink-0`}>
              <Icon size={13} className={cfg.colour} />
            </span>

            <div>
              <p className={`text-sm font-medium ${cfg.colour}`}>{label}</p>
              <p className="text-pb-muted text-[11px] mt-0.5">{fmtTs(evt.createdAt)}</p>
              {/* Extra detail */}
              {evt.eventType === 'STATE_CHANGE' && payload.reason && (
                <p className="text-pb-muted text-[10px] mt-0.5 font-mono">{payload.reason}</p>
              )}
              {evt.eventType === 'PROMISE_CAPTURED' && payload.promisedDate && (
                <p className="text-pb-subtext text-xs mt-0.5">
                  Promised: {new Date(payload.promisedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {payload.confidence && <> · {Math.round(payload.confidence * 100)}% confidence</>}
                </p>
              )}
              {evt.eventType === 'WEBHOOK_RECEIVED' && payload.paymentId && (
                <p className="text-pb-muted text-[10px] mt-0.5 font-mono">{payload.paymentId}</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
