import { createFileRoute } from '@tanstack/react-router'

import { AdminCoursesPage } from '@/features/admin/pages/admin-courses-page'
import { loadAdminCoursesRoute } from '@/features/admin/utils/admin-route-loader'

export const Route = createFileRoute('/admin/courses/')({
  loader: loadAdminCoursesRoute,
  component: AdminCoursesPage,
})
