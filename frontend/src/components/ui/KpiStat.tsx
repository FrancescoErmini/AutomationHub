type Tone = 'auto' | 'positive' | 'negative' | 'muted'
type Dot = 'positive' | 'negative' | 'pending'

interface KpiStatProps {
  label: string
  value: string
  delta?: string
  deltaTone?: Tone
  dot?: Dot
  hero?: boolean
}

const DOT_CLASS: Record<Dot, string> = {
  positive: 'bg-positive',
  negative: 'bg-negative',
  pending: 'bg-pending',
}

function resolveDeltaClass(delta: string | undefined, tone: Tone): string {
  if (!delta) return ''
  if (tone === 'positive') return 'text-positive'
  if (tone === 'negative') return 'text-negative'
  if (tone === 'muted') return 'text-slate-500'
  const trimmed = delta.trimStart()
  if (trimmed.startsWith('-')) return 'text-negative'
  if (trimmed.startsWith('+')) return 'text-positive'
  return 'text-slate-500'
}

export function KpiStat({
  label,
  value,
  delta,
  deltaTone = 'auto',
  dot,
  hero = false,
}: KpiStatProps) {
  return (
    <div
      className={`flex flex-col gap-1.5 rounded-xl border border-slate-200 p-4 shadow-card ${
        hero
          ? 'bg-[color-mix(in_srgb,theme(colors.brand)_5%,#fff)]'
          : 'bg-white'
      }`}
    >
      <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-accent">
        {dot && (
          <span
            className={`h-2 w-2 rounded-full ${DOT_CLASS[dot]}`}
            aria-hidden
          />
        )}
        {label}
      </p>
      <p
        className={`font-bold tracking-tight text-ink [font-feature-settings:'pnum'_1] ${
          hero ? 'text-4xl' : 'text-2xl'
        }`}
      >
        {value}
      </p>
      {delta && (
        <p
          className={`text-xs font-semibold ${resolveDeltaClass(delta, deltaTone)}`}
        >
          {delta}
        </p>
      )}
    </div>
  )
}
