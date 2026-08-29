interface Option {
  id: number
  name: string
}

interface CascadingSelectProps {
  label: string
  options: Option[]
  value: number | undefined
  onChange: (value: number | undefined) => void
  disabled?: boolean
}

export function CascadingSelect({
  label,
  options,
  value,
  onChange,
  disabled,
}: CascadingSelectProps) {
  return (
    <label className="block text-sm font-semibold text-slate-600">
      {label}
      <select
        value={value ?? ''}
        disabled={disabled}
        onChange={(event) => {
          const raw = event.target.value
          onChange(raw === '' ? undefined : Number(raw))
        }}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand focus:outline-none focus:ring-2 focus:ring-red-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
      >
        <option value="">
          {disabled ? 'Select the level above first' : `Select ${label}`}
        </option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  )
}
