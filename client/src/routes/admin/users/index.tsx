import { createFileRoute } from '@tanstack/react-router'

import { AdminUsersPage } from '@/features/admin/pages/admin-users-page'
import { loadAdminUsersRoute } from '@/features/admin/utils/admin-route-loader'

export const Route = createFileRoute('/admin/users/')({
  loader: loadAdminUsersRoute,
  component: AdminUsersPage,
})
