import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: ReactNode
}

export function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <header className="mb-8">
      <h1 className="text-3xl font-bold tracking-tight text-ink">{title}</h1>
      {subtitle && (
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
          {subtitle}
        </p>
      )}
    </header>
  )
}
