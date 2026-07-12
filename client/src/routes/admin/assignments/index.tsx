import { createFileRoute } from '@tanstack/react-router'

import { AdminAssignmentsPage } from '@/features/admin/pages/admin-assignments-page'
import { loadAdminAssignmentsRoute } from '@/features/admin/utils/admin-route-loader'

export const Route = createFileRoute('/admin/assignments/')({
  loader: loadAdminAssignmentsRoute,
  component: AdminAssignmentsPage,
})
