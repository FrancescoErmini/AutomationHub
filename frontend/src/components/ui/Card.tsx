import type { ReactNode } from 'react'

interface CardProps {
  kicker?: string
  title?: string
  className?: string
  children: ReactNode
}

export function Card({ kicker, title, className = '', children }: CardProps) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white p-5 shadow-[var(--ah-shadow-card)] ${className}`}
    >
      {kicker && (
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">
          {kicker}
        </p>
      )}
      {title && (
        <h3 className="mt-1 text-base font-bold tracking-tight text-ink">
          {title}
        </h3>
      )}
      {children}
    </div>
  )
}
