import { createFileRoute } from '@tanstack/react-router'

import { SettingsPlaceholderTab } from '@/workspaces/_shared/settings-shell'

export const Route = createFileRoute('/instructor/settings/workspace')({
  component: () => (
    <SettingsPlaceholderTab
      title="Workspace"
      description="Manage course defaults and review queue filters."
    />
  ),
  head: () => ({
    meta: [{ title: 'Workspace Settings — Morshid' }],
  }),
})
