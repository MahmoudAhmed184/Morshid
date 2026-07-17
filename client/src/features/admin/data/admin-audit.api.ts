import { apiJson } from '@/features/auth/api/authenticated-api-client'
import type { ApiFetchOptions } from '@/features/auth/api/authenticated-api-client'
import { adminAuditEventListResponseSchema } from '@/features/admin/schemas/admin-audit.schema'

export async function getAdminAuditEvents(
  limit = 20,
  options: ApiFetchOptions = {},
) {
  const response = await apiJson<unknown>(
    `/api/v1/admin/audit?limit=${limit}`,
    {
      ...options,
      method: 'GET',
    },
  )
  return adminAuditEventListResponseSchema.parse(response).events
}
