import { useQuery } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'

import { fetchMe } from '../api/me'

export function useMe() {
  const auth = useAuth()
  return useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
    enabled: auth.isAuthenticated,
    staleTime: 5 * 60 * 1000,
  })
}
