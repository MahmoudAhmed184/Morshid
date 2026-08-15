import { createFileRoute } from '@tanstack/react-router'

import { SettingsPlaceholderTab } from '@/workspaces/_shared/settings-shell'

export const Route = createFileRoute('/_student/settings/learning')({
  component: () => (
    <SettingsPlaceholderTab
      title="Learning & language"
      description="Configure your learning preferences and explanation style."
    />
  ),
  head: () => ({
    meta: [{ title: 'Learning & Language Settings — Morshid' }],
  }),
})
