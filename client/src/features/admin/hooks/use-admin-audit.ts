import { useQuery } from '@tanstack/react-query'

import { adminAuditQueryOptions } from '@/features/admin/data/admin-audit.queries'
import { useAuthStore } from '@/features/auth/stores/auth.store'

export function useAdminAudit(limit = 20) {
  const adminId = useAuthStore((state) => state.user?.id)
  return useQuery({
    ...adminAuditQueryOptions(adminId ?? 'anonymous', limit),
    enabled: adminId !== undefined,
  })
}
