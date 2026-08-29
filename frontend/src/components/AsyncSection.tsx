import type { ReactNode } from 'react'

interface AsyncSectionProps {
  isPending: boolean
  isError: boolean
  error: Error | null
  loadingLabel: string
  children: ReactNode
}

export function AsyncSection({
  isPending,
  isError,
  error,
  loadingLabel,
  children,
}: AsyncSectionProps) {
  if (isPending) {
    return (
      <p className="rounded-xl bg-white p-6 text-slate-600">{loadingLabel}</p>
    )
  }
  if (isError) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-brand/30 bg-brand/5 p-6 text-brand"
      >
        {error?.message ?? 'Something went wrong.'}
      </div>
    )
  }
  return <>{children}</>
}
