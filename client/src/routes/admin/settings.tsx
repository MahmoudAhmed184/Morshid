import { createFileRoute } from '@tanstack/react-router'

import { DashboardSettingsPage } from '@/components/layout/dashboard-settings-page'

export const Route = createFileRoute('/admin/settings')({
  component: AdminSettingsPage,
})

function AdminSettingsPage() {
  return <DashboardSettingsPage roleName="Administrator" />
}
