import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'

import {
  createAdminUser,
  disableAdminUser,
  reactivateAdminUser,
  resetAdminUserPassword,
} from '@/features/admin/data/admin-users.api'
import type { CreateAdminUserInput } from '@/features/admin/data/admin-users.api'
import {
  adminUsersInfiniteQueryOptions,
  adminUsersQueryKey,
} from '@/features/admin/data/admin-users.queries'
import { useAuthStore } from '@/features/auth/stores/auth.store'

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
