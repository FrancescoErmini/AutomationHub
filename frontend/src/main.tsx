import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from 'react-oidc-context'

import { App } from './App'
import { AuthBridge } from './auth/AuthBridge'
import { oidcConfig } from './auth/oidcConfig'
import './index.css'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider {...oidcConfig}>
      <QueryClientProvider client={queryClient}>
        <AuthBridge>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AuthBridge>
      </QueryClientProvider>
    </AuthProvider>
  </StrictMode>,
)
