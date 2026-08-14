import { createFileRoute } from '@tanstack/react-router'

import { loadAdminInstructorsRoute } from '@/routes/-admin-loaders'
import { InstructorsPage } from '@/workspaces/admin/users/users-page'

export const Route = createFileRoute('/admin/users/instructors')({
  loader: loadAdminInstructorsRoute,
  component: InstructorsPage,
})
