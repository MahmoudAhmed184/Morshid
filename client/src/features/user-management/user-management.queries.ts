import { infiniteQueryOptions } from '@tanstack/react-query'

import { getManagedUsers } from './user-management.api'
import type { ListManagedUsersInput } from './user-management.api'

export const managedUsersPageSize = 10

export function managedUsersQueryKey(adminId: string) {
  return ['admin', adminId, 'managed-users'] as const
}

export function managedUsersInfiniteQueryOptions(
  adminId: string,
  filters: Omit<ListManagedUsersInput, 'cursor' | 'limit'> = {},
) {
  return infiniteQueryOptions({
    queryKey: [...managedUsersQueryKey(adminId), filters] as const,
    queryFn: ({ pageParam }) =>
      getManagedUsers({
        ...filters,
        cursor: pageParam,
        limit: managedUsersPageSize,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  })
}
