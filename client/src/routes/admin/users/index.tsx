import { createFileRoute } from '@tanstack/react-router'

import { UsersPage } from '@/workspaces/admin/users/users-page'
import { loadAdminUsersRoute } from '@/features/admin/utils/admin-route-loader'

export const Route = createFileRoute('/admin/users/')({
  loader: loadAdminUsersRoute,
  component: UsersPage,
})
