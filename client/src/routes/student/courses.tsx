import { createFileRoute } from '@tanstack/react-router'

import { StudentCoursesPage } from '@/features/student/pages/student-courses-page'

export const Route = createFileRoute('/student/courses')({
  component: StudentCoursesPage,
  head: () => ({
    meta: [{ title: 'Courses — Morshid' }],
  }),
})
