import { queryOptions } from '@tanstack/react-query'

import { getUniversity, listUniversities } from './universities.api'
import type { ListUniversitiesInput } from './universities.api'

export const universitiesQueryKeys = {
  all: ['universities'] as const,
  lists: () => [...universitiesQueryKeys.all, 'list'] as const,
  list: (query: ListUniversitiesInput = {}) =>
    [...universitiesQueryKeys.lists(), query] as const,
  details: () => [...universitiesQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...universitiesQueryKeys.details(), id] as const,
}

export function universitiesQueryOptions(query: ListUniversitiesInput = {}) {
  return queryOptions({
    queryKey: universitiesQueryKeys.list(query),
    queryFn: ({ signal }) => listUniversities(query, { signal }),
  })
}

export function universityDetailQueryOptions(universityId: string) {
  return queryOptions({
    queryKey: universitiesQueryKeys.detail(universityId),
    queryFn: ({ signal }) => getUniversity(universityId, { signal }),
    enabled: Boolean(universityId),
  })
}
