import { createFileRoute } from '@tanstack/react-router'

import { AdminPageShell } from '@/features/admin/components/admin-page-shell'
import { createProtectedRoleRouteOptions } from '@/features/auth/utils/protected-role-route'

export const Route = createFileRoute('/admin')(
  createProtectedRoleRouteOptions('ADMIN', 'Admin', AdminPageShell),
)
