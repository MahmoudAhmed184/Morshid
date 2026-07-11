import { createFileRoute } from '@tanstack/react-router'

import { AdminAuditPage } from '@/features/admin/pages/admin-audit-page'

export const Route = createFileRoute('/admin/audit/')({
  component: AdminAuditPage,
})
