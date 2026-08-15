import { createFileRoute } from '@tanstack/react-router'

import { SecurityTabContent } from '@/features/account-settings/security-tab-content'

export const Route = createFileRoute('/admin/settings/security')({
  component: SecurityTabContent,
  head: () => ({
    meta: [{ title: 'Security Settings — Morshid' }],
  }),
})
