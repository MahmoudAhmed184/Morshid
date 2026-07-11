import { createFileRoute } from '@tanstack/react-router'

import { StudentDashboardPage } from '@/features/student/student-dashboard-page'

export const Route = createFileRoute('/student/dashboard')({
  component: StudentDashboardPage,
  head: () => ({
    meta: [{ title: 'Student Dashboard — Morshid' }],
  }),
})
