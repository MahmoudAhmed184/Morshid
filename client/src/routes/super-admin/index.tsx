import { createFileRoute } from '@tanstack/react-router'

import { SuperAdminOverviewPage } from '@/workspaces/super-admin/overview/super-admin-overview-page'

export const Route = createFileRoute('/super-admin/')({
  component: SuperAdminOverviewPage,
})
