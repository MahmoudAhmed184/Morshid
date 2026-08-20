import { apiJson } from '@/features/auth/session/interface/authenticated-api-client'
import type { ApiFetchOptions } from '@/features/auth/session/interface/authenticated-api-client'
import { aiCapacityResponseSchema } from './ai-capacity.schema'
import type { AiCapacityResponse } from './ai-capacity.schema'

export async function getAdminAiCapacity(
  options: ApiFetchOptions = {},
): Promise<AiCapacityResponse> {
  const response = await apiJson<unknown>('/api/v1/admin/ai-capacity', {
    ...options,
    method: 'GET',
  })
  return aiCapacityResponseSchema.parse(response)
}
