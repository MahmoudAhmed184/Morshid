import { createFileRoute } from '@tanstack/react-router'

import { AdminAssignmentsPage } from '@/workspaces/admin/pages/admin-assignments-page'
import { loadAdminAssignmentsRoute } from '@/workspaces/admin/routing/admin-route-loader'

export const Route = createFileRoute('/admin/assignments/')({
  loader: loadAdminAssignmentsRoute,
  component: AdminAssignmentsPage,
})
