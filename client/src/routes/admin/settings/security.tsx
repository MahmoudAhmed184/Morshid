import { createFileRoute } from '@tanstack/react-router'

import { SettingsPlaceholderTab } from '@/workspaces/_shared/settings-shell'

export const Route = createFileRoute('/admin/settings/security')({
  component: () => (
    <SettingsPlaceholderTab
      title="Security"
      description="Manage system security policies and active session lifetimes."
    />
  ),
  head: () => ({
    meta: [{ title: 'Security Settings — Morshid' }],
  }),
})
