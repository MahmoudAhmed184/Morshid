import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BookCheckIcon,
  CheckIcon,
  FileSpreadsheetIcon,
  Loader2Icon,
  SearchIcon,
  UserPlusIcon,
  XIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { NumberedPagination } from '@/components/ui/custom/pagination'
import type {
  CourseAdministration,
  CourseMembershipRole,
  ResolvedCourseMember,
} from '@/features/courses/course-administration.schema'
import { getManagedUsers } from '@/features/user-management/user-management.api'
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value'
import { managedUsersPageSize } from '@/features/user-management/user-management.queries'
import { cn } from '@/lib/utils'
import { useManagedUsers } from '@/workspaces/admin/users/use-user-management'
import { useCourseAdministration } from '@/workspaces/admin/use-course-administration'

import { BulkUserImportDialog } from './bulk-user-import-dialog'

type AssignmentStep = 'courses' | 'users'

type BulkCourseAssignmentDialogProps = {
  courses: CourseAdministration[]
  role: CourseMembershipRole
  defaultCourseId?: string
  isPending: boolean
  onAssign: (input: {
    courseIds: string[]
    userIds: string[]
    role: CourseMembershipRole
  }) => Promise<unknown>
  onAssigned?: (courseId: string) => void
}

type UserItem = {
  id: string
  displayName: string
  email: string
}

export function BulkCourseAssignmentDialog({
  courses,
  role,
  defaultCourseId,
  isPending,
  onAssign,
  onAssigned,
}: BulkCourseAssignmentDialogProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<AssignmentStep>('courses')
  const [courseSearch, setCourseSearch] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [userPage, setUserPage] = useState(1)
  const [userViewMode, setUserViewMode] = useState<'all' | 'selected'>('all')
  const [bulkImportOpen, setBulkImportOpen] = useState(false)
  const [selectedCourseIds, setSelectedCourseIds] = useState<Set<string>>(() =>
    defaultCourseId ? new Set([defaultCourseId]) : new Set(),
  )
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set())
  const [knownUsers, setKnownUsers] = useState<Map<string, UserItem>>(new Map())
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSelectingAllUsers, setIsSelectingAllUsers] = useState(false)

  const debouncedUserSearch = useDebouncedValue(userSearch.trim(), 250)
  const debouncedCourseSearch = useDebouncedValue(courseSearch.trim(), 250)
  const dialogCoursesQuery = useCourseAdministration(
    debouncedCourseSearch,
    open && step === 'courses',
  )
  const usersQuery = useManagedUsers(
    {
      role,
      status: 'ACTIVE',
      excludeCourseIds: [...selectedCourseIds],
      search: debouncedUserSearch || undefined,
    },
    open && step === 'users' && userViewMode === 'all',
  )
  const paginatedUsers = useMemo(
    () => usersQuery.data?.pages.flatMap((page) => page.users) ?? [],
    [usersQuery.data],
  )
  const userPages = usersQuery.data?.pages ?? []
  const currentPageUsers = userPages[userPage - 1]?.users ?? []
  const totalUserCount = userPages.at(-1)?.totalCount ?? paginatedUsers.length
  const totalUserPages = Math.max(
    1,
    Math.ceil(totalUserCount / managedUsersPageSize),
  )

  useEffect(() => {
    if (
      open &&
      step === 'users' &&
      userViewMode === 'all' &&
      userPage > userPages.length &&
      usersQuery.hasNextPage &&
      !usersQuery.isFetchingNextPage
    ) {
      void usersQuery.fetchNextPage()
    }
  }, [open, step, userPage, userPages.length, userViewMode, usersQuery])

  const dialogCourses = useMemo(() => {
    const coursesById = new Map(
      courses
        .filter((course) => selectedCourseIds.has(course.id))
        .map((course) => [course.id, course]),
    )

    for (const course of dialogCoursesQuery.data ?? []) {
      coursesById.set(course.id, course)
    }

    return [...coursesById.values()]
  }, [courses, dialogCoursesQuery.data, selectedCourseIds])

  const userLabel = role === 'STUDENT' ? 'students' : 'instructors'
  const maxUserSelections = Math.floor(
    1_000 / Math.max(selectedCourseIds.size, 1),
  )

  const selectedUsersList = useMemo(() => {
    const list: UserItem[] = []
    for (const id of selectedUserIds) {
      const known =
        knownUsers.get(id) ?? paginatedUsers.find((u) => u.id === id)
      if (known) {
        list.push(known)
      } else {
        list.push({ id, displayName: id, email: id })
      }
    }
    const query = userSearch.trim().toLowerCase()
    if (!query) return list
    return list.filter(
      (u) =>
        u.displayName.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query),
    )
  }, [selectedUserIds, knownUsers, paginatedUsers, userSearch])

  const displayedUsers =
    userViewMode === 'selected' ? selectedUsersList : currentPageUsers

  const allVisibleCoursesSelected =
    dialogCourses.length > 0 &&
    dialogCourses.every((course) => selectedCourseIds.has(course.id))

  const allVisibleUsersSelected =
    displayedUsers.length > 0 &&
    displayedUsers.every((user) => selectedUserIds.has(user.id))

  const reset = () => {
    setStep('courses')
    setCourseSearch('')
    setUserSearch('')
    setUserPage(1)
    setUserViewMode('all')
    setSelectedCourseIds(
      defaultCourseId ? new Set([defaultCourseId]) : new Set(),
    )
    setSelectedUserIds(new Set())
    setKnownUsers(new Map())
    setErrorMessage(null)
    setBulkImportOpen(false)
  }

  const setDialogOpen = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) reset()
  }

  const toggleCourse = (courseId: string) => {
    setUserPage(1)
    setSelectedCourseIds((current) => {
      const next = new Set(current)
      if (next.has(courseId)) next.delete(courseId)
      else if (next.size < 50) next.add(courseId)
      return next
    })
  }

  const toggleVisibleCourses = () => {
    setUserPage(1)
    setSelectedCourseIds((current) => {
      const next = new Set(current)
      if (allVisibleCoursesSelected) {
        for (const course of dialogCourses) next.delete(course.id)
      } else {
        for (const course of dialogCourses) {
          if (next.size >= 50) break
          next.add(course.id)
        }
      }
      return next
    })
  }

  const toggleUser = (userId: string) => {
    setSelectedUserIds((current) => {
      const next = new Set(current)
      if (next.has(userId)) next.delete(userId)
      else if (next.size < maxUserSelections) next.add(userId)
      return next
    })
  }

  const toggleVisibleUsers = () => {
    setSelectedUserIds((current) => {
      const next = new Set(current)
      if (allVisibleUsersSelected) {
        for (const user of displayedUsers) next.delete(user.id)
      } else {
        for (const user of displayedUsers) {
          if (next.size >= maxUserSelections) break
          next.add(user.id)
        }
      }
      return next
    })
  }

  const toggleAllUsers = async () => {
    if (selectedUserIds.size >= Math.min(totalUserCount, maxUserSelections)) {
      setSelectedUserIds(new Set())
      return
    }

    try {
      setErrorMessage(null)
      setIsSelectingAllUsers(true)
      const users: UserItem[] = []
      let cursor: string | undefined

      do {
        const page = await getManagedUsers({
          cursor,
          limit: 100,
          role,
          status: 'ACTIVE',
          excludeCourseIds: [...selectedCourseIds],
          search: debouncedUserSearch || undefined,
        })
        users.push(
          ...page.users.map((user) => ({
            id: user.id,
            displayName: user.displayName,
            email: user.email,
          })),
        )
        cursor = page.nextCursor
      } while (cursor && users.length < maxUserSelections)

      setKnownUsers((current) => {
        const next = new Map(current)
        for (const user of users) next.set(user.id, user)
        return next
      })
      setSelectedUserIds(
        new Set(users.slice(0, maxUserSelections).map((user) => user.id)),
      )
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to select all users.',
      )
    } finally {
      setIsSelectingAllUsers(false)
    }
  }

  const handleApplyBulkImport = (resolvedUsers: ResolvedCourseMember[]) => {
    setKnownUsers((prev) => {
      const next = new Map(prev)
      for (const u of resolvedUsers) {
        next.set(u.id, {
          id: u.id,
          displayName: u.displayName,
          email: u.email,
        })
      }
      return next
    })

    setSelectedUserIds((prev) => {
      const next = new Set(prev)
      for (const u of resolvedUsers) {
        if (next.size >= maxUserSelections) break
        next.add(u.id)
      }
      return next
    })

    setUserViewMode('selected')
  }

  const handleAssign = async () => {
    if (selectedCourseIds.size === 0 || selectedUserIds.size === 0) return
    try {
      setErrorMessage(null)
      const courseIds = [...selectedCourseIds]
      await onAssign({
        courseIds,
        userIds: [...selectedUserIds],
        role,
      })
      const mostRecentlySelectedCourseId = courseIds.at(-1)
      if (mostRecentlySelectedCourseId) {
        onAssigned?.(mostRecentlySelectedCourseId)
      }
      setDialogOpen(false)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to assign users.',
      )
    }
  }

  const goToUsers = () => {
    setSelectedUserIds(
      (current) => new Set([...current].slice(0, maxUserSelections)),
    )
    setStep('users')
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setDialogOpen}>
        <DialogTrigger render={<Button disabled={courses.length === 0} />}>
          <BookCheckIcon className="size-4" />
          Assign {userLabel}
        </DialogTrigger>
        <DialogContent className="flex h-[min(98vh,900px)] w-[min(97vw,1120px)] max-h-[calc(100dvh-0.5rem)] max-w-none flex-col gap-2 overflow-hidden p-3 sm:max-h-[calc(100dvh-0.5rem)] sm:max-w-none sm:p-4">
          <DialogHeader className="shrink-0 pr-10">
            <DialogTitle>Assign {userLabel} to courses</DialogTitle>
            <DialogDescription>
              Choose courses first, then choose the {userLabel} to add to all of
              them. People already assigned to any selected course are hidden.
            </DialogDescription>
          </DialogHeader>

          <AssignmentSteps step={step} role={role} />

          {errorMessage ? (
            <p role="alert" className="shrink-0 text-sm text-destructive">
              {errorMessage}
            </p>
          ) : null}

          <div className="min-h-0 flex-1 overflow-hidden rounded-xl border bg-muted/15">
            {step === 'courses' ? (
              <CourseSelectionStep
                courses={dialogCourses}
                search={courseSearch}
                selectedCourseIds={selectedCourseIds}
                allVisibleSelected={allVisibleCoursesSelected}
                onSearchChange={setCourseSearch}
                onToggleCourse={toggleCourse}
                onToggleAll={toggleVisibleCourses}
                hasNextPage={dialogCoursesQuery.hasNextPage}
                isLoadingMore={dialogCoursesQuery.isFetchingNextPage}
                onLoadMore={() => void dialogCoursesQuery.fetchNextPage()}
              />
            ) : (
              <UserSelectionStep
                users={displayedUsers}
                role={role}
                search={userSearch}
                viewMode={userViewMode}
                selectedUserIds={selectedUserIds}
                allVisibleSelected={allVisibleUsersSelected}
                maxSelections={maxUserSelections}
                isLoading={
                  userViewMode === 'all' &&
                  (usersQuery.isPending || userPage > userPages.length)
                }
                isError={usersQuery.isError && userViewMode === 'all'}
                page={userPage}
                totalPages={totalUserPages}
                totalCount={totalUserCount}
                isChangingPage={
                  usersQuery.isFetchingNextPage && userViewMode === 'all'
                }
                onViewModeChange={setUserViewMode}
                onSearchChange={(value) => {
                  setUserSearch(value)
                  setUserPage(1)
                }}
                onToggleUser={toggleUser}
                onToggleAll={toggleVisibleUsers}
                onToggleAllUsers={() => void toggleAllUsers()}
                onOpenBulkImport={() => setBulkImportOpen(true)}
                onPageChange={setUserPage}
                onRetry={() => void usersQuery.refetch()}
                isSelectingAllUsers={isSelectingAllUsers}
              />
            )}
          </div>

          <DialogFooter className="shrink-0 items-center border-t pt-2 sm:justify-between">
            <p className="mr-auto text-xs text-muted-foreground">
              {selectedCourseIds.size} course
              {selectedCourseIds.size === 1 ? '' : 's'} · {selectedUserIds.size}{' '}
              {userLabel} ·{' '}
              {(selectedCourseIds.size * selectedUserIds.size).toLocaleString()}{' '}
              assignments
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            {step === 'users' ? (
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => setStep('courses')}
              >
                <ArrowLeftIcon /> Back
              </Button>
            ) : null}
            {step === 'courses' ? (
              <Button
                type="button"
                disabled={selectedCourseIds.size === 0}
                onClick={goToUsers}
              >
                Choose {userLabel} <ArrowRightIcon />
              </Button>
            ) : (
              <Button
                type="button"
                disabled={
                  selectedUserIds.size === 0 ||
                  selectedCourseIds.size * selectedUserIds.size > 1_000 ||
                  isPending
                }
                onClick={() => void handleAssign()}
              >
                {isPending ? (
                  <Loader2Icon className="animate-spin" />
                ) : (
                  <UserPlusIcon />
                )}
                Assign {selectedUserIds.size || ''} {userLabel}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BulkUserImportDialog
        open={bulkImportOpen}
        onOpenChange={setBulkImportOpen}
        role={role}
        selectedCourseIds={selectedCourseIds}
        courses={courses}
        maxUserSelections={maxUserSelections}
        currentSelectedCount={selectedUserIds.size}
        onApply={handleApplyBulkImport}
      />
    </>
  )
}

function AssignmentSteps({
  step,
  role,
}: {
  step: AssignmentStep
  role: CourseMembershipRole
}) {
  const userLabel = role === 'STUDENT' ? 'Students' : 'Instructors'
  return (
    <ol
      className="grid shrink-0 grid-cols-2 gap-2"
      aria-label="Assignment steps"
    >
      {[
        { id: 'courses' as const, number: 1, label: 'Choose courses' },
        { id: 'users' as const, number: 2, label: `Choose ${userLabel}` },
      ].map((item) => {
        const active = step === item.id
        const complete = step === 'users' && item.id === 'courses'
        return (
          <li
            key={item.id}
            className={cn(
              'flex items-center gap-3 rounded-lg border px-3 py-2 text-sm',
              active && 'border-primary bg-primary/5 text-foreground',
              !active && 'text-muted-foreground',
            )}
            aria-current={active ? 'step' : undefined}
          >
            <span
              className={cn(
                'flex size-6 items-center justify-center rounded-full bg-muted text-xs font-semibold',
                (active || complete) && 'bg-primary text-primary-foreground',
              )}
            >
              {complete ? <CheckIcon className="size-3.5" /> : item.number}
            </span>
            {item.label}
          </li>
        )
      })}
    </ol>
  )
}

type CourseSelectionStepProps = {
  courses: CourseAdministration[]
  search: string
  selectedCourseIds: Set<string>
  allVisibleSelected: boolean
  onSearchChange: (value: string) => void
  onToggleCourse: (courseId: string) => void
  onToggleAll: () => void
  hasNextPage: boolean
  isLoadingMore: boolean
  onLoadMore?: () => void
}

function CourseSelectionStep({
  courses,
  search,
  selectedCourseIds,
  allVisibleSelected,
  onSearchChange,
  onToggleCourse,
  onToggleAll,
  hasNextPage,
  isLoadingMore,
  onLoadMore,
}: CourseSelectionStepProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <SelectionHeader
        title="Courses"
        selectedCount={selectedCourseIds.size}
        search={search}
        searchPlaceholder="Search by course title or code..."
        allVisibleSelected={allVisibleSelected}
        hasItems={courses.length > 0}
        onSearchChange={onSearchChange}
        onToggleAll={onToggleAll}
      />
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {courses.length === 0 ? (
          <SelectionEmpty message="No courses match this search." />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <SelectionCard
                key={course.id}
                checked={selectedCourseIds.has(course.id)}
                title={course.title}
                description={course.code}
                onToggle={() => onToggleCourse(course.id)}
              />
            ))}
          </div>
        )}
      </div>
      {hasNextPage && onLoadMore ? (
        <div className="shrink-0 border-t p-3 text-center">
          <Button
            type="button"
            variant="outline"
            disabled={isLoadingMore}
            onClick={onLoadMore}
          >
            {isLoadingMore ? 'Loading…' : 'Load more courses'}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

type UserSelectionStepProps = {
  users: UserItem[]
  role: CourseMembershipRole
  search: string
  viewMode: 'all' | 'selected'
  selectedUserIds: Set<string>
  allVisibleSelected: boolean
  maxSelections: number
  isLoading: boolean
  isError: boolean
  page: number
  totalPages: number
  totalCount: number
  isChangingPage: boolean
  onViewModeChange: (mode: 'all' | 'selected') => void
  onSearchChange: (value: string) => void
  onToggleUser: (userId: string) => void
  onToggleAll: () => void
  onToggleAllUsers: () => void
  onOpenBulkImport: () => void
  onPageChange: (page: number) => void
  onRetry: () => void
  isSelectingAllUsers: boolean
}

function UserSelectionStep({
  users,
  role,
  search,
  viewMode,
  selectedUserIds,
  allVisibleSelected,
  maxSelections,
  isLoading,
  isError,
  page,
  totalPages,
  totalCount,
  isChangingPage,
  onViewModeChange,
  onSearchChange,
  onToggleUser,
  onToggleAll,
  onToggleAllUsers,
  onOpenBulkImport,
  onPageChange,
  onRetry,
  isSelectingAllUsers,
}: UserSelectionStepProps) {
  const userLabel = role === 'STUDENT' ? 'Students' : 'Instructors'
  const selectableUserCount = Math.min(totalCount, maxSelections)
  const allUsersSelected =
    selectableUserCount > 0 && selectedUserIds.size >= selectableUserCount
  return (
    <div className="flex h-full min-h-0 flex-col">
      <SelectionHeader
        title={userLabel}
        selectedCount={selectedUserIds.size}
        search={search}
        searchPlaceholder={`Search ${userLabel.toLowerCase()} by name or email...`}
        allVisibleSelected={allVisibleSelected}
        hasItems={users.length > 0}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        onSearchChange={onSearchChange}
        onToggleAll={onToggleAll}
        onToggleAllUsers={viewMode === 'all' ? onToggleAllUsers : undefined}
        allUsersSelected={allUsersSelected}
        totalCount={selectableUserCount}
        isSelectingAllUsers={isSelectingAllUsers}
        onOpenBulkImport={onOpenBulkImport}
        showBulkImport
      />
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <div className="flex h-full items-center justify-center gap-2 text-muted-foreground">
            <Loader2Icon className="animate-spin" /> Loading{' '}
            {userLabel.toLowerCase()}…
          </div>
        ) : isError ? (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <p className="text-sm text-destructive">
              Unable to load {userLabel.toLowerCase()}.
            </p>
            <Button type="button" variant="outline" onClick={onRetry}>
              Retry
            </Button>
          </div>
        ) : users.length === 0 ? (
          <SelectionEmpty
            message={
              viewMode === 'selected'
                ? `No ${userLabel.toLowerCase()} currently selected. Choose from the list or use Bulk select / import.`
                : `No ${userLabel.toLowerCase()} match this search.`
            }
          />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {users.map((user) => (
              <UserSelectionRow
                key={user.id}
                checked={selectedUserIds.has(user.id)}
                title={user.displayName}
                description={user.email}
                onToggle={() => onToggleUser(user.id)}
              />
            ))}
          </div>
        )}
      </div>
      {viewMode === 'all' && totalCount > 0 ? (
        <div className="shrink-0 border-t px-3 py-2">
          <NumberedPagination
            page={page}
            totalPages={totalPages}
            totalCount={totalCount}
            limit={managedUsersPageSize}
            itemName={userLabel.toLowerCase()}
            disabled={isChangingPage}
            onPageChange={onPageChange}
          />
        </div>
      ) : null}
    </div>
  )
}

type SelectionHeaderProps = {
  title: string
  selectedCount: number
  search: string
  searchPlaceholder: string
  allVisibleSelected: boolean
  hasItems: boolean
  totalCount?: number
  allUsersSelected?: boolean
  isSelectingAllUsers?: boolean
  viewMode?: 'all' | 'selected'
  showBulkImport?: boolean
  onViewModeChange?: (mode: 'all' | 'selected') => void
  onSearchChange: (value: string) => void
  onToggleAll: () => void
  onToggleAllUsers?: () => void
  onOpenBulkImport?: () => void
}

function SelectionHeader({
  title,
  selectedCount,
  search,
  searchPlaceholder,
  allVisibleSelected,
  hasItems,
  totalCount,
  allUsersSelected = false,
  isSelectingAllUsers = false,
  viewMode,
  showBulkImport = false,
  onViewModeChange,
  onSearchChange,
  onToggleAll,
  onToggleAllUsers,
  onOpenBulkImport,
}: SelectionHeaderProps) {
  return (
    <div className="flex shrink-0 flex-col gap-2 border-b bg-card p-2 sm:flex-row sm:items-center">
      <div className="flex items-center gap-2">
        <h3 className="font-semibold">{title}</h3>
        <Badge variant="secondary">{selectedCount} selected</Badge>
      </div>

      {onViewModeChange ? (
        <div className="inline-flex rounded-lg border bg-muted p-0.5 text-xs">
          <button
            type="button"
            onClick={() => onViewModeChange('all')}
            className={cn(
              'rounded-md px-2.5 py-1 font-medium transition-colors',
              viewMode === 'all'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('selected')}
            className={cn(
              'rounded-md px-2.5 py-1 font-medium transition-colors',
              viewMode === 'selected'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Selected ({selectedCount})
          </button>
        </div>
      ) : null}

      <div className="relative min-w-0 flex-1">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          className="pl-9 pr-9"
        />
        {search ? (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <XIcon className="size-4" />
          </button>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        {showBulkImport && onOpenBulkImport ? (
          <Button
            type="button"
            variant="outline"
            onClick={onOpenBulkImport}
            className="gap-1.5"
          >
            <FileSpreadsheetIcon className="size-4" />
            Bulk select / import
          </Button>
        ) : null}

        <Button
          type="button"
          variant="outline"
          disabled={!hasItems}
          onClick={onToggleAll}
        >
          {allVisibleSelected ? 'Unselect visible' : 'Select visible'}
        </Button>
        {onToggleAllUsers && totalCount ? (
          <Button
            type="button"
            variant="outline"
            disabled={isSelectingAllUsers}
            onClick={onToggleAllUsers}
          >
            {isSelectingAllUsers
              ? 'Selecting…'
              : allUsersSelected
                ? `Unselect all ${totalCount}`
                : `Select all ${totalCount}`}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function SelectionCard({
  checked,
  title,
  description,
  onToggle,
}: {
  checked: boolean
  title: string
  description: string
  onToggle: () => void
}) {
  return (
    <div
      role="checkbox"
      aria-checked={checked}
      aria-label={`${title} — ${description}`}
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(event) => {
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault()
          onToggle()
        }
      }}
      className={cn(
        'flex min-w-0 cursor-pointer items-center gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary/50 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
        checked && 'border-primary bg-primary/5',
      )}
    >
      <Checkbox
        checked={checked}
        aria-hidden
        tabIndex={-1}
        className="pointer-events-none shrink-0"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {description}
        </span>
      </span>
    </div>
  )
}

function UserSelectionRow({
  checked,
  title,
  description,
  onToggle,
}: {
  checked: boolean
  title: string
  description: string
  onToggle: () => void
}) {
  return (
    <div
      role="checkbox"
      aria-checked={checked}
      aria-label={`${title} — ${description}`}
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(event) => {
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault()
          onToggle()
        }
      }}
      className={cn(
        'flex min-w-0 cursor-pointer items-center gap-3 rounded-lg border bg-card px-3 py-2 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40',
        checked && 'bg-primary/5',
      )}
    >
      <Checkbox
        checked={checked}
        aria-hidden
        tabIndex={-1}
        className="pointer-events-none shrink-0"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {description}
        </span>
      </span>
    </div>
  )
}

function SelectionEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-40 items-center justify-center text-sm text-muted-foreground">
      {message}
    </div>
  )
}
