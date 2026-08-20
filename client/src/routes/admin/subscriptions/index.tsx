import { createFileRoute } from '@tanstack/react-router'

import { loadAdminSubscriptionsRoute } from '@/routes/-admin-loaders'
import { AdminSubscriptionsPage } from '@/workspaces/admin/subscriptions/admin-subscriptions-page'

export const Route = createFileRoute('/admin/subscriptions/')({
  loader: loadAdminSubscriptionsRoute,
  component: AdminSubscriptionsPage,
})
