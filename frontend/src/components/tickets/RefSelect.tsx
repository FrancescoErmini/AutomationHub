import { inputClass } from './ticketForm'

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
