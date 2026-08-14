import { createFileRoute } from '@tanstack/react-router'

import { DevelopmentStatusPage } from '@/features/system-status/development-status-page'

export const Route = createFileRoute('/health')({
  component: DevelopmentStatusPage,
  head: () => ({
    meta: [{ title: 'Morshid Health' }],
  }),
})
