import { createFileRoute, redirect } from '@tanstack/react-router'

import { AuthLoader } from '@/features/auth/components/auth-loader'
import { SignInPage } from '@/features/auth/sign-in-page'
import { redirectAuthenticatedToDashboard } from '@/features/auth/utils/auth-redirect'

export const Route = createFileRoute('/login')({
  ssr: false,
  beforeLoad: async () => {
    const redirectPath = await redirectAuthenticatedToDashboard()

    if (redirectPath) {
      throw redirect({ to: redirectPath })
    }
  },
  component: SignInPage,
  pendingComponent: AuthLoader,
  pendingMs: 0,
  pendingMinMs: 400,
  head: () => ({
    meta: [{ title: 'Sign in — Morshid' }],
  }),
})
