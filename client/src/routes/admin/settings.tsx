import { createFileRoute } from '@tanstack/react-router'

import { AdminSettingsLayout } from '@/workspaces/admin/settings/admin-settings-layout'

export const Route = createFileRoute('/admin/settings')({
  component: AdminSettingsLayout,
  head: () => ({
    meta: [{ title: 'Settings — Morshid' }],
  }),
})
