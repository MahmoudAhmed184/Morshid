import { queryOptions } from '@tanstack/react-query'

import { getAdminAuditEvents } from './admin-audit.api'

export const adminAuditQueryOptions = (adminId: string, limit = 20) =>
  queryOptions({
    queryKey: ['admin', adminId, 'audit', { limit }] as const,
    queryFn: () => getAdminAuditEvents(limit),
  })
