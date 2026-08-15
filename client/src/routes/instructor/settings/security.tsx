import { createFileRoute } from '@tanstack/react-router'

import { SettingsPlaceholderTab } from '@/workspaces/_shared/settings-shell'

export const Route = createFileRoute('/instructor/settings/security')({
  component: () => (
    <SettingsPlaceholderTab
      title="Security"
      description="Manage your credentials and active sessions."
    />
  ),
  head: () => ({
    meta: [{ title: 'Security Settings — Morshid' }],
  }),
})
