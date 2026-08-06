import type { ProcessCatalogItem } from '../api/processCatalog'

interface ProcessCatalogCardProps {
  item: ProcessCatalogItem
}

export function ProcessCatalogCard({ item }: ProcessCatalogCardProps) {
  const tagClass = item.is_live
    ? 'bg-blue-100 text-brand'
    : 'bg-amber-100 text-amber-800'

  return (
    <article className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <span
        className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold ${tagClass}`}
      >
        {item.department}
      </span>
      <h3 className="font-semibold text-ink">{item.title}</h3>
      <p className="line-clamp-3 text-sm text-slate-600">
        {item.description || 'No description provided.'}
      </p>
    </article>
  )
}
