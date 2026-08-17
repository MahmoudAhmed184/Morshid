import { createFileRoute } from '@tanstack/react-router'

import { AccountTabContent } from '@/features/account-settings/account-tab-content'

export const Route = createFileRoute('/instructor/settings/account')({
  component: AccountTabContent,
  head: () => ({
    meta: [{ title: 'Account Settings — Morshid' }],
  }),
})
