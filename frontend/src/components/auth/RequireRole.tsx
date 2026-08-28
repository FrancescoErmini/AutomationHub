import { Outlet } from 'react-router-dom'

import type { Role } from '../../api/me'
import { useMe } from '../../hooks/useMe'
import { RequireAuth } from './RequireAuth'

function Denied({ role }: { role: Role }) {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <h1 className="text-xl font-semibold text-ink">Access restricted</h1>
      <p className="mt-2 text-slate-600">
        This page needs the <strong>{role}</strong> role. Ask an administrator
        to grant it to your account.
      </p>
    </div>
  )
}

function RoleGate({ role }: { role: Role }) {
  const { data: me, isLoading } = useMe()
  if (isLoading) {
    return (
      <div className="p-12 text-center text-slate-600">Checking access…</div>
    )
  }
  if (me?.role === role || me?.role === 'admin') return <Outlet />
  return <Denied role={role} />
}

export function RequireRole({ role }: { role: Role }) {
  return (
    <RequireAuth>
      <RoleGate role={role} />
    </RequireAuth>
  )
}
