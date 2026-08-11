import { createFileRoute } from '@tanstack/react-router'

import { InstructorDashboardShell } from '@/workspaces/instructor/dashboard/instructor-dashboard-shell'

export const Route = createFileRoute('/instructor/')({
  component: InstructorDashboardShell,
})
