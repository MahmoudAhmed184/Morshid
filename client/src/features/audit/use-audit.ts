import { useQuery } from '@tanstack/react-query'

import { auditQueryOptions } from './audit.queries'
import { useAuthStore } from '@/features/auth/session/session.store'

export function useAudit(limit = 20) {
  const adminId = useAuthStore((state) => state.user?.id)
  return useQuery({
    ...auditQueryOptions(adminId ?? 'anonymous', limit),
    enabled: adminId !== undefined,
  })
}
