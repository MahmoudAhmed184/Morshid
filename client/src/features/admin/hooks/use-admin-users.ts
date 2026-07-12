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
import { adminAuditKeys } from '@/features/admin/data/admin-audit.queries'
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
  const invalidateAdminData = () => {
    const currentAdminId = adminId ?? 'anonymous'
    return Promise.all([
      queryClient.invalidateQueries({
        queryKey: adminUsersQueryKey(currentAdminId),
      }),
      queryClient.invalidateQueries({
        queryKey: adminAuditKeys.all(currentAdminId),
      }),
    ])
  }

  const resetPassword = useMutation({
    mutationFn: ({
      userId,
      newPassword,
    }: {
      userId: string
      newPassword: string
    }) => resetAdminUserPassword(userId, newPassword),
    onSuccess: invalidateAdminData,
  })
  const createUser = useMutation({
    mutationFn: (input: CreateAdminUserInput) => createAdminUser(input),
    onSuccess: invalidateAdminData,
  })
  const disableUser = useMutation({
    mutationFn: (userId: string) => disableAdminUser(userId),
    onSuccess: invalidateAdminData,
  })
  const reactivateUser = useMutation({
    mutationFn: (userId: string) => reactivateAdminUser(userId),
    onSuccess: invalidateAdminData,
  })

  return {
    createUser,
    resetPassword,
    disableUser,
    reactivateUser,
  }
}
