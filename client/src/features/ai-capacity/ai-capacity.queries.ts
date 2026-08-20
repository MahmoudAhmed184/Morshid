import { queryOptions } from '@tanstack/react-query'
import { getAdminAiCapacity } from './ai-capacity.api'

export const aiCapacityKeys = {
  all: ['ai-capacity'] as const,
  admin: () => ['ai-capacity', 'admin'] as const,
}

export function adminAiCapacityQueryOptions() {
  return queryOptions({
    queryKey: aiCapacityKeys.admin(),
    queryFn: () => getAdminAiCapacity(),
    staleTime: 5_000,
  })
}
