import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from 'react-oidc-context'

import logoSquare from '../images/logo-square.png'

const navClass = ({ isActive }: { isActive: boolean }) =>
  `-mb-px border-b-2 px-1 pb-3 pt-1 text-sm font-semibold transition ${
    isActive
      ? 'border-[var(--ah-indigo)] text-white'
      : 'border-transparent text-white/70 hover:text-white'
  }`

export function Layout() {
  const auth = useAuth()

  return (
    <div className="min-h-screen bg-[var(--ah-canvas)]">
      <header className="bg-[var(--ah-navy)] text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <NavLink
            to="/"
            className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-white"
          >
            <img src={logoSquare} alt="" className="h-8 w-8 rounded-md" />
            Menarini Automation Hub
          </NavLink>
          <nav
            aria-label="Main navigation"
            className="flex flex-wrap gap-x-6 gap-y-1 self-stretch"
          >
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
              Performances
            </NavLink>
            <NavLink to="/process-economics" className={navClass}>
              Business Cases
            </NavLink>
          </nav>
          {auth.isAuthenticated ? (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-white/70">
                {auth.user?.profile.name ??
                  auth.user?.profile.preferred_username}
              </span>
              <button
                type="button"
                onClick={() => {
                  void auth.removeUser()
                  void auth.signoutRedirect()
                }}
                className="rounded-lg border border-white/30 px-3 py-2 font-semibold text-white transition hover:bg-white/10"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void auth.signinRedirect()}
              className="rounded-lg bg-[var(--ah-indigo)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--ah-indigo-hover)]"
            >
              Sign in
            </button>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-10">
        <Outlet />
      </main>
    </div>
  )
}
