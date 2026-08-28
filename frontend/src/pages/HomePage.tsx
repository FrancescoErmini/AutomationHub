import { Link } from 'react-router-dom'

export function HomePage() {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
      <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-brand">
        Menarini · RPA Program
      </p>
      <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-ink sm:text-5xl">
        Automation Hub Portal
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
        From first idea to measured ROI — track cost, savings, and payback
        across every automation in the portfolio.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          to="/executive"
          className="inline-flex rounded-xl bg-brand px-5 py-3 font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          Open the Executive overview
        </Link>
        <Link
          to="/catalog"
          className="inline-flex rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-ink shadow-sm hover:bg-slate-50"
        >
          Browse the automation catalog
        </Link>
      </div>
    </section>
  )
}
