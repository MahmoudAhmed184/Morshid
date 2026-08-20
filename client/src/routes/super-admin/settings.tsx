import { createFileRoute } from '@tanstack/react-router'

import { SuperAdminSettingsLayout } from '@/workspaces/super-admin/settings/super-admin-settings-layout'

export const Route = createFileRoute('/super-admin/settings')({
  component: SuperAdminSettingsLayout,
  head: () => ({
    meta: [{ title: 'Settings — Morshid' }],
  }),
})
