import { infiniteQueryOptions } from '@tanstack/react-query'

import { getManagedUsers } from './user-management.api'

const managedUsersPageSize = 50

export function managedUsersQueryKey(adminId: string) {
  return ['admin', adminId, 'managed-users'] as const
}

export function managedUsersInfiniteQueryOptions(adminId: string) {
  return infiniteQueryOptions({
    queryKey: managedUsersQueryKey(adminId),
    queryFn: ({ pageParam }) =>
      getManagedUsers({ cursor: pageParam, limit: managedUsersPageSize }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  })
}
