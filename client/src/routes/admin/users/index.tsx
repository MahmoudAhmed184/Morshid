import { createFileRoute } from '@tanstack/react-router'

import { UsersPage } from '@/workspaces/admin/users/users-page'
import { loadAdminUsersRoute } from '@/workspaces/admin/routing/admin-route-loader'

export const Route = createFileRoute('/admin/users/')({
  loader: loadAdminUsersRoute,
  component: UsersPage,
})
