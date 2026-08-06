import { Link } from 'react-router-dom'

export function HomePage() {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
      <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-brand">
        Development foundation
      </p>
      <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-ink sm:text-5xl">
        Build reliable automation products from a tested baseline.
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
        The API, PostgreSQL storage, data validation, and browser application
        are wired together and ready for extension.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          to="/executive"
          className="inline-flex rounded-xl bg-brand px-5 py-3 font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          Open the RPA analytics portal
        </Link>
        <Link
          to="/items"
          className="inline-flex rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-ink shadow-sm hover:bg-slate-50"
        >
          Manage items
        </Link>
      </div>
    </section>
  )
}
