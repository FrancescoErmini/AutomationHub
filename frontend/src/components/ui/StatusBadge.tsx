import type { ReactNode } from 'react'

type Tone = 'positive' | 'warning' | 'negative' | 'pending'

const TONE: Record<Tone, { wrap: string; dot: string }> = {
  positive: {
    wrap: 'bg-[var(--ah-positive-bg)] text-positive',
    dot: 'bg-positive',
  },
  warning: {
    wrap: 'bg-[var(--ah-warning-bg)] text-warning',
    dot: 'bg-warning',
  },
  negative: {
    wrap: 'bg-[var(--ah-negative-bg)] text-negative',
    dot: 'bg-negative',
  },
  pending: {
    wrap: 'bg-[var(--ah-pending-bg)] text-slate-600',
    dot: 'bg-pending',
  },
}

export function StatusBadge({
  tone,
  children,
}: {
  tone: Tone
  children: ReactNode
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${TONE[tone].wrap}`}
    >
      <span className={`h-2 w-2 rounded-full ${TONE[tone].dot}`} aria-hidden />
      {children}
    </span>
  )
}
