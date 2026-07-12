import { createFileRoute } from '@tanstack/react-router'

import { AdminAssignmentsPage } from '@/features/admin/pages/admin-assignments-page'

export const Route = createFileRoute('/admin/assignments/')({
  component: AdminAssignmentsPage,
})
