import { useEffect, type ReactNode } from 'react'
import { useAuth } from 'react-oidc-context'

import { configureApiAuth } from '../api/client'

export function AuthBridge({ children }: { children: ReactNode }) {
  const auth = useAuth()

  useEffect(() => {
    configureApiAuth({
      getToken: () => auth.user?.access_token,
      onUnauthorized: () => {
        if (!auth.isLoading && !auth.activeNavigator) {
          void auth.signinRedirect({
            state: { returnTo: window.location.pathname },
          })
        }
      },
    })
  }, [auth])

  return <>{children}</>
}
