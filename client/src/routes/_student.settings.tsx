import { createFileRoute } from '@tanstack/react-router'

import { AccountSettingsPage } from '@/features/account-settings/account-settings-page'

export const Route = createFileRoute('/_student/settings')({
  component: AccountSettingsPage,
  head: () => ({
    meta: [{ title: 'Settings — Morshid' }],
  }),
})
