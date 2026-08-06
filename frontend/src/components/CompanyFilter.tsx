interface CompanyFilterProps {
  companies: string[]
  value: string
  onChange: (value: string) => void
}

export function CompanyFilter({
  companies,
  value,
  onChange,
}: CompanyFilterProps) {
  return (
    <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
      Company
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-blue-100"
      >
        <option value="">All companies</option>
        {companies.map((company) => (
          <option key={company} value={company}>
            {company}
          </option>
        ))}
      </select>
    </label>
  )
}
