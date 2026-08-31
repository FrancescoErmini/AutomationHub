interface SelectFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  options: string[]
}

export function SelectField({
  label,
  value,
  onChange,
  options,
}: SelectFieldProps) {
  return (
    <label className="block text-sm font-semibold text-slate-600">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
      >
        <option value="">Select…</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}

interface NumberFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  min?: number
}

export function NumberField({
  label,
  value,
  onChange,
  min = 0,
}: NumberFieldProps) {
  return (
    <label className="block text-sm font-semibold text-slate-600">
      {label}
      <input
        type="number"
        value={value}
        min={min}
        step="any"
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
      />
    </label>
  )
}

interface TextFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  maxLength?: number
}

export function TextField({
  label,
  value,
  onChange,
  maxLength,
}: TextFieldProps) {
  return (
    <label className="block text-sm font-semibold text-slate-600">
      {label}
      <input
        type="text"
        value={value}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
      />
    </label>
  )
}
