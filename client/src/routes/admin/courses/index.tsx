import { createFileRoute } from '@tanstack/react-router'

import { AdminCoursesPage } from '@/features/admin/pages/admin-courses-page'

export const Route = createFileRoute('/admin/courses/')({
  component: AdminCoursesPage,
})
