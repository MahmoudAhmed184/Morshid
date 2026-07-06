import { createFileRoute } from '@tanstack/react-router'

import { SignInPage } from '@/features/auth/sign-in-page'

export const Route = createFileRoute('/login')({
  component: SignInPage,
  head: () => ({
    meta: [{ title: 'Sign in — Morshid' }],
  }),
})
