import { createFileRoute } from '@tanstack/react-router'

import { InstructorDashboardPage } from '@/features/instructor/instructor-dashboard-page'

export const Route = createFileRoute('/instructor/')({
  component: InstructorDashboardPage,
})
