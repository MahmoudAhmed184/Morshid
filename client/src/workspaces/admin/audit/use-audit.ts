import { useQuery } from '@tanstack/react-query'

import { auditQueryOptions } from '@/features/audit/audit.queries'
import type { GetAuditEventsParams } from '@/features/audit/audit.api'
import { useAuthStore } from '@/features/auth/session/interface/session-store'

export function useAudit(params: GetAuditEventsParams | number = 20) {
  const adminId = useAuthStore((state) => state.user?.id)
  return useQuery({
    ...auditQueryOptions(adminId ?? 'anonymous', params),
    enabled: adminId !== undefined,
  })
}
