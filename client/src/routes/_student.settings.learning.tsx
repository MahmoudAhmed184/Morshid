import { createFileRoute } from '@tanstack/react-router'

import { LearningTabContent } from '@/features/account-settings/learning-tab-content'

export const Route = createFileRoute('/_student/settings/learning')({
  component: LearningTabContent,
  head: () => ({
    meta: [{ title: 'Learning Preferences — Morshid' }],
  }),
})
