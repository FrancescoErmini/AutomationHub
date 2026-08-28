import { useEffect, type ReactNode } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useAuth } from 'react-oidc-context'

export function RequireAuth({ children }: { children?: ReactNode }) {
  const auth = useAuth()
  const location = useLocation()

  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated && !auth.activeNavigator) {
      void auth.signinRedirect({ state: { returnTo: location.pathname } })
    }
  }, [auth, location.pathname])

  if (auth.isAuthenticated) return <>{children ?? <Outlet />}</>
  return <div className="p-12 text-center text-slate-600">Signing in…</div>
}
