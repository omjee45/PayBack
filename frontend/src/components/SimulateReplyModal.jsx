import { useState }    from 'react'
import { X, Sparkles } from 'lucide-react'
import { api }         from '../lib/api'

/**
 * @param {{ invoiceId: string, onClose: () => void, onSuccess: () => void }} props
 */
export default function SimulateReplyModal({ invoiceId, onClose, onSuccess }) {
  const [text,    setText]    = useState('')
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState(null)
  const [error,   setError]   = useState(null)

  const handleExtract = async () => {
    if (!text.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const r = await api.simulateReply(invoiceId, text)
      setResult(r)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = () => onSuccess()

  const EXAMPLES = [
    "Will pay by end of this month, please hold",
    "Payment hogi next Friday pakka",
    "We'll process the invoice by 20th",
    "Sorry for delay, will clear by tomorrow",
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg glass-card border border-pb-border animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-pb-border">
          <div className="flex items-center gap-2">
            <Sparkles size={15} className="text-pb-primary-l" />
            <h2 className="text-sm font-semibold text-pb-text">Simulate Debtor Reply</h2>
          </div>
          <button onClick={onClose} className="text-pb-muted hover:text-pb-text transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-pb-subtext mb-1.5 block">
              Debtor reply text
            </label>
            <textarea
              className="input-field h-24 resize-none"
              placeholder="e.g. &quot;Will pay by end of month, sorry for the delay&quot;"
              value={text}
              onChange={e => { setText(e.target.value); setResult(null); setError(null) }}
            />
          </div>

          {/* Quick examples */}
          <div>
            <p className="text-xs text-pb-muted mb-1.5">Quick examples:</p>
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLES.map(ex => (
                <button key={ex} onClick={() => { setText(ex); setResult(null) }}
                  className="text-[10px] px-2 py-1 rounded bg-white/5 text-pb-subtext hover:bg-white/10 hover:text-pb-text transition-colors border border-pb-border">
                  {ex.slice(0, 30)}…
                </button>
              ))}
            </div>
          </div>

          {/* Extract button */}
          {!result && (
            <button onClick={handleExtract} disabled={loading || !text.trim()}
              className="btn-primary w-full justify-center">
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Extracting via Gemini…
                </span>
              ) : (
                <><Sparkles size={13} /> Extract Promise</>
              )}
            </button>
          )}

          {/* Error */}
          {error && <p className="text-rose-400 text-xs bg-rose-400/10 border border-rose-400/20 rounded-lg px-3 py-2">{error}</p>}

          {/* Result */}
          {result && (
            <div className="rounded-xl p-4 space-y-3 animate-slide-up"
              style={{ background: result.extracted.has_promise ? 'rgba(124,58,237,0.08)' : 'rgba(255,255,255,0.03)',
                       border: `1px solid ${result.extracted.has_promise ? 'rgba(124,58,237,0.25)' : 'rgba(255,255,255,0.07)'}` }}>
              {result.extracted.has_promise ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="badge text-emerald-400 bg-emerald-400/10 border-emerald-400/20">Promise Detected</span>
                    <span className="text-xs text-pb-muted">{Math.round(result.extracted.confidence * 100)}% confidence</span>
                  </div>
                  <div>
                    <p className="text-pb-text font-semibold">Pay by {new Date(result.extracted.promised_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    <p className="text-pb-subtext text-xs mt-1 italic">"{result.extracted.reasoning}"</p>
                  </div>
                  <p className="text-pb-subtext text-xs bg-violet-400/5 border border-violet-400/10 rounded-lg px-3 py-2">
                    ⏸ Escalation will pause until {result.extracted.promised_date}. If payment is not received by then, the engine automatically escalates (skipping a tier).
                  </p>
                </>
              ) : (
                <div className="flex items-start gap-2">
                  <span className="badge text-pb-subtext bg-white/5 border-pb-border mt-0.5">No Promise</span>
                  <p className="text-pb-subtext text-xs">{result.extracted.reasoning}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-pb-border">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          {result?.extracted.has_promise && (
            <button onClick={handleConfirm} className="btn-primary">
              Confirm Promise
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
