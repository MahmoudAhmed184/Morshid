import { createFileRoute } from '@tanstack/react-router'

import { loadAdminStudentsRoute } from '@/routes/-admin-loaders'
import { StudentsPage } from '@/workspaces/admin/users/users-page'

export const Route = createFileRoute('/admin/users/students')({
  loader: loadAdminStudentsRoute,
  component: StudentsPage,
})
