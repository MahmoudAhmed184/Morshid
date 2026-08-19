import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { DataTableState } from '@/components/ui/custom/data-table-state'
import { DataToolbar } from '@/components/ui/custom/data-toolbar'
import { LoadMoreButton } from '@/components/ui/custom/load-more-button'
import { PageHeader } from '@/components/ui/custom/page-header'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { useAuthStore } from '@/features/auth/session/interface/session-store'
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value'
import { AdminPanel } from '@/workspaces/admin/components/admin-panel'
import { useCourseAdministration } from '@/workspaces/admin/use-course-administration'
import { CreateUserDialog } from './create-user-dialog'
import { ImportUsersDialog } from './import-users-dialog'
import { useManagedUserMutations, useManagedUsers } from './use-user-management'
import { UsersTable } from './users-table'
import type { ManagedUser } from '@/features/user-management/managed-user.schema'

type DirectoryRole = Extract<ManagedUser['role'], 'STUDENT' | 'INSTRUCTOR'>
type StatusFilter = 'ALL' | 'ACTIVE' | 'DISABLED'

type UsersPageProps = {
  role: DirectoryRole
}

const directoryCopy = {
  STUDENT: {
    eyebrow: 'Student Accounts',
    title: 'Students',
    singular: 'Student',
    plural: 'students',
  },
  INSTRUCTOR: {
    eyebrow: 'Instructor Accounts',
    title: 'Instructors',
    singular: 'Instructor',
    plural: 'instructors',
  },
} as const

export function UsersPage({ role }: UsersPageProps) {
  const copy = directoryCopy[role]
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [courseId, setCourseId] = useState('ALL')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search.trim(), 250)
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(
    () => new Set(),
  )
  const currentUserId = useAuthStore((state) => state.user?.id)
  const usersQuery = useManagedUsers({
    role,
    ...(statusFilter === 'ALL' ? {} : { status: statusFilter }),
    ...(courseId === 'ALL' ? {} : { courseId }),
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
  })
  const coursesQuery = useCourseAdministration()
  const userMutations = useManagedUserMutations()
  const users = useMemo(
    () =>
      (usersQuery.data?.pages.flatMap((page) => page.users) ?? []).filter(
        (user) => user.id !== currentUserId && user.role === role,
      ),
    [currentUserId, role, usersQuery.data],
  )

  const isUpdatingStatus =
    userMutations.disableUser.isPending ||
    userMutations.reactivateUser.isPending
  const allLoadedSelected =
    users.length > 0 && users.every((user) => selectedUserIds.has(user.id))

  const setUserSelected = (userId: string, selected: boolean) => {
    setSelectedUserIds((current) => {
      const next = new Set(current)
      if (selected) next.add(userId)
      else next.delete(userId)
      return next
    })
  }

  const setAllLoadedSelected = (selected: boolean) => {
    setSelectedUserIds(
      selected ? new Set(users.map((user) => user.id)) : new Set(),
    )
  }

  const hasActiveFilters =
    statusFilter !== 'ALL' || courseId !== 'ALL' || Boolean(debouncedSearch)
  const isInitialEmpty = users.length === 0 && !hasActiveFilters

  return (
    <div>
      <PageHeader
        className="mb-5"
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={`Create ${copy.plural}, find accounts by name or email, filter by course, and manage account access.`}
      />

      <AdminPanel>
        <DataToolbar
          className="border-b px-4 py-3"
          search={search}
          onSearchChange={(value) => {
            setSearch(value)
            setSelectedUserIds(new Set())
          }}
          searchPlaceholder={`Search ${copy.plural}...`}
          filters={
            <div className="flex flex-row items-center gap-2 overflow-x-auto no-scrollbar">
              <Select
                value={courseId}
                onValueChange={(value) => {
                  if (!value) return
                  setCourseId(value)
                  setSelectedUserIds(new Set())
                }}
              >
                <SelectTrigger
                  className="h-9 w-auto min-w-[150px] max-w-[260px] rounded-lg border-border/80 px-2.5 text-xs"
                  aria-label={`Filter ${copy.plural} by course`}
                >
                  <span className="truncate">
                    {courseId === 'ALL'
                      ? 'All courses'
                      : (coursesQuery.data?.find(
                          (course) => course.id === courseId,
                        )?.title ?? 'Selected course')}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All courses</SelectItem>
                  {(coursesQuery.data ?? []).map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.code} — {course.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  if (!value) return
                  setStatusFilter(value)
                  setSelectedUserIds(new Set())
                }}
              >
                <SelectTrigger
                  className="h-9 w-auto min-w-[105px] rounded-lg border-border/80 px-2.5 text-xs"
                  aria-label={`Filter ${copy.plural} by status`}
                >
                  <span className="truncate">
                    {statusFilter === 'ALL'
                      ? 'All statuses'
                      : statusFilter === 'ACTIVE'
                        ? 'Active'
                        : 'Disabled'}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All statuses</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="DISABLED">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <ImportUsersDialog role={role} userLabel={copy.plural} />
              <CreateUserDialog role={role} userLabel={copy.singular} />
            </div>
          }
        />

        {users.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2 text-xs text-muted-foreground">
            <span>{selectedUserIds.size} selected</span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setAllLoadedSelected(!allLoadedSelected)}
            >
              {allLoadedSelected ? 'Unselect all' : 'Select all'}
            </Button>
          </div>
        ) : null}

        <DataTableState
          isLoading={usersQuery.isPending}
          isError={usersQuery.isError || coursesQuery.isError}
          isEmpty={users.length === 0}
          onRetry={() => {
            void usersQuery.refetch()
            void coursesQuery.refetch()
          }}
          isRetrying={usersQuery.isFetching || coursesQuery.isFetching}
          emptyTitle={
            isInitialEmpty
              ? `No ${copy.plural} found`
              : `No matching ${copy.plural}`
          }
          emptyDescription={
            isInitialEmpty
              ? `Create ${copy.plural} or import users to get started.`
              : `No ${copy.plural} match the selected search or filters.`
          }
        >
          <>
            <UsersTable
              users={users}
              selectedUserIds={selectedUserIds}
              isResettingPassword={userMutations.resetPassword.isPending}
              isUpdatingStatus={isUpdatingStatus}
              onSelectionChange={setUserSelected}
              onSelectAllChange={setAllLoadedSelected}
              onResetPassword={(userId, newPassword) =>
                userMutations.resetPassword.mutateAsync({ userId, newPassword })
              }
              onStatusChange={(user) =>
                user.status === 'DISABLED'
                  ? userMutations.reactivateUser.mutateAsync(user.id)
                  : userMutations.disableUser.mutateAsync(user.id)
              }
              onUpdateUser={(userId, values) =>
                userMutations.updateUser.mutateAsync({
                  userId,
                  input: {
                    displayName: values.name,
                    email: values.email,
                    role: values.role,
                  },
                })
              }
            />
            <LoadMoreButton
              hasNextPage={usersQuery.hasNextPage}
              isFetchingNextPage={usersQuery.isFetchingNextPage}
              onLoadMore={() => void usersQuery.fetchNextPage()}
              label={`Load more ${copy.plural}`}
            />
          </>
        </DataTableState>
      </AdminPanel>
    </div>
  )
}

export function StudentsPage() {
  return <UsersPage role="STUDENT" />
}

export function InstructorsPage() {
  return <UsersPage role="INSTRUCTOR" />
}
