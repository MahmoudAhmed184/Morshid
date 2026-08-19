import { createFileRoute } from '@tanstack/react-router'

import { RouteLoadError } from '@/app/route-load-error'
import { createProtectedRoleRouteOptions } from '@/features/auth/routing/protected-role-route'
import { SuperAdminPageShell } from '@/workspaces/super-admin/components/super-admin-page-shell'

export const Route = createFileRoute('/super-admin')(
  createProtectedRoleRouteOptions(
    'SUPER_ADMIN',
    'Super Admin',
    SuperAdminPageShell,
    RouteLoadError,
  ),
)
