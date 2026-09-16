import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'

const LINKS = [
  { to: '/process-economics', label: 'Business Cases' },
  { to: '/tickets', label: 'Tickets' },
  { to: '/years', label: 'Anni' },
  { to: '/processes', label: 'Processi' },
  { to: '/orders', label: 'Ordini' },
] as const

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded-lg px-3 py-2 text-sm font-semibold transition ${
    isActive
      ? 'bg-[var(--ah-indigo)] text-white'
      : 'text-slate-700 hover:bg-slate-100'
  }`

export function ManagementDrawer({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-black/30"
      />
      <aside
        role="dialog"
        aria-label="Management"
        className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
          <h2 className="text-base font-bold tracking-tight text-ink">
            Management
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-slate-500 transition hover:bg-slate-100 hover:text-ink"
          >
            <svg
              viewBox="0 0 20 20"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </div>
        <p className="px-4 pb-1 pt-3 text-xs text-slate-500">
          Tools for project managers and the AMS provider.
        </p>
        <nav aria-label="Management navigation" className="space-y-1 px-2 py-2">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={linkClass}
              onClick={onClose}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </div>
  )
}
