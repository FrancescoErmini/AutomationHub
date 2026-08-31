import type { ReactNode } from 'react'

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">
      {children}
    </span>
  )
}
