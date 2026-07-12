import {
  infiniteQueryOptions,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'

import {
  createAdminUser,
  disableAdminUser,
  getAdminUsers,
  reactivateAdminUser,
  resetAdminUserPassword,
} from '@/features/admin/data/admin-users.api'
import type { CreateAdminUserInput } from '@/features/admin/data/admin-users.api'
import { useAuthStore } from '@/features/auth/stores/auth.store'

const adminUsersPageSize = 50

function adminUsersQueryKey(adminId: string) {
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

export function useAdminUsers() {
  const adminId = useAuthStore((state) => state.user?.id)

  return useInfiniteQuery({
    ...adminUsersInfiniteQueryOptions(adminId ?? 'anonymous'),
    enabled: adminId !== undefined,
  })
}

export function useAdminUserMutations() {
  const adminId = useAuthStore((state) => state.user?.id)
  const queryClient = useQueryClient()
  const invalidateUsers = () =>
    queryClient.invalidateQueries({
      queryKey: adminUsersQueryKey(adminId ?? 'anonymous'),
    })

  const resetPassword = useMutation({
    mutationFn: ({
      userId,
      newPassword,
    }: {
      userId: string
      newPassword: string
    }) => resetAdminUserPassword(userId, newPassword),
    onSuccess: invalidateUsers,
  })
  const createUser = useMutation({
    mutationFn: (input: CreateAdminUserInput) => createAdminUser(input),
    onSuccess: invalidateUsers,
  })
  const disableUser = useMutation({
    mutationFn: (userId: string) => disableAdminUser(userId),
    onSuccess: invalidateUsers,
  })
  const reactivateUser = useMutation({
    mutationFn: (userId: string) => reactivateAdminUser(userId),
    onSuccess: invalidateUsers,
  })

  return {
    createUser,
    resetPassword,
    disableUser,
    reactivateUser,
  }
}
