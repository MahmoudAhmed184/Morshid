import { createFileRoute } from '@tanstack/react-router'

import { InstructorDashboardShell } from '@/features/instructor/components/instructor-dashboard-shell'

export const Route = createFileRoute('/instructor/')({
  component: InstructorDashboardShell,
})
