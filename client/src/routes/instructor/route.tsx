import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'

import { AuthLoader } from '@/features/auth/components/auth-loader'
import { requireRole } from '@/features/auth/utils/auth-redirect'

export const Route = createFileRoute('/instructor')({
  ssr: false,
  beforeLoad: async () => {
    const redirectPath = await requireRole('INSTRUCTOR')

    if (redirectPath) {
      throw redirect({ to: redirectPath })
    }
  },
  component: Outlet,
  pendingComponent: AuthLoader,
  pendingMs: 200,
  pendingMinMs: 400,
  head: () => ({
    meta: [{ title: 'Instructor — Morshid' }],
  }),
})
