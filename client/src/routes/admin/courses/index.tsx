import { createFileRoute } from '@tanstack/react-router'

import { AdminCoursesPage } from '@/workspaces/admin/pages/admin-courses-page'
import { loadAdminCoursesRoute } from '@/workspaces/admin/routing/admin-route-loader'

export const Route = createFileRoute('/admin/courses/')({
  loader: loadAdminCoursesRoute,
  component: AdminCoursesPage,
})
