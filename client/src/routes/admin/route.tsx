import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'

import { AuthLoader } from '@/features/auth/components/auth-loader'
import { requireRole } from '@/features/auth/utils/auth-redirect'

export const Route = createFileRoute('/admin')({
  ssr: false,
  beforeLoad: async () => {
    const redirectPath = await requireRole('ADMIN')

    if (redirectPath) {
      throw redirect({ to: redirectPath })
    }
  },
  component: Outlet,
  pendingComponent: AuthLoader,
  pendingMs: 250,
  pendingMinMs: 900,
  head: () => ({
    meta: [{ title: 'Admin — Morshid' }],
  }),
})
