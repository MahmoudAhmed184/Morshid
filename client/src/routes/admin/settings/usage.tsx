import { createFileRoute } from '@tanstack/react-router'

import { SettingsPlaceholderTab } from '@/workspaces/_shared/settings-shell'

export const Route = createFileRoute('/admin/settings/usage')({
  component: () => (
    <SettingsPlaceholderTab
      title="Usage"
      description="Manage deployment and course tutoring allowances."
    />
  ),
  head: () => ({
    meta: [{ title: 'Usage Settings — Morshid' }],
  }),
})
