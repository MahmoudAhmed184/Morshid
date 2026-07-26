import { queryOptions } from '@tanstack/react-query'

import { getAdminAuditEvents } from './admin-audit.api'

export const adminAuditKeys = {
  all: (adminId: string) => ['admin', adminId, 'audit'] as const,
  list: (adminId: string, limit: number) =>
    [...adminAuditKeys.all(adminId), { limit }] as const,
}

export const adminAuditQueryOptions = (adminId: string, limit = 20) =>
  queryOptions({
    queryKey: adminAuditKeys.list(adminId, limit),
    queryFn: () => getAdminAuditEvents(limit),
  })
