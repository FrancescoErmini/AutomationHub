import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from 'react-oidc-context'

import logoSquare from '../images/logo-square.png'

const navClass = ({ isActive }: { isActive: boolean }) =>
  `-mb-px border-b-2 px-1 pb-3 pt-1 text-sm font-semibold transition ${
    isActive
      ? 'border-brand text-ink'
      : 'border-transparent text-slate-500 hover:text-ink'
  }`

export function Layout() {
  const auth = useAuth()

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <NavLink
            to="/"
            className="flex items-center gap-2 text-lg font-bold tracking-tight text-ink"
          >
            <img src={logoSquare} alt="" className="h-8 w-8 rounded-md" />
            Menarini Automation Hub
          </NavLink>
          <nav aria-label="Main navigation" className="flex flex-wrap gap-x-6 gap-y-1 self-stretch">
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
          {auth.isAuthenticated ? (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-slate-600">
                {auth.user?.profile.name ??
                  auth.user?.profile.preferred_username}
              </span>
              <button
                type="button"
                onClick={() => {
                  void auth.removeUser()
                  void auth.signoutRedirect()
                }}
                className="rounded-lg border border-slate-300 px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void auth.signinRedirect()}
              className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white transition hover:brightness-95"
            >
              Sign in
            </button>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-12">
        <Outlet />
      </main>
    </div>
  )
}
