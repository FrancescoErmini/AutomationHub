interface Column<T> {
  key: keyof T
  label: string
  align?: 'left' | 'right'
  format?: (value: T[keyof T], row: T) => string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  caption: string
  getRowKey: (row: T) => string
}

export function DataTable<T>({
  columns,
  rows,
  caption,
  getRowKey,
}: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-card">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {columns.map((column) => (
              <th
                key={String(column.key)}
                scope="col"
                className={`px-4 py-3 ${column.align === 'right' ? 'text-right' : 'text-left'}`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={getRowKey(row)}
              className="border-b border-slate-100 last:border-0"
            >
              {columns.map((column) => (
                <td
                  key={String(column.key)}
                  className={`px-4 py-3 ${column.align === 'right' ? 'text-right tabular-nums' : ''}`}
                >
                  {column.format
                    ? column.format(row[column.key], row)
                    : String(row[column.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
