import { createFileRoute } from '@tanstack/react-router'

import { AdminAuditPage } from '@/workspaces/admin/pages/admin-audit-page'
import { loadAdminAuditRoute } from '@/routes/-admin-loaders'

export const Route = createFileRoute('/admin/audit/')({
  loader: loadAdminAuditRoute,
  component: AdminAuditPage,
})
