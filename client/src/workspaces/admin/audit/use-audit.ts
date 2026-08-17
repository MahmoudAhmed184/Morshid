import { useQuery } from '@tanstack/react-query'

import { auditQueryOptions } from '@/features/audit/audit.queries'
import { useAuthStore } from '@/features/auth/session/interface/session-store'

export function useAudit(limit = 20) {
  const adminId = useAuthStore((state) => state.user?.id)
  return useQuery({
    ...auditQueryOptions(adminId ?? 'anonymous', limit),
    enabled: adminId !== undefined,
  })
}
