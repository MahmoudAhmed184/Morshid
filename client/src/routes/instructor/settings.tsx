import { createFileRoute } from '@tanstack/react-router'

import { DashboardSettingsPage } from '@/components/layout/dashboard-settings-page'

export const Route = createFileRoute('/instructor/settings')({
  component: InstructorSettingsPage,
})

function InstructorSettingsPage() {
  return <DashboardSettingsPage roleName="Instructor" />
}
