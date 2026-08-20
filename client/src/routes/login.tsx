import { createFileRoute, redirect, useHydrated } from '@tanstack/react-router'

import { AuthLoader } from '@/features/auth/routing/auth-loader'
import { RouteLoadError } from '@/app/route-load-error'
import { SignInPage } from '@/features/auth/sign-in/sign-in-page'
import { redirectAuthenticatedToDashboard } from '@/features/auth/routing/interface/auth-redirect'

export const Route = createFileRoute('/login')({
  ssr: false,
  beforeLoad: async () => {
    const redirectPath = await redirectAuthenticatedToDashboard()

    if (redirectPath) {
      throw redirect({ to: redirectPath })
    }
  },
  component: LoginRoute,
  errorComponent: RouteLoadError,
  pendingComponent: AuthLoader,
  pendingMs: 0,
  pendingMinMs: 400,
  head: () => ({
    meta: [{ title: 'Sign in — Morshid' }],
  }),
})

function LoginRoute() {
  const isHydrated = useHydrated()

  return isHydrated ? <SignInPage /> : <AuthLoader />
}
