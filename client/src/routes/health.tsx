import { createFileRoute } from '@tanstack/react-router'

import { DevelopmentStatusPage } from '@/features/status/development-status-page'

export const Route = createFileRoute('/health')({
  component: DevelopmentStatusPage,
  head: () => ({
    meta: [{ title: 'Morshid Health' }],
  }),
})
