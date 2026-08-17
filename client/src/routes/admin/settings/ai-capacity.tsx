import { createFileRoute } from '@tanstack/react-router'

import { SettingsPlaceholderTab } from '@/workspaces/_shared/settings-shell'

export const Route = createFileRoute('/admin/settings/ai-capacity')({
  component: () => (
    <SettingsPlaceholderTab
      title="AI capacity"
      description="Monitor AI model quota, pool distribution, and health."
    />
  ),
  head: () => ({
    meta: [{ title: 'AI Capacity Settings — Morshid' }],
  }),
})
