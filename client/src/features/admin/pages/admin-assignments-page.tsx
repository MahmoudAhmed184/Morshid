import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { DataTableState } from '@/components/ui/custom/data-table-state'
import { PageHeader } from '@/components/ui/custom/page-header'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AddCourseMemberDialog } from '@/features/admin/components/add-course-member-dialog'
import { AdminAssignmentsTable } from '@/features/admin/components/admin-assignments-table'
import { AdminPanel } from '@/features/admin/components/admin-panel'
import {
  useAdminCourseMembers,
  useAdminCourseMutations,
  useAdminCourses,
} from '@/features/admin/hooks/use-admin-courses'
import { useAdminUsers } from '@/features/admin/hooks/use-admin-users'

export function AdminAssignmentsPage() {
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const coursesQuery = useAdminCourses()
  const usersQuery = useAdminUsers()
  const courseId = selectedCourseId || coursesQuery.data?.[0]?.id
  const membersQuery = useAdminCourseMembers(courseId)
  const mutations = useAdminCourseMutations(courseId)
  const users = useMemo(
    () => usersQuery.data?.pages.flatMap((page) => page.users) ?? [],
    [usersQuery.data],
  )
  const assignedUserIds = useMemo(
    () => new Set(membersQuery.data?.map((member) => member.userId) ?? []),
    [membersQuery.data],
  )
  const isPending =
    mutations.addMember.isPending ||
    mutations.removeMember.isPending ||
    mutations.updateMemberRole.isPending
  const isLoading =
    coursesQuery.isPending ||
    usersQuery.isPending ||
    (courseId !== undefined && membersQuery.isPending)
  const isError =
    coursesQuery.isError || usersQuery.isError || membersQuery.isError

  const retry = async () => {
    await Promise.all([
      coursesQuery.refetch(),
      usersQuery.refetch(),
      membersQuery.refetch(),
    ])
  }

  return (
    <div>
      <PageHeader
        className="mb-8"
        eyebrow="Enrollment Operations"
        title="Course Assignments"
        description="Add, remove, and change student or instructor course assignments."
        actions={
          courseId ? (
            <div className="flex flex-wrap gap-2">
              {usersQuery.hasNextPage ? (
                <Button
                  variant="outline"
                  disabled={usersQuery.isFetchingNextPage}
                  onClick={() => void usersQuery.fetchNextPage()}
                >
                  {usersQuery.isFetchingNextPage
                    ? 'Loading users...'
                    : 'Load more users'}
                </Button>
              ) : null}
              <AddCourseMemberDialog
                users={users}
                assignedUserIds={assignedUserIds}
                isPending={mutations.addMember.isPending}
                onAdd={(input) => mutations.addMember.mutateAsync(input)}
              />
            </div>
          ) : null
        }
      />

      <AdminPanel>
        <div className="border-b p-4">
          <Select
            value={courseId ?? ''}
            onValueChange={(value) => setSelectedCourseId(value ?? '')}
          >
            <SelectTrigger className="w-full sm:w-96" aria-label="Course">
              <SelectValue placeholder="Choose a course" />
            </SelectTrigger>
            <SelectContent>
              {coursesQuery.data?.map((course) => (
                <SelectItem key={course.id} value={course.id}>
                  {course.code} — {course.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {mutations.updateMemberRole.error ? (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {mutations.updateMemberRole.error.message}
            </p>
          ) : null}
        </div>
        <DataTableState
          isLoading={isLoading}
          isError={isError}
          isEmpty={
            coursesQuery.data?.length === 0 || membersQuery.data?.length === 0
          }
          onRetry={() => void retry()}
          isRetrying={
            coursesQuery.isFetching ||
            usersQuery.isFetching ||
            membersQuery.isFetching
          }
          emptyTitle={
            coursesQuery.data?.length === 0
              ? 'No courses found'
              : 'No assignments found'
          }
          emptyDescription={
            coursesQuery.data?.length === 0
              ? 'Create a course before assigning users.'
              : 'Add the first user assignment to this course.'
          }
        >
          <AdminAssignmentsTable
            members={membersQuery.data ?? []}
            isPending={isPending}
            onRoleChange={(userId, role) =>
              mutations.updateMemberRole.mutate({ userId, role })
            }
            onRemove={(userId) => mutations.removeMember.mutateAsync(userId)}
          />
        </DataTableState>
      </AdminPanel>
    </div>
  )
}
