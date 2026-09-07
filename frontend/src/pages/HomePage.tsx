import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface CardLink {
  to: string
  label: string
}

interface EntryCard {
  icon: ReactNode
  kicker: string
  title: string
  body: string
  links: CardLink[]
}

function IconIdea() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 1.6a4.4 4.4 0 0 0-2.5 8c.4.3.6.8.6 1.3v.3h3.8v-.3c0-.5.2-1 .6-1.3a4.4 4.4 0 0 0-2.5-8Z" />
      <path d="M6.3 13.4h3.4M6.8 14.9h2.4" />
    </svg>
  )
}

function IconGear() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="8" cy="8" r="2.3" />
      <path d="M8 1.8v1.6M8 12.6v1.6M14.2 8h-1.6M3.4 8H1.8M12.2 3.8l-1.1 1.1M4.9 11.1l-1.1 1.1M12.2 12.2l-1.1-1.1M4.9 4.9 3.8 3.8" />
    </svg>
  )
}

function IconChart() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2.2 13.6h11.6" />
      <path d="M4.2 13V8.4M8 13V3.2M11.8 13V6.6" />
    </svg>
  )
}

const ENTRY_CARDS: EntryCard[] = [
  {
    icon: <IconIdea />,
    kicker: 'Discover & Create',
    title: 'Submit & Browse Automations',
    body: 'Have a new automation idea? Or want to see what is already live? Access the full life cycle from ideation to catalog.',
    links: [
      { to: '/ideas/new', label: 'Submit new idea' },
      { to: '/catalog', label: 'View automations catalog' },
    ],
  },
  {
    icon: <IconGear />,
    kicker: 'Operational Oversight',
    title: 'Supervise Live Processes',
    body: 'Review process stability, browse documentation, and track the running cost of the estate.',
    links: [
      { to: '/documentation', label: 'Process documentation' },
      { to: '/simple-ops', label: 'Manage running costs' },
    ],
  },
  {
    icon: <IconChart />,
    kicker: 'Analyze & Optimize',
    title: 'Performance & ROI Metrics',
    body: 'Review aggregate program economics, monitor SLA health, and track ROI across the portfolio.',
    links: [
      { to: '/executive', label: 'Executive overview' },
      { to: '/sla-kpi', label: 'SLA & KPI metrics' },
    ],
  },
]

export function HomePage() {
  return (
    <div className="space-y-12">
      <section className="rounded-2xl border border-slate-200 bg-white px-8 py-14 shadow-card sm:px-12 sm:py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
          Menarini · RPA Program
        </p>
        <h1 className="mt-5 max-w-4xl text-4xl font-bold leading-[1.08] tracking-tight text-ink sm:text-5xl lg:text-6xl">
          Automation Hub Portal
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
          From first idea to measured ROI — track cost, savings, and payback
          across every automation in the portfolio.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            to="/executive"
            className="inline-flex rounded-lg bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-brandHover"
          >
            Open the Executive overview
          </Link>
          <Link
            to="/catalog"
            className="inline-flex rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:border-accent hover:text-accent"
          >
            Browse the automation catalog
          </Link>
        </div>
      </section>

      <section aria-label="Sections" className="grid gap-5 sm:grid-cols-3">
        {ENTRY_CARDS.map((entry) => (
          <div
            key={entry.kicker}
            className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-card"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                {entry.icon}
              </span>
              <h2 className="text-base font-bold tracking-tight text-ink">
                {entry.kicker}
              </h2>
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink">{entry.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {entry.body}
              </p>
            </div>
            <div className="mt-auto flex flex-col gap-1.5 border-t border-slate-100 pt-4">
              {entry.links.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="text-sm font-semibold text-accent underline decoration-accent/30 underline-offset-2 transition hover:text-accentHover hover:decoration-accentHover"
                >
                  {link.label} →
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
