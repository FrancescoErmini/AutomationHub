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
        className="rounded-xl border border-negative/30 bg-negative/5 p-6 text-negative"
      >
        {error?.message ?? 'Something went wrong.'}
      </div>
    )
  }
  return <>{children}</>
}
