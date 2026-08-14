import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BookCheckIcon,
  CheckIcon,
  Loader2Icon,
  SearchIcon,
  UserPlusIcon,
  XIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'

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
import type {
  CourseAdministration,
  CourseMembershipRole,
} from '@/features/courses/course-administration.schema'
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value'
import { cn } from '@/lib/utils'
import { useManagedUsers } from '@/workspaces/admin/users/use-user-management'

type AssignmentStep = 'courses' | 'users'

type BulkCourseAssignmentDialogProps = {
  courses: CourseAdministration[]
  role: CourseMembershipRole
  isPending: boolean
  hasNextCoursePage?: boolean
  isLoadingMoreCourses?: boolean
  onLoadMoreCourses?: () => void
  onAssign: (input: {
    courseIds: string[]
    userIds: string[]
    role: CourseMembershipRole
  }) => Promise<unknown>
}

export function BulkCourseAssignmentDialog({
  courses,
  role,
  isPending,
  hasNextCoursePage = false,
  isLoadingMoreCourses = false,
  onLoadMoreCourses,
  onAssign,
}: BulkCourseAssignmentDialogProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<AssignmentStep>('courses')
  const [courseSearch, setCourseSearch] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [selectedCourseIds, setSelectedCourseIds] = useState<Set<string>>(
    new Set(),
  )
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set())
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const debouncedUserSearch = useDebouncedValue(userSearch.trim(), 250)
  const usersQuery = useManagedUsers(
    {
      role,
      status: 'ACTIVE',
      search: debouncedUserSearch || undefined,
    },
    open && step === 'users',
  )
  const users = useMemo(
    () => usersQuery.data?.pages.flatMap((page) => page.users) ?? [],
    [usersQuery.data],
  )
  const filteredCourses = useMemo(() => {
    const query = courseSearch.trim().toLowerCase()
    if (!query) return courses
    return courses.filter(
      (course) =>
        course.code.toLowerCase().includes(query) ||
        course.title.toLowerCase().includes(query),
    )
  }, [courseSearch, courses])
  const userLabel = role === 'STUDENT' ? 'students' : 'instructors'
  const maxUserSelections = Math.floor(
    1_000 / Math.max(selectedCourseIds.size, 1),
  )
  const allVisibleCoursesSelected =
    filteredCourses.length > 0 &&
    filteredCourses.every((course) => selectedCourseIds.has(course.id))
  const allVisibleUsersSelected =
    users.length > 0 && users.every((user) => selectedUserIds.has(user.id))

  const reset = () => {
    setStep('courses')
    setCourseSearch('')
    setUserSearch('')
    setSelectedCourseIds(new Set())
    setSelectedUserIds(new Set())
    setErrorMessage(null)
  }

  const setDialogOpen = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) reset()
  }

  const toggleCourse = (courseId: string) => {
    setSelectedCourseIds((current) => {
      const next = new Set(current)
      if (next.has(courseId)) next.delete(courseId)
      else if (next.size < 50) next.add(courseId)
      return next
    })
  }

  const toggleVisibleCourses = () => {
    setSelectedCourseIds((current) => {
      const next = new Set(current)
      if (allVisibleCoursesSelected) {
        for (const course of filteredCourses) next.delete(course.id)
      } else {
        for (const course of filteredCourses) {
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
        for (const user of users) next.delete(user.id)
      } else {
        for (const user of users) {
          if (next.size >= maxUserSelections) break
          next.add(user.id)
        }
      }
      return next
    })
  }

  const handleAssign = async () => {
    if (selectedCourseIds.size === 0 || selectedUserIds.size === 0) return
    try {
      setErrorMessage(null)
      await onAssign({
        courseIds: [...selectedCourseIds],
        userIds: [...selectedUserIds],
        role,
      })
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
    <Dialog open={open} onOpenChange={setDialogOpen}>
      <DialogTrigger render={<Button disabled={courses.length === 0} />}>
        <BookCheckIcon className="size-4" />
        Assign {userLabel}
      </DialogTrigger>
      <DialogContent className="flex h-[min(88vh,820px)] w-[min(96vw,1120px)] max-w-none flex-col gap-4 overflow-hidden p-5 sm:max-w-none sm:p-6">
        <DialogHeader className="shrink-0 pr-10">
          <DialogTitle>Assign {userLabel} to courses</DialogTitle>
          <DialogDescription>
            Choose courses first, then choose the {userLabel} to add to all of
            them. Existing assignments are skipped.
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
              courses={filteredCourses}
              search={courseSearch}
              selectedCourseIds={selectedCourseIds}
              allVisibleSelected={allVisibleCoursesSelected}
              onSearchChange={setCourseSearch}
              onToggleCourse={toggleCourse}
              onToggleAll={toggleVisibleCourses}
              hasNextPage={hasNextCoursePage}
              isLoadingMore={isLoadingMoreCourses}
              onLoadMore={onLoadMoreCourses}
            />
          ) : (
            <UserSelectionStep
              users={users}
              role={role}
              search={userSearch}
              selectedUserIds={selectedUserIds}
              allVisibleSelected={allVisibleUsersSelected}
              maxSelections={maxUserSelections}
              isLoading={usersQuery.isPending}
              isError={usersQuery.isError}
              hasNextPage={usersQuery.hasNextPage}
              isLoadingMore={usersQuery.isFetchingNextPage}
              onSearchChange={setUserSearch}
              onToggleUser={toggleUser}
              onToggleAll={toggleVisibleUsers}
              onLoadMore={() => void usersQuery.fetchNextPage()}
              onRetry={() => void usersQuery.refetch()}
            />
          )}
        </div>

        <DialogFooter className="shrink-0 items-center border-t pt-4 sm:justify-between">
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
  users: Array<{ id: string; displayName: string; email: string }>
  role: CourseMembershipRole
  search: string
  selectedUserIds: Set<string>
  allVisibleSelected: boolean
  maxSelections: number
  isLoading: boolean
  isError: boolean
  hasNextPage: boolean
  isLoadingMore: boolean
  onSearchChange: (value: string) => void
  onToggleUser: (userId: string) => void
  onToggleAll: () => void
  onLoadMore: () => void
  onRetry: () => void
}

function UserSelectionStep({
  users,
  role,
  search,
  selectedUserIds,
  allVisibleSelected,
  maxSelections,
  isLoading,
  isError,
  hasNextPage,
  isLoadingMore,
  onSearchChange,
  onToggleUser,
  onToggleAll,
  onLoadMore,
  onRetry,
}: UserSelectionStepProps) {
  const userLabel = role === 'STUDENT' ? 'Students' : 'Instructors'
  return (
    <div className="flex h-full min-h-0 flex-col">
      <SelectionHeader
        title={userLabel}
        selectedCount={selectedUserIds.size}
        search={search}
        searchPlaceholder={`Search ${userLabel.toLowerCase()} by name or email...`}
        allVisibleSelected={allVisibleSelected}
        hasItems={users.length > 0}
        onSearchChange={onSearchChange}
        onToggleAll={onToggleAll}
      />
      <p className="shrink-0 border-b px-4 py-2 text-xs text-muted-foreground">
        Search runs across all {userLabel.toLowerCase()}. Up to{' '}
        {maxSelections.toLocaleString()} may be selected for the chosen courses.
      </p>
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
            message={`No ${userLabel.toLowerCase()} match this search.`}
          />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {users.map((user) => (
              <SelectionCard
                key={user.id}
                checked={selectedUserIds.has(user.id)}
                title={user.displayName}
                description={user.email}
                onToggle={() => onToggleUser(user.id)}
              />
            ))}
          </div>
        )}
        {hasNextPage ? (
          <div className="flex justify-center pt-4">
            <Button
              type="button"
              variant="outline"
              disabled={isLoadingMore}
              onClick={onLoadMore}
            >
              {isLoadingMore ? <Loader2Icon className="animate-spin" /> : null}
              {isLoadingMore
                ? 'Loading…'
                : `Load more ${userLabel.toLowerCase()}`}
            </Button>
          </div>
        ) : null}
      </div>
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
  onSearchChange: (value: string) => void
  onToggleAll: () => void
}

function SelectionHeader({
  title,
  selectedCount,
  search,
  searchPlaceholder,
  allVisibleSelected,
  hasItems,
  onSearchChange,
  onToggleAll,
}: SelectionHeaderProps) {
  return (
    <div className="flex shrink-0 flex-col gap-3 border-b bg-card p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-36 items-center gap-2">
        <h3 className="font-semibold">{title}</h3>
        <Badge variant="secondary">{selectedCount} selected</Badge>
      </div>
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
      <Button
        type="button"
        variant="outline"
        disabled={!hasItems}
        onClick={onToggleAll}
      >
        {allVisibleSelected ? 'Unselect visible' : 'Select visible'}
      </Button>
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

function SelectionEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-40 items-center justify-center text-sm text-muted-foreground">
      {message}
    </div>
  )
}
