import { createFileRoute } from '@tanstack/react-router'

import { AccountTabContent } from '@/features/account-settings/account-tab-content'

export const Route = createFileRoute('/super-admin/settings/account')({
  component: AccountTabContent,
  head: () => ({
    meta: [{ title: 'Account Settings — Morshid' }],
  }),
})
