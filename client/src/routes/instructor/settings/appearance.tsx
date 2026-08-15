import { createFileRoute } from '@tanstack/react-router'

import { AppearanceTabContent } from '@/features/account-settings/appearance-tab-content'

export const Route = createFileRoute('/instructor/settings/appearance')({
  component: AppearanceTabContent,
  head: () => ({
    meta: [{ title: 'Appearance Settings — Morshid' }],
  }),
})
