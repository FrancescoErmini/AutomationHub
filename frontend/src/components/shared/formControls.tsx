export const inputClass =
  'w-full rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30'

/** Nullable single-select over a reference list ("—" clears it). */
export function RefSelect({
  value,
  onChange,
  options,
  label,
}: {
  value: string
  onChange: (next: string) => void
  options: { id: number; label: string }[]
  label: string
}) {
  return (
    <select
      className={inputClass}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label={label}
    >
      <option value="">—</option>
      {options.map((option) => (
        <option key={option.id} value={String(option.id)}>
          {option.label}
        </option>
      ))}
    </select>
  )
}
