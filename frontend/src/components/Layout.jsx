import { Outlet, Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, Zap } from 'lucide-react'

export default function Layout() {
  const { pathname } = useLocation()

  return (
    <div className="min-h-screen bg-pb-bg bg-grid-pattern flex">

      {/* ── Sidebar ──────────────────────────────────────────────────── */}
      <aside className="w-60 flex-shrink-0 flex flex-col border-r border-pb-border bg-black/30 backdrop-blur-xl">

        {/* Logo */}
        <div className="px-5 pt-6 pb-5 border-b border-pb-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pb-primary to-pb-accent
                            flex items-center justify-center shadow-lg animate-glow-pulse">
              <Zap size={16} fill="white" color="white" />
            </div>
            <div>
              <p className="text-pb-text font-bold text-sm tracking-tight">PayBack</p>
              <p className="text-pb-muted text-[10px]">AI Collections Agent</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5">
          <NavLink to="/"    icon={LayoutDashboard} label="Dashboard" current={pathname} />
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-pb-border">
          <p className="text-pb-muted text-[10px] text-center leading-relaxed">
            Razorpay Hackathon 2026<br />
            Track 03 · AI Revenue Recovery
          </p>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}

function NavLink({ to, icon: Icon, label, current }) {
  const active = current === to || (to !== '/' && current.startsWith(to))
  return (
    <Link to={to} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
      active
        ? 'bg-pb-primary/20 text-pb-primary-l border border-pb-primary/25'
        : 'text-pb-subtext hover:text-pb-text hover:bg-white/5'
    }`}>
      <Icon size={15} />
      {label}
    </Link>
  )
}
