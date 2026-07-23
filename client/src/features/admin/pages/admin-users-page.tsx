import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { DataTableState } from '@/components/ui/custom/data-table-state'
import { DataToolbar } from '@/components/ui/custom/data-toolbar'
import { PageHeader } from '@/components/ui/custom/page-header'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  useAdminUserMutations,
  useAdminUsers,
} from '@/features/admin/hooks/use-admin-users'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import { AdminPanel } from '../components/admin-panel'
import { AdminUsersTable } from '../components/admin-users-table'
import { CreateAdminUserDialog } from '../components/create-admin-user-dialog'

type RoleFilter = 'ALL' | 'STUDENT' | 'INSTRUCTOR'
type StatusFilter = 'ALL' | 'ACTIVE' | 'DISABLED'

export function AdminUsersPage() {
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const currentUserId = useAuthStore((state) => state.user?.id)
  const usersQuery = useAdminUsers()
  const userMutations = useAdminUserMutations()
  const users = useMemo(
    () =>
      (usersQuery.data?.pages.flatMap((page) => page.users) ?? []).filter(
        (user) => {
          if (user.id === currentUserId || user.role === 'ADMIN') {
            return false
          }

          if (roleFilter !== 'ALL' && user.role !== roleFilter) {
            return false
          }

          return statusFilter === 'ALL' || user.status === statusFilter
        },
      ),
    [currentUserId, roleFilter, statusFilter, usersQuery.data],
  )

  const isUpdatingStatus =
    userMutations.disableUser.isPending ||
    userMutations.reactivateUser.isPending

  return (
    <div>
      <PageHeader
        className="mb-8"
        eyebrow="Identity Operations"
        title="User Management"
        description="Create users, review core identity fields, disable or reactivate accounts, and reset passwords."
      />

      <AdminPanel>
        <DataToolbar
          className="border-b px-4 py-3"
          filters={
            <>
              <Select
                value={roleFilter}
                onValueChange={(value) => {
                  if (value) setRoleFilter(value)
                }}
              >
                <SelectTrigger aria-label="Filter users by role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All roles</SelectItem>
                  <SelectItem value="STUDENT">Students</SelectItem>
                  <SelectItem value="INSTRUCTOR">Instructors</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  if (value) setStatusFilter(value)
                }}
              >
                <SelectTrigger aria-label="Filter users by status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All statuses</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="DISABLED">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </>
          }
          actions={<CreateAdminUserDialog />}
        />
        <DataTableState
          isLoading={usersQuery.isPending}
          isError={usersQuery.isError}
          isEmpty={users.length === 0}
          onRetry={() => void usersQuery.refetch()}
          isRetrying={usersQuery.isFetching}
          emptyTitle="No users found"
          emptyDescription="No users match the selected filters."
        >
          <>
            <AdminUsersTable
              users={users}
              isResettingPassword={userMutations.resetPassword.isPending}
              isUpdatingStatus={isUpdatingStatus}
              onResetPassword={(userId, newPassword) =>
                userMutations.resetPassword.mutateAsync({
                  userId,
                  newPassword,
                })
              }
              onStatusChange={(user) =>
                user.status === 'DISABLED'
                  ? userMutations.reactivateUser.mutateAsync(user.id)
                  : userMutations.disableUser.mutateAsync(user.id)
              }
            />
            {usersQuery.hasNextPage ? (
              <div className="border-t p-4 text-center">
                <Button
                  variant="outline"
                  disabled={usersQuery.isFetchingNextPage}
                  onClick={() => void usersQuery.fetchNextPage()}
                >
                  {usersQuery.isFetchingNextPage ? 'Loading...' : 'Load more'}
                </Button>
              </div>
            ) : null}
          </>
        </DataTableState>
      </AdminPanel>
    </div>
  )
}
