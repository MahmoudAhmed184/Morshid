import { createFileRoute } from '@tanstack/react-router'

import { SettingsPlaceholderTab } from '@/workspaces/_shared/settings-shell'

export const Route = createFileRoute('/admin/settings/review-policy')({
  component: () => (
    <SettingsPlaceholderTab
      title="Review policy"
      description="Configure manual review limits and operational defaults."
    />
  ),
  head: () => ({
    meta: [{ title: 'Review Policy Settings — Morshid' }],
  }),
})
