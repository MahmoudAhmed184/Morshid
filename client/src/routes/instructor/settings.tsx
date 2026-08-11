import { createFileRoute } from '@tanstack/react-router'

import { AccountSettingsPage } from '@/features/account-settings/account-settings-page'

export const Route = createFileRoute('/instructor/settings')({
  component: AccountSettingsPage,
})
