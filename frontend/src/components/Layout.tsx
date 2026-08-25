import { NavLink, Outlet } from 'react-router-dom'

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-2 text-sm font-semibold transition ${
    isActive ? 'bg-blue-100 text-brand' : 'text-slate-600 hover:bg-slate-100'
  }`

export function Layout() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <NavLink to="/" className="text-lg font-bold tracking-tight text-ink">
            Automation Hub
          </NavLink>
          <nav aria-label="Main navigation" className="flex flex-wrap gap-2">
            <NavLink to="/" end className={navClass}>
              Home
            </NavLink>
            <NavLink to="/catalog" className={navClass}>
              Automations
            </NavLink>
            <NavLink to="/executive" className={navClass}>
              Executive
            </NavLink>
            <NavLink to="/simple-ops" className={navClass}>
              Simple Ops
            </NavLink>
            <NavLink to="/items" className={navClass}>
              Items
            </NavLink>
            <NavLink to="/ideas" className={navClass}>
              Ideas
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
