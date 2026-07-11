import { createFileRoute } from '@tanstack/react-router'

import { MyCoursesPage } from '@/features/instructor/my-courses-page'

export const Route = createFileRoute('/instructor/courses/')({
  component: MyCoursesPage,
})
