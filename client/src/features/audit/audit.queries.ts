import { queryOptions } from '@tanstack/react-query'

import { getAuditEvents } from './audit.api'

export const auditKeys = {
  all: (adminId: string) => ['admin', adminId, 'audit'] as const,
  list: (adminId: string, limit: number) =>
    [...auditKeys.all(adminId), { limit }] as const,
}

export const auditQueryOptions = (adminId: string, limit = 20) =>
  queryOptions({
    queryKey: auditKeys.list(adminId, limit),
    queryFn: () => getAuditEvents(limit),
  })
