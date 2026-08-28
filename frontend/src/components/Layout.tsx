import { NavLink, Outlet } from 'react-router-dom'

import logoSquare from '../images/logo-square.png'

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-2 text-sm font-semibold transition ${
    isActive ? 'bg-blue-100 text-brand' : 'text-slate-600 hover:bg-slate-100'
  }`

export function Layout() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <NavLink
            to="/"
            className="flex items-center gap-2 text-lg font-bold tracking-tight text-ink"
          >
            <img src={logoSquare} alt="" className="h-8 w-8 rounded-md" />
            Menarini Automation Hub
          </NavLink>
          <nav aria-label="Main navigation" className="flex flex-wrap gap-2">
            <NavLink to="/" end className={navClass}>
              Home
            </NavLink>
            <NavLink to="/catalog" className={navClass}>
              Automations
            </NavLink>
            <NavLink to="/ideas" className={navClass}>
              Ideas
            </NavLink>
            <NavLink to="/executive" className={navClass}>
              Executive
            </NavLink>
            <NavLink to="/simple-ops" className={navClass}>
              Operations
            </NavLink>
            <NavLink to="/sla-kpi" className={navClass}>
              SLA/KPI
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-12">
        <Outlet />
      </main>
    </div>
  )
}
