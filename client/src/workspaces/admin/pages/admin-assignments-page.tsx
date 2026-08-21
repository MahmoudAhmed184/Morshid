import {
  GraduationCapIcon,
  SearchIcon,
  UserCheckIcon,
  UserMinusIcon,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/custom/confirm-dialog'
import { DataTableState } from '@/components/ui/custom/data-table-state'
import { DataToolbar } from '@/components/ui/custom/data-toolbar'
import { PageHeader } from '@/components/ui/custom/page-header'
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
import { getCourseMembers } from '@/features/courses/course-administration.api'
import { NumberedPagination } from '@/components/ui/custom/pagination'
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value'

type AssignmentUrlState = {
  courseId?: string
  role?: CourseMembershipRole
  search?: string
  page?: number
}

type AdminAssignmentsPageProps = {
  urlState?: AssignmentUrlState
  onUrlStateChange?: (state: AssignmentUrlState) => void
}

export function AdminAssignmentsPage({
  urlState = {},
  onUrlStateChange,
}: AdminAssignmentsPageProps) {
  const assignmentsPerPage = 10
  const [selectedCourseId, setSelectedCourseId] = useState(
    urlState.courseId ?? '',
  )
  const [selectedRoleTab, setSelectedRoleTab] = useState<CourseMembershipRole>(
    urlState.role ?? 'STUDENT',
  )
  const [search, setSearch] = useState(urlState.search ?? '')
  const [coursePickerSearch, setCoursePickerSearch] = useState('')
  const [isCoursePickerOpen, setIsCoursePickerOpen] = useState(false)
  const coursePickerRef = useRef<HTMLDivElement>(null)
  const coursePickerInputRef = useRef<HTMLInputElement>(null)
  const [assignmentPage, setAssignmentPage] = useState(urlState.page ?? 1)
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(
    new Set(),
  )
  const debouncedSearch = useDebouncedValue(search.trim(), 250)

  const coursesQuery = useCourseAdministration()
  const debouncedCoursePickerSearch = useDebouncedValue(
    coursePickerSearch.trim(),
    250,
  )
  const coursePickerQuery = useCourseAdministration(
    debouncedCoursePickerSearch,
    coursePickerSearch.trim().length > 0,
  )
  const courseId = selectedCourseId || coursesQuery.data?.[0]?.id
  const membersQuery = useCourseMembers(
    courseId,
    debouncedSearch,
    selectedRoleTab,
  )
  const mutations = useCourseAdministrationMutations(courseId)

  const pickerCourses = coursePickerSearch.trim()
    ? (coursePickerQuery.data ?? [])
    : (coursesQuery.data ?? [])

  const memberPages = membersQuery.data?.pages ?? []
  const assignedMembers = useMemo(
    () =>
      memberPages
        .flatMap((page) => page.members)
        .filter((member) => member.role === selectedRoleTab),
    [memberPages, selectedRoleTab],
  )
  const displayedMembers = assignedMembers.slice(
    (assignmentPage - 1) * assignmentsPerPage,
    assignmentPage * assignmentsPerPage,
  )
  const loadedAssignmentPages = memberPages.length
  const assignmentTotalCount =
    memberPages.at(-1)?.totalCount ?? assignedMembers.length
  const assignmentTotalPages = Math.max(
    1,
    Math.ceil(assignmentTotalCount / assignmentsPerPage),
  )

  const updateUrlState = (next: Partial<AssignmentUrlState>) => {
    onUrlStateChange?.({
      courseId,
      role: selectedRoleTab,
      search: search || undefined,
      page: assignmentPage,
      ...next,
    })
  }

  useEffect(() => {
    if (!selectedCourseId && courseId) {
      setSelectedCourseId(courseId)
      updateUrlState({ courseId })
    }
  }, [courseId, selectedCourseId])

  useEffect(() => {
    setAssignmentPage(1)
  }, [courseId, debouncedSearch, selectedRoleTab])

  useEffect(() => {
    if (
      assignmentPage > loadedAssignmentPages &&
      membersQuery.hasNextPage &&
      !membersQuery.isFetchingNextPage
    ) {
      void membersQuery.fetchNextPage()
    }
  }, [assignmentPage, loadedAssignmentPages, membersQuery])

  useEffect(() => {
    if (!isCoursePickerOpen) return

    const closeOnOutsideInteraction = (event: PointerEvent) => {
      if (!coursePickerRef.current?.contains(event.target as Node)) {
        setIsCoursePickerOpen(false)
      }
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsCoursePickerOpen(false)
        coursePickerInputRef.current?.blur()
      }
    }

    document.addEventListener('pointerdown', closeOnOutsideInteraction)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideInteraction)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isCoursePickerOpen])

  const selectedCourse = coursesQuery.data?.find(
    (course) => course.id === courseId,
  )

  const isPending =
    mutations.addMember.isPending ||
    mutations.removeMember.isPending ||
    mutations.updateMemberRole.isPending

  const isLoading =
    coursesQuery.isPending ||
    (courseId !== undefined &&
      (membersQuery.isPending || assignmentPage > loadedAssignmentPages))

  const isError = coursesQuery.isError || membersQuery.isError

  const retry = async () => {
    await Promise.all([coursesQuery.refetch(), membersQuery.refetch()])
  }

  const isCoursesEmpty = coursesQuery.data?.length === 0
  const isOverallEmpty = (selectedCourse?.adminMetadata.memberCount ?? 0) === 0
  const isTabEmpty = displayedMembers.length === 0
  const visibleStudentIds = displayedMembers.map((member) => member.userId)
  const removeStudents = async (userIds: string[]) => {
    await Promise.all(
      userIds.map((userId) => mutations.removeMember.mutateAsync(userId)),
    )
    setSelectedStudentIds(new Set())
  }
  const removeAllStudents = async () => {
    if (!courseId) return
    let cursor: string | undefined
    const userIds: string[] = []
    do {
      const page = await getCourseMembers(
        courseId,
        {},
        { cursor, role: 'STUDENT' },
      )
      userIds.push(...page.members.map((member) => member.userId))
      cursor = page.nextCursor
    } while (cursor)
    await removeStudents(userIds)
  }

  const emptyTitle = isCoursesEmpty
    ? 'No courses found'
    : isOverallEmpty
      ? 'No assignments found'
      : search.trim()
        ? 'No matching members'
        : selectedRoleTab === 'STUDENT'
          ? 'No students assigned'
          : 'No instructors assigned'

  const emptyDescription = isCoursesEmpty
    ? 'Create a course before assigning users.'
    : isOverallEmpty
      ? 'Add the first user assignment to this course.'
      : search.trim()
        ? `No ${selectedRoleTab === 'STUDENT' ? 'students' : 'instructors'} match "${search}".`
        : selectedRoleTab === 'STUDENT'
          ? 'Add the first student to this course.'
          : 'Add the first instructor to this course.'

  return (
    <div>
      <PageHeader
        className="mb-8"
        eyebrow="Enrollment Operations"
        title="Course Assignments"
        description="Add, remove, and change student or instructor course assignments."
      />

      <AdminPanel>
        <div className="border-b px-4 pt-4">
          <Tabs
            className="w-full sm:w-fit"
            value={selectedRoleTab}
            onValueChange={(value) => {
              setSelectedRoleTab(value as CourseMembershipRole)
              setSearch('')
              setAssignmentPage(1)
              updateUrlState({
                role: value as CourseMembershipRole,
                search: undefined,
                page: 1,
              })
            }}
          >
            <TabsList
              className="h-9 w-full p-1 sm:w-auto"
              aria-label="Assignment type"
            >
              <TabsTrigger
                value="STUDENT"
                className="min-w-0 flex-1 gap-2 px-3 sm:flex-none"
              >
                <GraduationCapIcon className="size-4" />
                Students
                <Badge variant="secondary" className="h-4 min-w-5 px-1">
                  {selectedCourse?.adminMetadata.studentCount ?? 0}
                </Badge>
              </TabsTrigger>
              <TabsTrigger
                value="INSTRUCTOR"
                className="min-w-0 flex-1 gap-2 px-3 sm:flex-none"
              >
                <UserCheckIcon className="size-4" />
                Instructors
                <Badge variant="secondary" className="h-4 min-w-5 px-1">
                  {selectedCourse?.adminMetadata.instructorCount ?? 0}
                </Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="grid gap-3 border-b px-4 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div ref={coursePickerRef} className="relative max-w-2xl">
            <label
              htmlFor="assignment-course-search"
              className="mb-1.5 block text-xs font-semibold text-foreground"
            >
              Select course
            </label>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="assignment-course-search"
                ref={coursePickerInputRef}
                aria-label="Course"
                value={coursePickerSearch}
                placeholder={
                  selectedCourse
                    ? `${selectedCourse.code} — ${selectedCourse.title}`
                    : 'Search courses by name or code...'
                }
                className="h-11 pl-9"
                onFocus={() => setIsCoursePickerOpen(true)}
                onChange={(event) => {
                  setCoursePickerSearch(event.target.value)
                  setIsCoursePickerOpen(true)
                }}
              />
            </div>
            {isCoursePickerOpen ? (
              <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg">
                {coursePickerSearch.trim() && coursePickerQuery.isPending ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground">
                    Loading courses…
                  </p>
                ) : pickerCourses.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground">
                    No courses match this search.
                  </p>
                ) : (
                  pickerCourses.map((course) => (
                    <button
                      key={course.id}
                      type="button"
                      className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => {
                        setSelectedCourseId(course.id)
                        setCoursePickerSearch('')
                        setIsCoursePickerOpen(false)
                        setSearch('')
                        setAssignmentPage(1)
                        updateUrlState({
                          courseId: course.id,
                          search: undefined,
                          page: 1,
                        })
                      }}
                    >
                      <span className="truncate">{course.title}</span>
                      <span className="ml-3 shrink-0 text-xs text-muted-foreground">
                        {course.code}
                      </span>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>
          <BulkCourseAssignmentDialog
            courses={coursesQuery.data ?? []}
            role={selectedRoleTab}
            defaultCourseId={courseId}
            isPending={mutations.addMembers.isPending}
            onAssign={(input) => mutations.addMembers.mutateAsync(input)}
            onAssigned={(courseId) => {
              setSelectedCourseId(courseId)
              setSearch('')
              setAssignmentPage(1)
              updateUrlState({ courseId, search: undefined, page: 1 })
            }}
          />
        </div>
        <DataToolbar
          className="border-b px-4 py-3"
          contentClassName="md:flex-row md:items-center"
          controlsClassName="md:flex md:flex-nowrap md:items-center"
          searchClassName="md:min-w-48 md:flex-1 md:max-w-none xl:max-w-none"
          actionsClassName="md:w-auto"
          search={search}
          onSearchChange={(value) => {
            setSearch(value)
            setAssignmentPage(1)
            updateUrlState({ search: value || undefined, page: 1 })
          }}
          searchPlaceholder={
            selectedRoleTab === 'STUDENT'
              ? 'Search assigned students...'
              : 'Search assigned instructors...'
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
          {selectedRoleTab === 'STUDENT' && displayedMembers.length > 0 ? (
            <div className="flex flex-wrap items-center justify-end gap-2 border-b bg-muted/15 px-4 py-2.5">
              <ConfirmDialog
                trigger={
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={selectedStudentIds.size === 0}
                  >
                    <UserMinusIcon /> Remove selected ({selectedStudentIds.size}
                    )
                  </Button>
                }
                title="Remove selected students?"
                description="These students will lose access to this course."
                confirmLabel="Remove selected"
                confirmInput={{ value: selectedCourse?.title ?? '' }}
                disabled={selectedStudentIds.size === 0 || isPending}
                onConfirm={() => removeStudents([...selectedStudentIds])}
              />
              <ConfirmDialog
                trigger={
                  <Button variant="destructive" size="sm">
                    <UserMinusIcon /> Remove all students
                  </Button>
                }
                title="Remove all students from this course?"
                description="Type the course name to remove every assigned student."
                confirmLabel="Remove all"
                confirmInput={{ value: selectedCourse?.title ?? '' }}
                disabled={!selectedCourse || isPending}
                onConfirm={async () => {
                  await removeAllStudents()
                }}
              />
            </div>
          ) : null}
          <AdminAssignmentsTable
            courseId={courseId}
            members={displayedMembers}
            isPending={isPending}
            onRoleChange={(userId, role) =>
              mutations.updateMemberRole.mutate({ userId, role })
            }
            onRemove={(userId) => mutations.removeMember.mutateAsync(userId)}
            selectedUserIds={selectedStudentIds}
            onSelectionChange={
              selectedRoleTab === 'STUDENT'
                ? (userId, selected) =>
                    setSelectedStudentIds((current) => {
                      const next = new Set(current)
                      if (selected) next.add(userId)
                      else next.delete(userId)
                      return next
                    })
                : undefined
            }
            onSelectPage={
              selectedRoleTab === 'STUDENT'
                ? (selected) =>
                    setSelectedStudentIds(
                      selected ? new Set(visibleStudentIds) : new Set(),
                    )
                : undefined
            }
          />
          {assignedMembers.length > 0 ? (
            <div className="border-t px-4 py-3">
              <NumberedPagination
                page={assignmentPage}
                totalPages={assignmentTotalPages}
                totalCount={assignmentTotalCount}
                limit={assignmentsPerPage}
                itemName="assignments"
                disabled={membersQuery.isFetchingNextPage}
                onPageChange={(page) => {
                  setAssignmentPage(page)
                  updateUrlState({ page })
                }}
              />
            </div>
          ) : null}
        </DataTableState>
      </AdminPanel>
    </div>
  )
}
