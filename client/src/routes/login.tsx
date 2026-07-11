import { createFileRoute, redirect } from '@tanstack/react-router'

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
  head: () => ({
    meta: [{ title: 'Sign in — Morshid' }],
  }),
})
