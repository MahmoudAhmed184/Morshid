import { createFileRoute } from '@tanstack/react-router'

import { DashboardSettingsPage } from '@/components/layout/dashboard-settings-page'

export const Route = createFileRoute('/student/settings')({
  component: StudentSettingsPage,
})

function StudentSettingsPage() {
  return <DashboardSettingsPage roleName="Student" />
}
