import { createFileRoute } from '@tanstack/react-router'

import { AdminAssignmentsPage } from '@/workspaces/admin/pages/admin-assignments-page'
import { loadAdminAssignmentsRoute } from '@/routes/-admin-loaders'

export const Route = createFileRoute('/admin/assignments/')({
  loader: loadAdminAssignmentsRoute,
  component: AdminAssignmentsPage,
})
