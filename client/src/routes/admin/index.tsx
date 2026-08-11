import { createFileRoute } from '@tanstack/react-router'

import { AdminDashboardPage } from '@/workspaces/admin/pages/admin-dashboard-page'
import { loadAdminDashboardRoute } from '@/workspaces/admin/routing/admin-route-loader'

export const Route = createFileRoute('/admin/')({
  loader: loadAdminDashboardRoute,
  component: AdminDashboardPage,
})
