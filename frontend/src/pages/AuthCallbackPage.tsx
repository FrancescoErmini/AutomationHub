import { Navigate } from 'react-router-dom'
import { useAuth } from 'react-oidc-context'

export function AuthCallbackPage() {
  const auth = useAuth()

  if (auth.isLoading) {
    return <div className="p-12 text-center text-slate-600">Signing in…</div>
  }
  if (auth.error) {
    return (
      <div className="p-12 text-center text-brand">
        Sign-in failed: {auth.error.message}
      </div>
    )
  }
  const returnTo =
    (auth.user?.state as { returnTo?: string } | undefined)?.returnTo ?? '/'
  return <Navigate to={returnTo} replace />
}
