import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Eye,
  Search,
  XCircle,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/custom/empty-state'
import { ErrorState } from '@/components/ui/custom/error-state'
import { PageHeader } from '@/components/ui/custom/page-header'
import { StatusBadge } from '@/components/ui/custom/status-badge/status-badge'
import { Input } from '@/components/ui/input'
import { InstructorListSkeleton } from '@/workspaces/instructor/instructor-list-skeleton'
import { ReviewWorkloadSummary } from '@/workspaces/instructor/reviews/review-workload-summary'
import {
  useInstructorReviewQueue,
  useInstructorReviewWorkloadSummary,
} from '@/workspaces/instructor/reviews/use-reviews'
import { useAuthStore } from '@/features/auth/session/interface/session-store'
import { useInstructorWorkspacePreferences } from '@/workspaces/instructor/preferences/use-instructor-workspace-preferences'
import { SavedFiltersMenu } from '@/workspaces/instructor/reviews/saved-filters-menu'
import type {
  InstructorReviewQueueItem,
  StudentFlagReason,
} from '@/features/reviews/interface/instructor-review.schema'
import {
  studentFlagReasonLabel,
  studentFlagReasons,
} from '@/features/reviews/interface/student-flag-reason'
import type {
  QueueFilterCriteria,
  QueueStatus,
  QueueTrigger,
  SavedQueueFilter,
} from '@/workspaces/instructor/preferences/instructor-workspace-preferences.types'
import { cn } from '@/lib/utils'

const statusTabs: { value: QueueStatus; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'IN_REVIEW', label: 'In review' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'REJECTED', label: 'Rejected' },
]

const triggerOptions: QueueTrigger[] = [
  'STUDENT_REQUEST',
  'GENERAL_NOT_FOUND',
  'CITATION_MISSING',
  'SOURCE_CONFLICT',
  'POLICY_CHECK_FAILED',
  'FINAL_ANSWER_RISK',
]

function getQueueFilterStorageKey(userId?: string | null): string {
  return userId
    ? `morshid:instructor-review-queue-filters:${userId}`
    : 'morshid:instructor-review-queue-filters'
}

export function ReviewQueuePage() {
  const userId = useAuthStore((state) => state.user?.id)
  const { savedFilters, saveFilter, renameFilter, deleteFilter } =
    useInstructorWorkspacePreferences()

  const [storedFilters] = useState(() => readInitialQueueFilters(userId))
  const [studentFlagReason, setStudentFlagReason] =
    useState<StudentFlagReason | null>(storedFilters.studentFlagReason)
  const query = useInstructorReviewQueue(studentFlagReason)
  const {
    dataUpdatedAt,
    fetchNextPage,
    hasNextPage,
    isError,
    isFetchingNextPage,
  } = query
  const pages = query.data?.pages ?? []
  const items = pages.flatMap((page) => page.items)
  const pendingCount = pages[0]?.pendingCount ?? 0
  const [search, setSearch] = useState(storedFilters.search)
  const [status, setStatus] = useState<QueueStatus>(storedFilters.status)
  const [courseId, setCourseId] = useState<string | null>(
    storedFilters.courseId,
  )
  const workloadSummaryQuery = useInstructorReviewWorkloadSummary(courseId)
  const [trigger, setTrigger] = useState<QueueTrigger | null>(
    storedFilters.trigger,
  )
  const [preservedCourses, setPreservedCourses] = useState<
    InstructorReviewQueueItem['course'][]
  >(storedFilters.preservedCourses)
  const normalizedSearch = search.trim().toLowerCase()
  const currentCourses = Array.from(
    new Map(items.map((item) => [item.course.id, item.course])).values(),
  )
  const courses = studentFlagReason === null ? currentCourses : preservedCourses

  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && !isError) {
      void fetchNextPage()
    }
  }, [dataUpdatedAt, fetchNextPage, hasNextPage, isError, isFetchingNextPage])

  const isLoadingCompleteQueue =
    query.isPending || query.hasNextPage || query.isFetchingNextPage

  // Sync to session storage (namespaced by user)
  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        getQueueFilterStorageKey(userId),
        JSON.stringify({
          search,
          status,
          courseId,
          trigger,
          studentFlagReason,
          preservedCourses,
        }),
      )
    } catch {
      // Filter persistence is a convenience; the queue remains usable without it.
    }
  }, [
    courseId,
    preservedCourses,
    search,
    status,
    studentFlagReason,
    trigger,
    userId,
  ])

  // Sync active filters to URL query string
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams()
    if (status !== 'PENDING') params.set('status', status)
    if (courseId) params.set('courseId', courseId)
    if (trigger) params.set('trigger', trigger)
    if (studentFlagReason) params.set('reason', studentFlagReason)
    if (search.trim()) params.set('search', search.trim())

    const queryStr = params.toString()
    const newUrl = queryStr
      ? `${window.location.pathname}?${queryStr}`
      : window.location.pathname

    const currentUrl = `${window.location.pathname}${window.location.search}`
    if (currentUrl !== newUrl) {
      window.history.replaceState(window.history.state, '', newUrl)
    }
  }, [courseId, search, status, studentFlagReason, trigger])

  function selectStudentFlagReason(reason: StudentFlagReason) {
    if (studentFlagReason === null) setPreservedCourses(currentCourses)
    setStudentFlagReason(reason)
  }

  function handleApplySavedFilter(filter: SavedQueueFilter) {
    const c = filter.criteria
    setStatus(c.status ?? 'ALL')
    setCourseId(c.courseId ?? null)
    setTrigger(c.trigger ?? null)
    if (c.studentFlagReason) {
      if (studentFlagReason === null) setPreservedCourses(currentCourses)
      setStudentFlagReason(c.studentFlagReason)
    } else {
      setStudentFlagReason(null)
    }
    setSearch(c.search ?? '')
  }

  const currentCriteria: QueueFilterCriteria = {
    search: search.trim() || undefined,
    status,
    courseId,
    trigger,
    studentFlagReason,
  }

  const filteredItems = items.filter((item) => {
    const matchesStatus = status === 'ALL' || item.status === status
    const matchesCourse = courseId === null || item.course.id === courseId
    const matchesTrigger = trigger === null || item.triggers.includes(trigger)
    const matchesSearch =
      normalizedSearch.length === 0 ||
      item.student.displayName.toLowerCase().includes(normalizedSearch) ||
      item.course.title.toLowerCase().includes(normalizedSearch) ||
      item.course.code.toLowerCase().includes(normalizedSearch) ||
      item.triggers.some((itemTrigger) =>
        humanize(itemTrigger).toLowerCase().includes(normalizedSearch),
      )

    return matchesStatus && matchesCourse && matchesTrigger && matchesSearch
  })

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Instructor workspace"
        title="Review Queue"
        description="Review flagged responses from your assigned courses."
      />

      <ReviewWorkloadSummary
        summary={workloadSummaryQuery.data}
        isLoading={workloadSummaryQuery.isPending}
        error={workloadSummaryQuery.error}
        onRetry={() => {
          void workloadSummaryQuery.refetch()
        }}
        onSelectStatus={(selectedStatus) => {
          setStatus(selectedStatus)
        }}
        onSelectStudentFlagReason={(selectedReason) => {
          selectStudentFlagReason(selectedReason)
        }}
        onSelectTrigger={(selectedTrigger) => {
          setTrigger(selectedTrigger)
        }}
      />

      <Card className="overflow-hidden">
        <CardHeader className="gap-5 border-b px-5 py-5 sm:px-6">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold tracking-tight">
                  Review Queue
                </h2>
                <StatusBadge
                  status={pendingCount > 0 ? 'pending' : 'complete'}
                  label={`${pendingCount} pending`}
                />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Escalations from your assigned courses
              </p>
            </div>

            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
              <SavedFiltersMenu
                currentCriteria={currentCriteria}
                savedFilters={savedFilters}
                courses={courses}
                onApplyFilter={handleApplySavedFilter}
                onSaveFilter={(name) => saveFilter(name, currentCriteria)}
                onRenameFilter={renameFilter}
                onDeleteFilter={deleteFilter}
              />
              <label className="relative block w-full sm:w-72 lg:w-80">
                <span className="sr-only">Search reviews</span>
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search students or courses…"
                  className="pl-9"
                />
              </label>
            </div>
          </div>

          <div className="flex gap-1 overflow-x-auto border-b" role="tablist">
            {statusTabs.map((tab) => {
              const count =
                tab.value === 'ALL'
                  ? items.length
                  : items.filter((item) => item.status === tab.value).length
              return (
                <button
                  key={tab.value}
                  type="button"
                  role="tab"
                  aria-selected={status === tab.value}
                  onClick={() => setStatus(tab.value)}
                  className={cn(
                    'relative flex shrink-0 items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground',
                    status === tab.value &&
                      'text-primary after:absolute after:right-0 after:bottom-0 after:left-0 after:h-0.5 after:bg-primary',
                  )}
                >
                  {tab.label}
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.65rem] leading-none text-muted-foreground">
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              className="flex flex-wrap items-center gap-2"
              aria-label="Filter by course"
            >
              <Button
                type="button"
                size="sm"
                aria-pressed={courseId === null}
                variant={courseId === null ? 'default' : 'outline'}
                className="h-8 rounded-full"
                onClick={() => setCourseId(null)}
              >
                All courses
              </Button>
              {courses.map((course) => (
                <Button
                  key={course.id}
                  type="button"
                  size="sm"
                  aria-pressed={courseId === course.id}
                  variant={courseId === course.id ? 'default' : 'outline'}
                  className="h-8 rounded-full"
                  onClick={() => setCourseId(course.id)}
                >
                  {course.code}
                </Button>
              ))}
            </div>

            <span
              className="mx-1 hidden h-6 w-px bg-border sm:block"
              aria-hidden
            />

            <div
              className="flex flex-wrap items-center gap-2"
              aria-label="Filter by trigger"
            >
              <Button
                type="button"
                size="sm"
                aria-pressed={trigger === null}
                variant={trigger === null ? 'secondary' : 'outline'}
                className="h-8 rounded-full"
                onClick={() => setTrigger(null)}
              >
                All triggers
              </Button>
              {triggerOptions.map((availableTrigger) => (
                <Button
                  key={availableTrigger}
                  type="button"
                  size="sm"
                  aria-pressed={trigger === availableTrigger}
                  variant={
                    trigger === availableTrigger ? 'secondary' : 'outline'
                  }
                  className={cn(
                    'h-8 rounded-full',
                    availableTrigger === 'STUDENT_REQUEST' &&
                      'border-info/25 bg-info/10 text-info hover:bg-info/15 hover:text-info',
                    trigger === availableTrigger &&
                      availableTrigger === 'STUDENT_REQUEST' &&
                      'ring-2 ring-info/25',
                  )}
                  onClick={() => setTrigger(availableTrigger)}
                >
                  {humanize(availableTrigger)}
                </Button>
              ))}
            </div>

            <span
              className="mx-1 hidden h-6 w-px bg-border sm:block"
              aria-hidden
            />

            <div
              className="flex flex-wrap items-center gap-2"
              aria-label="Filter by Student reason"
            >
              <Button
                type="button"
                size="sm"
                aria-pressed={studentFlagReason === null}
                variant={studentFlagReason === null ? 'secondary' : 'outline'}
                className="h-8 rounded-full"
                onClick={() => setStudentFlagReason(null)}
              >
                All Student reasons
              </Button>
              {studentFlagReasons.map((reason) => (
                <Button
                  key={reason}
                  type="button"
                  size="sm"
                  aria-pressed={studentFlagReason === reason}
                  variant={
                    studentFlagReason === reason ? 'secondary' : 'outline'
                  }
                  className="h-8 rounded-full"
                  onClick={() => selectStudentFlagReason(reason)}
                >
                  {studentFlagReasonLabel(reason)}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-5">
          {isLoadingCompleteQueue ? (
            <div className="p-2">
              <InstructorListSkeleton aria-label="Loading review queue" />
            </div>
          ) : query.isError ? (
            <ErrorState
              title="Unable to load review queue"
              description="The review queue could not be loaded. Try again."
              onRetry={() => void query.refetch()}
              isRetrying={query.isFetching}
              className="min-h-44"
            />
          ) : items.length === 0 && studentFlagReason === null ? (
            <EmptyState
              icon={<ClipboardCheck aria-hidden />}
              title="No review requests"
              description="New flagged responses from your assigned courses will appear here."
              className="min-h-44"
            />
          ) : filteredItems.length === 0 ? (
            <EmptyState
              icon={<Search aria-hidden />}
              title="No matching reviews"
              description="Try another search term, status, course, trigger, or Student reason filter."
              className="min-h-44"
            />
          ) : (
            <ReviewQueueCards items={filteredItems} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

interface StoredQueueFilters {
  search: string
  status: QueueStatus
  courseId: string | null
  trigger: QueueTrigger | null
  studentFlagReason: StudentFlagReason | null
  preservedCourses: InstructorReviewQueueItem['course'][]
}

function readInitialQueueFilters(userId?: string | null): StoredQueueFilters {
  if (typeof window !== 'undefined' && window.location.search) {
    const params = new URLSearchParams(window.location.search)
    const urlStatus = params.get('status')
    const urlCourseId = params.get('courseId')
    const urlTrigger = params.get('trigger')
    const urlReason = params.get('reason') || params.get('studentFlagReason')
    const urlSearch = params.get('search') || params.get('q')

    const hasAnyParam =
      urlStatus !== null ||
      urlCourseId !== null ||
      urlTrigger !== null ||
      urlReason !== null ||
      urlSearch !== null

    if (hasAnyParam) {
      const status = statusTabs.some(({ value }) => value === urlStatus)
        ? (urlStatus as QueueStatus)
        : 'PENDING'
      const trigger = triggerOptions.includes(urlTrigger as QueueTrigger)
        ? (urlTrigger as QueueTrigger)
        : null
      const studentFlagReason = studentFlagReasons.includes(
        urlReason as StudentFlagReason,
      )
        ? (urlReason as StudentFlagReason)
        : null

      return {
        search: urlSearch ?? '',
        status,
        courseId: urlCourseId,
        trigger,
        studentFlagReason,
        preservedCourses: [],
      }
    }
  }

  return readStoredQueueFilters(userId)
}

function readStoredQueueFilters(userId?: string | null): StoredQueueFilters {
  const fallback: StoredQueueFilters = {
    search: '',
    status: 'PENDING',
    courseId: null,
    trigger: null,
    studentFlagReason: null,
    preservedCourses: [],
  }
  let baseFilters: StoredQueueFilters = fallback
  try {
    const key = getQueueFilterStorageKey(userId)
    const parsed: unknown = JSON.parse(
      window.sessionStorage.getItem(key) ?? 'null',
    )
    if (typeof parsed === 'object' && parsed !== null) {
      const candidate = parsed as Partial<StoredQueueFilters>
      baseFilters = {
        search: typeof candidate.search === 'string' ? candidate.search : '',
        status: statusTabs.some(({ value }) => value === candidate.status)
          ? (candidate.status ?? 'PENDING')
          : 'PENDING',
        courseId:
          typeof candidate.courseId === 'string' ? candidate.courseId : null,
        trigger: triggerOptions.includes(candidate.trigger as QueueTrigger)
          ? (candidate.trigger ?? null)
          : null,
        studentFlagReason: studentFlagReasons.includes(
          candidate.studentFlagReason as StudentFlagReason,
        )
          ? (candidate.studentFlagReason ?? null)
          : null,
        preservedCourses: Array.isArray(candidate.preservedCourses)
          ? candidate.preservedCourses.filter(isStoredCourse)
          : [],
      }
    }
  } catch {
    baseFilters = fallback
  }

  try {
    if (typeof window !== 'undefined' && window.location.search) {
      const searchParams = new URLSearchParams(window.location.search)
      const statusParam = searchParams.get('status')
      const courseIdParam = searchParams.get('courseId')
      const triggerParam = searchParams.get('trigger')
      const reasonParam = searchParams.get('studentFlagReason')
      const querySearchParam = searchParams.get('search')

      if (
        statusParam &&
        statusTabs.some(({ value }) => value === statusParam)
      ) {
        baseFilters.status = statusParam as QueueStatus
      }
      if (courseIdParam !== null) {
        baseFilters.courseId = courseIdParam || null
      }
      if (
        triggerParam &&
        triggerOptions.includes(triggerParam as QueueTrigger)
      ) {
        baseFilters.trigger = triggerParam as QueueTrigger
      }
      if (
        reasonParam &&
        studentFlagReasons.includes(reasonParam as StudentFlagReason)
      ) {
        baseFilters.studentFlagReason = reasonParam as StudentFlagReason
      }
      if (querySearchParam !== null) {
        baseFilters.search = querySearchParam
      }
    }
  } catch {
    // Ignore URL parameter parsing errors
  }

  return baseFilters
}

function isStoredCourse(
  course: unknown,
): course is InstructorReviewQueueItem['course'] {
  if (typeof course !== 'object' || course === null) return false
  const candidate = course as Record<string, unknown>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.code === 'string' &&
    typeof candidate.title === 'string'
  )
}

function ReviewQueueCards({ items }: { items: InstructorReviewQueueItem[] }) {
  return (
    <div className="space-y-3" aria-label="Review requests">
      {items.map((item) => (
        <article
          key={item.reviewCaseId}
          className="rounded-2xl border bg-card px-4 py-4 transition-colors hover:border-primary/25 hover:bg-muted/20 sm:px-5"
        >
          <div className="flex items-start gap-3">
            <div
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
              aria-hidden
            >
              {initials(item.student.displayName)}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-foreground">
                    {item.student.displayName}
                  </h3>
                  <p className="flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
                    <span>{item.course.code}</span>
                    <span aria-hidden>·</span>
                    <span>{item.course.title}</span>
                    <span aria-hidden>·</span>
                    <span>{shortReviewId(item.reviewCaseId)}</span>
                  </p>
                </div>
                <ReviewStatus status={item.status} />
              </div>

              <p className="mt-3 text-sm font-medium text-foreground">
                Review request {shortReviewId(item.reviewCaseId)}
              </p>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {item.triggers.map((itemTrigger) => (
                    <Badge
                      key={itemTrigger}
                      variant={
                        itemTrigger === 'STUDENT_REQUEST' ? 'info' : 'secondary'
                      }
                    >
                      {humanize(itemTrigger)}
                    </Badge>
                  ))}
                  {item.studentFlagReason ? (
                    <Badge variant="outline">
                      {studentFlagReasonLabel(item.studentFlagReason)}
                    </Badge>
                  ) : null}
                  {item.studentNote ? (
                    <span className="max-w-80 truncate">
                      Student note: {item.studentNote}
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="size-3.5" aria-hidden />
                    {formatAge(item.age)} ago
                  </span>
                </div>

                <Link
                  to="/instructor/review-queue/$reviewCaseId"
                  params={{ reviewCaseId: item.reviewCaseId }}
                  state={(previous) => ({
                    ...previous,
                    reviewQueueOverlay: true,
                  })}
                  aria-label={`Review ${item.student.displayName} in ${item.course.title}`}
                  className={buttonVariants({
                    size: 'sm',
                    variant: 'outline',
                    className: 'group',
                  })}
                >
                  Open
                  <ArrowRight
                    className="transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}

function ReviewStatus({
  status,
}: {
  status: InstructorReviewQueueItem['status']
}) {
  const Icon =
    status === 'PENDING'
      ? Clock3
      : status === 'IN_REVIEW'
        ? Eye
        : status === 'RESOLVED'
          ? CheckCircle2
          : XCircle

  return (
    <StatusBadge
      status={status}
      label={
        <span className="inline-flex items-center gap-1">
          <Icon className="size-3" aria-hidden />
          {status === 'PENDING' ? 'Awaiting Review' : humanize(status)}
        </span>
      }
      tone={
        status === 'RESOLVED'
          ? 'success'
          : status === 'IN_REVIEW'
            ? 'info'
            : status === 'REJECTED'
              ? 'destructive'
              : 'warning'
      }
      className="shrink-0"
    />
  )
}

function humanize(value: string) {
  return value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^./u, (letter) => letter.toUpperCase())
}

function initials(displayName: string) {
  return displayName
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

function shortReviewId(reviewCaseId: string) {
  return `REV-${reviewCaseId.slice(0, 4).toUpperCase()}`
}

function formatAge(seconds: number) {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3_600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86_400) return `${Math.floor(seconds / 3_600)}h`
  return `${Math.floor(seconds / 86_400)}d`
}
