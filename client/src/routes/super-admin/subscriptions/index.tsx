import { createFileRoute } from '@tanstack/react-router'

import { SuperAdminSubscriptionsPage } from '@/workspaces/super-admin/subscriptions/super-admin-subscriptions-page'

export const Route = createFileRoute('/super-admin/subscriptions/')({
  component: SuperAdminSubscriptionsPage,
})
