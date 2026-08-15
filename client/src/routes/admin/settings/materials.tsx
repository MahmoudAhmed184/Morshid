import { createFileRoute } from '@tanstack/react-router'

import { SettingsPlaceholderTab } from '@/workspaces/_shared/settings-shell'

export const Route = createFileRoute('/admin/settings/materials')({
  component: () => (
    <SettingsPlaceholderTab
      title="Materials & data"
      description="Configure material upload limits and retention policies."
    />
  ),
  head: () => ({
    meta: [{ title: 'Materials & Data Settings — Morshid' }],
  }),
})
