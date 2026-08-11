import { createFileRoute } from '@tanstack/react-router'

import { UsersPage } from '@/workspaces/admin/users/users-page'
import { loadAdminUsersRoute } from '@/routes/-admin-loaders'

export const Route = createFileRoute('/admin/users/')({
  loader: loadAdminUsersRoute,
  component: UsersPage,
})
