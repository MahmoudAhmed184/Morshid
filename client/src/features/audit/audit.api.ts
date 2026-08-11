import { apiJson } from '@/features/auth/session/authenticated-api-client'
import type { ApiFetchOptions } from '@/features/auth/session/authenticated-api-client'
import { auditEventListResponseSchema } from './audit.schema'

export async function getAuditEvents(
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
  return auditEventListResponseSchema.parse(response).events
}
