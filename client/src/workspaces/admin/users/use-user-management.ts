import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'

import {
  createManagedUser,
  bulkCreateManagedUsers,
  disableManagedUser,
  reactivateManagedUser,
  resetManagedUserPassword,
  updateManagedUser,
  createUserImport,
  approveUserImport,
  updateUserImportRow,
  cancelUserImportRow,
} from '@/features/user-management/user-management.api'
import type {
  CreateManagedUserInput,
  ListManagedUsersInput,
  UpdateUserImportRowInput,
} from '@/features/user-management/user-management.api'
import { auditKeys } from '@/features/audit/audit.queries'
import {
  managedUsersInfiniteQueryOptions,
  managedUsersQueryKey,
} from '@/features/user-management/user-management.queries'
import { useAuthStore } from '@/features/auth/session/interface/session-store'

export function useManagedUsers(
  filters: Omit<ListManagedUsersInput, 'cursor' | 'limit'> = {},
  enabled = true,
) {
  const adminId = useAuthStore((state) => state.user?.id)

  return useInfiniteQuery({
    ...managedUsersInfiniteQueryOptions(adminId ?? 'anonymous', filters),
    enabled: adminId !== undefined && enabled,
  })
}

export function useManagedUserMutations() {
  const adminId = useAuthStore((state) => state.user?.id)
  const queryClient = useQueryClient()
  const invalidateUserManagementData = () => {
    const currentActorId = adminId ?? 'anonymous'
    return Promise.all([
      queryClient.invalidateQueries({
        queryKey: managedUsersQueryKey(currentActorId),
      }),
      queryClient.invalidateQueries({
        queryKey: auditKeys.all(currentActorId),
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
    }) => resetManagedUserPassword(userId, newPassword),
    onSuccess: invalidateUserManagementData,
  })
  const createUser = useMutation({
    mutationFn: (input: CreateManagedUserInput) => createManagedUser(input),
    onSuccess: invalidateUserManagementData,
  })
  const bulkCreateUsers = useMutation({
    mutationFn: (input: CreateManagedUserInput[]) =>
      bulkCreateManagedUsers(input),
    onSuccess: invalidateUserManagementData,
  })
  const stageUserImport = useMutation({ mutationFn: createUserImport })
  const approveImport = useMutation({
    mutationFn: approveUserImport,
    onSuccess: invalidateUserManagementData,
  })
  const editImportRow = useMutation({
    mutationFn: ({
      importId,
      rowId,
      input,
    }: {
      importId: string
      rowId: string
      input: UpdateUserImportRowInput
    }) => updateUserImportRow(importId, rowId, input),
  })
  const cancelImportRow = useMutation({
    mutationFn: ({ importId, rowId }: { importId: string; rowId: string }) =>
      cancelUserImportRow(importId, rowId),
  })
  const disableUser = useMutation({
    mutationFn: (userId: string) => disableManagedUser(userId),
    onSuccess: invalidateUserManagementData,
  })
  const reactivateUser = useMutation({
    mutationFn: (userId: string) => reactivateManagedUser(userId),
    onSuccess: invalidateUserManagementData,
  })
  const updateUser = useMutation({
    mutationFn: ({
      userId,
      input,
    }: {
      userId: string
      input: {
        email?: string
        displayName?: string
        role?: 'STUDENT' | 'INSTRUCTOR'
      }
    }) => updateManagedUser(userId, input),
    onSuccess: invalidateUserManagementData,
  })

  return {
    createUser,
    bulkCreateUsers,
    stageUserImport,
    approveImport,
    editImportRow,
    cancelImportRow,
    updateUser,
    resetPassword,
    disableUser,
    reactivateUser,
  }
}
