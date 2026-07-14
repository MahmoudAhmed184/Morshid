import { createFileRoute } from '@tanstack/react-router'

import { AdminDashboardPage } from '@/features/admin/pages/admin-dashboard-page'
import { loadAdminDashboardRoute } from '@/features/admin/utils/admin-route-loader'

export const Route = createFileRoute('/admin/')({
  loader: loadAdminDashboardRoute,
  component: AdminDashboardPage,
})
