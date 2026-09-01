import type { ReactNode } from 'react'

interface DeltaChipProps {
  /** Signed percentage change, e.g. 12 or -5. */
  pct: number
  /** Trailing label after the value. Defaults to "YoY". */
  label?: ReactNode
  /** Append a "*" marker tying the chip to a footnote. */
  footnote?: boolean
}

/**
 * Small colored directional chip for a period-over-period change.
 * Positive change reads green with an up arrow, negative red with a down arrow.
 */
export function DeltaChip({ pct, label = 'YoY', footnote = false }: DeltaChipProps) {
  const up = pct >= 0
  const rounded = Math.round(pct)
  const tone = up
    ? 'bg-[var(--ah-positive-bg)] text-positive'
    : 'bg-[var(--ah-negative-bg)] text-negative'

  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}
    >
      <span aria-hidden>{up ? '↑' : '↓'}</span>
      {up ? '+' : ''}
      {rounded}% {label}
      {footnote && <span aria-hidden>*</span>}
    </span>
  )
}
