import { GraduationCapIcon, UserCheckIcon } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BulkCourseAssignmentDialog } from '@/workspaces/admin/components/bulk-course-assignment-dialog'
import { AdminAssignmentsTable } from '@/workspaces/admin/components/admin-assignments-table'
import { AdminPanel } from '@/workspaces/admin/components/admin-panel'
import {
  useCourseMembers,
  useCourseAdministrationMutations,
  useCourseAdministration,
} from '@/workspaces/admin/use-course-administration'
import type { CourseMembershipRole } from '@/features/courses/course-administration.schema'
import { LoadMoreButton } from '@/components/ui/custom/load-more-button'
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value'

export function AdminAssignmentsPage() {
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [selectedRoleTab, setSelectedRoleTab] =
    useState<CourseMembershipRole>('STUDENT')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search.trim(), 250)

  const coursesQuery = useCourseAdministration()
  const courseId = selectedCourseId || coursesQuery.data?.[0]?.id
  const membersQuery = useCourseMembers(
    courseId,
    debouncedSearch,
    selectedRoleTab,
  )
  const mutations = useCourseAdministrationMutations(courseId)

  const courseSelectItems = useMemo(
    () =>
      coursesQuery.data?.map((course) => ({
        value: course.id,
        label: `${course.code} — ${course.title}`,
      })) ?? [],
    [coursesQuery.data],
  )

  const displayedMembers = useMemo(
    () =>
      (membersQuery.data ?? []).filter(
        (member) => member.role === selectedRoleTab,
      ),
    [membersQuery.data, selectedRoleTab],
  )
  const selectedCourse = coursesQuery.data?.find(
    (course) => course.id === courseId,
  )

  const isPending =
    mutations.addMember.isPending ||
    mutations.removeMember.isPending ||
    mutations.updateMemberRole.isPending

  const isLoading =
    coursesQuery.isPending || (courseId !== undefined && membersQuery.isPending)

  const isError = coursesQuery.isError || membersQuery.isError

  const retry = async () => {
    await Promise.all([coursesQuery.refetch(), membersQuery.refetch()])
  }

  const isCoursesEmpty = coursesQuery.data?.length === 0
  const isOverallEmpty = (selectedCourse?.adminMetadata.memberCount ?? 0) === 0
  const isTabEmpty = displayedMembers.length === 0

  const emptyTitle = isCoursesEmpty
    ? 'No courses found'
    : isOverallEmpty
      ? 'No assignments found'
      : search.trim()
        ? 'No matching members'
        : selectedRoleTab === 'STUDENT'
          ? 'No students assigned'
          : 'No doctors assigned'

  const emptyDescription = isCoursesEmpty
    ? 'Create a course before assigning users.'
    : isOverallEmpty
      ? 'Add the first user assignment to this course.'
      : search.trim()
        ? `No ${selectedRoleTab === 'STUDENT' ? 'students' : 'doctors'} match "${search}".`
        : selectedRoleTab === 'STUDENT'
          ? 'Add the first student to this course.'
          : 'Add the first doctor to this course.'

  return (
    <div>
      <PageHeader
        className="mb-8"
        eyebrow="Enrollment Operations"
        title="Course Assignments"
        description="Add, remove, and change student or instructor course assignments."
      />

      <AdminPanel>
        <DataToolbar
          className="border-b px-4 py-3"
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={
            selectedRoleTab === 'STUDENT'
              ? 'Search assigned students...'
              : 'Search assigned doctors...'
          }
          filters={
            <>
              <Tabs
                value={selectedRoleTab}
                onValueChange={(value) => {
                  setSelectedRoleTab(value as CourseMembershipRole)
                  setSearch('')
                }}
              >
                <TabsList className="h-9 p-1" aria-label="Assignment type">
                  <TabsTrigger value="STUDENT" className="gap-2 px-3">
                    <GraduationCapIcon className="size-4" />
                    Students
                    <Badge variant="secondary" className="h-4 min-w-5 px-1">
                      {selectedCourse?.adminMetadata.studentCount ?? 0}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="INSTRUCTOR" className="gap-2 px-3">
                    <UserCheckIcon className="size-4" />
                    Doctors
                    <Badge variant="secondary" className="h-4 min-w-5 px-1">
                      {selectedCourse?.adminMetadata.instructorCount ?? 0}
                    </Badge>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <Select
                value={courseId ?? null}
                onValueChange={(value) => setSelectedCourseId(value ?? '')}
                items={courseSelectItems}
              >
                <SelectTrigger
                  className="h-9 w-full max-w-full rounded-lg border-border/80 px-3 text-xs sm:w-80"
                  aria-label="Course"
                >
                  <SelectValue placeholder="Choose a course" />
                </SelectTrigger>
                <SelectContent>
                  {courseSelectItems.map((course) => (
                    <SelectItem
                      key={course.value}
                      value={course.value}
                      className="py-1.5 text-xs"
                    >
                      {course.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {coursesQuery.hasNextPage ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={coursesQuery.isFetchingNextPage}
                  onClick={() => void coursesQuery.fetchNextPage()}
                >
                  {coursesQuery.isFetchingNextPage
                    ? 'Loading…'
                    : 'More courses'}
                </Button>
              ) : null}
            </>
          }
          actions={
            <BulkCourseAssignmentDialog
              courses={coursesQuery.data ?? []}
              role={selectedRoleTab}
              isPending={mutations.addMembers.isPending}
              hasNextCoursePage={coursesQuery.hasNextPage}
              isLoadingMoreCourses={coursesQuery.isFetchingNextPage}
              onLoadMoreCourses={() => void coursesQuery.fetchNextPage()}
              onAssign={(input) => mutations.addMembers.mutateAsync(input)}
            />
          }
        />

        <div className="px-4">
          {mutations.updateMemberRole.error ? (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {mutations.updateMemberRole.error.message}
            </p>
          ) : null}
        </div>

        <DataTableState
          isLoading={isLoading}
          isError={isError}
          isEmpty={isCoursesEmpty || isTabEmpty}
          onRetry={() => void retry()}
          isRetrying={coursesQuery.isFetching || membersQuery.isFetching}
          emptyTitle={emptyTitle}
          emptyDescription={emptyDescription}
        >
          <AdminAssignmentsTable
            courseId={courseId}
            members={displayedMembers}
            isPending={isPending}
            onRoleChange={(userId, role) =>
              mutations.updateMemberRole.mutate({ userId, role })
            }
            onRemove={(userId) => mutations.removeMember.mutateAsync(userId)}
          />
          <LoadMoreButton
            hasNextPage={membersQuery.hasNextPage}
            isFetchingNextPage={membersQuery.isFetchingNextPage}
            onLoadMore={() => void membersQuery.fetchNextPage()}
            label="Load more assignments"
          />
        </DataTableState>
      </AdminPanel>
    </div>
  )
}
