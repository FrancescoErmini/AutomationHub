import { Link } from 'react-router-dom'

import homeBackground from '../images/home-background.jpg'

export function HomePage() {
  return (
    <section className="relative left-1/2 -mb-12 -mt-12 w-screen -translate-x-1/2 overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-left sm:bg-center"
        style={{ backgroundImage: `url(${homeBackground})` }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-r from-white via-white/80 to-white/35 lg:to-transparent"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-white/50 via-transparent to-transparent"
      />

      <div className="relative mx-auto flex min-h-[88vh] max-w-7xl flex-col justify-center px-6 py-28 sm:px-10">
        <p className="mb-6 text-sm font-semibold uppercase tracking-[0.22em] text-brand">
          Menarini · RPA Program
        </p>
        <h1 className="max-w-4xl text-5xl font-bold leading-[1.04] tracking-tight text-ink sm:text-6xl lg:text-7xl">
          Automation Hub Portal
        </h1>
        <p className="mt-8 max-w-xl text-xl leading-9 text-slate-700">
          From first idea to measured ROI — track cost, savings, and payback
          across every automation in the portfolio.
        </p>
        <div className="mt-12 flex flex-wrap gap-4">
          <Link
            to="/executive"
            className="inline-flex rounded-xl bg-brand px-6 py-3.5 text-base font-semibold text-white shadow-sm transition hover:brightness-95"
          >
            Open the Executive overview
          </Link>
          <Link
            to="/catalog"
            className="inline-flex rounded-xl border border-slate-300 bg-white/80 px-6 py-3.5 text-base font-semibold text-ink shadow-sm backdrop-blur transition hover:bg-white"
          >
            Browse the automation catalog
          </Link>
        </div>
      </div>
    </section>
  )
}
