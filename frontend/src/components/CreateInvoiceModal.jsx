import { useState }        from 'react'
import { X, Plus }         from 'lucide-react'
import { api }             from '../lib/api'

/**
 * @param {{ onClose: () => void, onCreated: () => void }} props
 */
export default function CreateInvoiceModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    debtorName: '', contactEmail: '', contactPhone: '',
    preferredLanguage: 'en', amountPaise: '', dueDate: '',
  })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await api.createInvoice({
        ...form,
        amountPaise: Math.round(parseFloat(form.amountPaise) * 100),
      })
      onCreated()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md glass-card border border-pb-border animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-pb-border">
          <div className="flex items-center gap-2">
            <Plus size={15} className="text-pb-primary-l" />
            <h2 className="text-sm font-semibold text-pb-text">New Invoice</h2>
          </div>
          <button onClick={onClose} className="text-pb-muted hover:text-pb-text transition-colors"><X size={16} /></button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-pb-subtext mb-1 block">Debtor Name *</label>
              <input required className="input-field" placeholder="Acme Corp Ltd."
                value={form.debtorName} onChange={e => set('debtorName', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-pb-subtext mb-1 block">Email</label>
              <input className="input-field" type="email" placeholder="billing@acme.in"
                value={form.contactEmail} onChange={e => set('contactEmail', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-pb-subtext mb-1 block">Phone</label>
              <input className="input-field" placeholder="+919876543210"
                value={form.contactPhone} onChange={e => set('contactPhone', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-pb-subtext mb-1 block">Amount (₹) *</label>
              <input required className="input-field" type="number" min="1" step="0.01" placeholder="50000"
                value={form.amountPaise} onChange={e => set('amountPaise', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-pb-subtext mb-1 block">Due Date *</label>
              <input required className="input-field" type="date"
                value={form.dueDate} onChange={e => set('dueDate', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-pb-subtext mb-1 block">Reminder Language</label>
              <select className="input-field" value={form.preferredLanguage}
                onChange={e => set('preferredLanguage', e.target.value)}>
                <option value="en">English</option>
                <option value="hi-en">Hinglish (हिंदी-English)</option>
              </select>
            </div>
          </div>

          {error && <p className="text-rose-400 text-xs bg-rose-400/10 border border-rose-400/20 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
              {loading ? 'Creating…' : 'Create Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
