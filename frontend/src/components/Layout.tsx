import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from 'react-oidc-context'

import logoSquare from '../images/logo-placeholder.svg'
import { ManagementDrawer } from './ManagementDrawer'

const navClass = ({ isActive }: { isActive: boolean }) =>
  `-mb-px border-b-2 px-1 pb-3 pt-1 text-sm font-semibold transition ${
    isActive
      ? 'border-[var(--ah-indigo)] text-white'
      : 'border-transparent text-white/70 hover:text-white'
  }`

// Pages that carry a footer pointer into the Data Dictionary, mapped to the
// dictionary category most relevant to that page (opened as /documentation#<id>).
const DOC_FOOTER: Record<string, string> = {
  '/executive': 'program-economics',
  '/simple-ops': 'running-costs',
  '/sla-kpi': 'service-sla',
  '/process-economics': 'program-economics',
  '/tickets': 'ams-operations',
}

export function Layout() {
  const auth = useAuth()
  const location = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const docSection = DOC_FOOTER[location.pathname]

  return (
    <div className="min-h-screen bg-[var(--ah-canvas)]">
      <header className="bg-[var(--ah-navy)] text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <NavLink
            to="/"
            className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-white"
          >
            <img src={logoSquare} alt="" className="h-8 w-8 rounded-md" />
            Automation Hub
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
              SLA / KPI
            </NavLink>
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Management"
              title="Management"
              className="rounded-lg border border-white/30 p-2 text-white transition hover:bg-white/10"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
            {auth.isAuthenticated ? (
              <>
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
              </>
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
        </div>
      </header>

      <ManagementDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />

      <main className="mx-auto max-w-7xl px-6 py-10">
        <Outlet />
        {docSection && (
          <footer className="mt-12 border-t border-slate-200 pt-4 text-sm text-slate-500">
            Definitions, data sources and formulas for the figures on this page
            are documented in the{' '}
            <a
              href={`/documentation#${docSection}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-accent hover:underline"
            >
              Data Dictionary &amp; Methodology
            </a>
            .
          </footer>
        )}
      </main>
    </div>
  )
}
