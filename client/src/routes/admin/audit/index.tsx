import { createFileRoute } from '@tanstack/react-router'

import { AdminAuditPage } from '@/features/admin/pages/admin-audit-page'
import { loadAdminAuditRoute } from '@/features/admin/utils/admin-route-loader'

export const Route = createFileRoute('/admin/audit/')({
  loader: loadAdminAuditRoute,
  component: AdminAuditPage,
})
