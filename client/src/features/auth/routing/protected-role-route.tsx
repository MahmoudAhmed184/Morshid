import type { FC } from 'react'

import { Outlet, redirect } from '@tanstack/react-router'

import { RouteLoadError } from '@/components/route-load-error'
import { AuthLoader } from '@/features/auth/routing/auth-loader'
import type { AuthRole } from '@/features/auth/session/session.schema'
import { requireRole } from '@/features/auth/routing/auth-redirect'

export function createProtectedRoleRouteOptions(
  role: AuthRole,
  title: string,
  component: FC = Outlet,
) {
  return {
    ssr: false as const,
    beforeLoad: async () => {
      const redirectPath = await requireRole(role)

      if (redirectPath) {
        throw redirect({ to: redirectPath })
      }
    },
    component,
    errorComponent: RouteLoadError,
    pendingComponent: AuthLoader,
    pendingMs: 200,
    pendingMinMs: 400,
    head: () => ({ meta: [{ title: `${title} — Morshid` }] }),
  }
}
