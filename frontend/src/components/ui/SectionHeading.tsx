import type { ReactNode } from 'react'

interface SectionHeadingProps {
  children: ReactNode
  dotColor?: string
  stat?: ReactNode
}

export function SectionHeading({
  children,
  dotColor,
  stat,
}: SectionHeadingProps) {
  return (
    <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
      <h2 className="text-xl font-bold tracking-tight text-ink">
        {dotColor && (
          <span
            className="mr-2.5 inline-block h-2.5 w-2.5 rounded-full align-[1px]"
            style={{ background: dotColor }}
            aria-hidden
          />
        )}
        {children}
      </h2>
      {stat && <p className="text-sm text-slate-500">{stat}</p>}
    </div>
  )
}
