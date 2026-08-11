import { createFileRoute } from '@tanstack/react-router'

import { AdminAuditPage } from '@/workspaces/admin/pages/admin-audit-page'
import { loadAdminAuditRoute } from '@/workspaces/admin/routing/admin-route-loader'

export const Route = createFileRoute('/admin/audit/')({
  loader: loadAdminAuditRoute,
  component: AdminAuditPage,
})
