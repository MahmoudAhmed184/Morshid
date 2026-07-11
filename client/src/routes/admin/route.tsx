import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'

import { AuthLoader } from '@/features/auth/components/auth-loader'
import { RouteLoadError } from '@/components/route-load-error'
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
  errorComponent: RouteLoadError,
  pendingComponent: AuthLoader,
  pendingMs: 200,
  pendingMinMs: 400,
  head: () => ({
    meta: [{ title: 'Admin — Morshid' }],
  }),
})
