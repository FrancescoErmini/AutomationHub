import { useEffect, useRef, type ReactNode } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useAuth } from 'react-oidc-context'

export function RequireAuth({ children }: { children?: ReactNode }) {
  const auth = useAuth()
  const location = useLocation()
  const triedSignin = useRef(false)

  useEffect(() => {
    if (
      !auth.isLoading &&
      !auth.isAuthenticated &&
      !auth.activeNavigator &&
      !auth.error &&
      !triedSignin.current
    ) {
      // Latch so a failed or slow redirect can't re-trigger this effect on the
      // next context update — that is what causes "Maximum update depth exceeded".
      triedSignin.current = true
      void auth.signinRedirect({ state: { returnTo: location.pathname } })
    }
  }, [auth, location.pathname])

  if (auth.isAuthenticated) return <>{children ?? <Outlet />}</>

  if (auth.error) {
    return (
      <div className="p-12 text-center text-rose-600">
        Sign-in failed: {auth.error.message}
      </div>
    )
  }

  return <div className="p-12 text-center text-slate-600">Signing in…</div>
}
