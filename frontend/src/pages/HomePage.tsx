import { Link } from 'react-router-dom'

const ENTRY_POINTS = [
  {
    to: '/executive',
    title: 'Executive overview',
    body: 'Program economics, ROI multiple, payback year, and FTE-equivalent freed.',
  },
  {
    to: '/catalog',
    title: 'Automation catalog',
    body: 'Every process live today and every candidate still in the pipeline.',
  },
  {
    to: '/simple-ops',
    title: 'Operations',
    body: 'Running cost of the estate — licences, infrastructure, and support.',
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
        {ENTRY_POINTS.map((entry) => (
          <Link
            key={entry.to}
            to={entry.to}
            className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-6 shadow-card transition hover:border-accent hover:shadow-pop"
          >
            <h2 className="text-base font-bold tracking-tight text-ink">
              {entry.title}
            </h2>
            <p className="text-sm leading-relaxed text-slate-600">
              {entry.body}
            </p>
            <span className="mt-2 text-sm font-semibold text-accent">
              Open →
            </span>
          </Link>
        ))}
      </section>
    </div>
  )
}
