import { createFileRoute } from '@tanstack/react-router'

import { AdminSettingsPage } from '@/features/admin/pages/admin-settings-page'

export const Route = createFileRoute('/admin/settings')({
  component: AdminSettingsPage,
})
