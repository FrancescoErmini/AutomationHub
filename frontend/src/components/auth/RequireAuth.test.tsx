import { act, cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

const signinRedirect = vi.fn()
let authState: {
  isLoading: boolean
  isAuthenticated: boolean
  activeNavigator?: string
  error?: Error
}

vi.mock('react-oidc-context', () => ({
  // The real provider hands out a fresh context object on every state change,
  // so useAuth() returning a new object each render mirrors production.
  useAuth: () => ({ ...authState, signinRedirect }),
}))

const { RequireAuth } = await import('./RequireAuth')

function renderGuard() {
  return render(
    <MemoryRouter>
      <RequireAuth />
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  signinRedirect.mockReset()
})

describe('RequireAuth', () => {
  it('redirects an unauthenticated visitor to sign-in once', async () => {
    signinRedirect.mockResolvedValue(undefined)
    authState = { isLoading: false, isAuthenticated: false }

    const { rerender } = renderGuard()

    // Simulate the provider churning its context value while the redirect settles.
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        authState = { ...authState }
        rerender(
          <MemoryRouter>
            <RequireAuth />
          </MemoryRouter>,
        )
      })
    }

    expect(signinRedirect).toHaveBeenCalledTimes(1)
    expect(signinRedirect).toHaveBeenCalledWith({ state: { returnTo: '/' } })
  })

  it('does not retry in a loop when the redirect fails, and surfaces the error', async () => {
    signinRedirect.mockRejectedValue(new Error('No authority configured'))
    authState = { isLoading: false, isAuthenticated: false }

    const { rerender } = renderGuard()

    await act(async () => {
      // The failed redirect ends up as an error on the context.
      authState = { isLoading: false, isAuthenticated: false, error: new Error('No authority configured') }
      rerender(
        <MemoryRouter>
          <RequireAuth />
        </MemoryRouter>,
      )
    })

    expect(signinRedirect).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/Sign-in failed: No authority configured/)).toBeInTheDocument()
  })

  it('renders protected content once authenticated', () => {
    authState = { isLoading: false, isAuthenticated: true }

    render(
      <MemoryRouter>
        <RequireAuth>
          <div>secret</div>
        </RequireAuth>
      </MemoryRouter>,
    )

    expect(screen.getByText('secret')).toBeInTheDocument()
    expect(signinRedirect).not.toHaveBeenCalled()
  })
})
