import { queryOptions } from '@tanstack/react-query'

import { getAuditEvents } from './audit.api'
import type { GetAuditEventsParams } from './audit.api'

export const auditKeys = {
  all: (adminId: string) => ['admin', adminId, 'audit'] as const,
  list: (adminId: string, params: GetAuditEventsParams | number = 20) =>
    [
      ...auditKeys.all(adminId),
      typeof params === 'number' ? { limit: params } : params,
    ] as const,
}

export const auditQueryOptions = (
  adminId: string,
  params: GetAuditEventsParams | number = 20,
) =>
  queryOptions({
    queryKey: auditKeys.list(adminId, params),
    queryFn: () => getAuditEvents(params),
  })
