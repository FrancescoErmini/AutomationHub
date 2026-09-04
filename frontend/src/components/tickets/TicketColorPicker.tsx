import { TICKET_COLORS } from './ticketColors'

/** Horizontal row of 8 colour swatches plus a 9th "transparent" swatch that
 *  clears the colour. `value` is a hex string or null (no colour). */
export function TicketColorPicker({
  value,
  onChange,
}: {
  value: string | null
  onChange: (next: string | null) => void
}) {
  const swatch =
    'h-6 w-6 rounded-full border border-slate-300 transition hover:scale-110 focus:outline-none focus:ring-2 focus:ring-accent/40'
  const selectedRing = 'ring-2 ring-offset-1 ring-slate-700'

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Colour
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        {TICKET_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`Set label colour ${color}`}
            aria-pressed={value === color}
            onClick={() => onChange(color)}
            className={`${swatch} ${value === color ? selectedRing : ''}`}
            style={{ backgroundColor: color }}
          />
        ))}
        <button
          type="button"
          aria-label="Clear label colour"
          aria-pressed={value === null}
          onClick={() => onChange(null)}
          className={`${swatch} relative bg-white ${
            value === null ? selectedRing : ''
          }`}
        >
          <span className="pointer-events-none absolute left-1/2 top-1/2 h-[1px] w-[26px] -translate-x-1/2 -translate-y-1/2 rotate-45 bg-negative" />
        </button>
      </div>
    </div>
  )
}
