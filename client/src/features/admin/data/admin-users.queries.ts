import { infiniteQueryOptions } from '@tanstack/react-query'

import { getAdminUsers } from './admin-users.api'

const adminUsersPageSize = 50

export function adminUsersQueryKey(adminId: string) {
  return ['admin', adminId, 'managed-users'] as const
}

export function adminUsersInfiniteQueryOptions(adminId: string) {
  return infiniteQueryOptions({
    queryKey: adminUsersQueryKey(adminId),
    queryFn: ({ pageParam }) =>
      getAdminUsers({ cursor: pageParam, limit: adminUsersPageSize }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  })
}
