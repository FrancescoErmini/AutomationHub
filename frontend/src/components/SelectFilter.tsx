interface SelectFilterProps {
  label: string
  placeholder: string
  options: string[]
  value: string
  onChange: (value: string) => void
}

export function SelectFilter({ label, placeholder, options, value, onChange }: SelectFilterProps) {
  return (
    <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-red-100"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}
