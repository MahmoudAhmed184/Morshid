import { createFileRoute } from '@tanstack/react-router'

import { SettingsPlaceholderTab } from '@/workspaces/_shared/settings-shell'

export const Route = createFileRoute('/_student/settings/usage')({
  component: () => (
    <SettingsPlaceholderTab
      title="Usage & reviews"
      description="Track your daily tutoring and review allowance."
    />
  ),
  head: () => ({
    meta: [{ title: 'Usage & Reviews Settings — Morshid' }],
  }),
})
