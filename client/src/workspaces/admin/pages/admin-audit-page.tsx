import {
  EyeIcon,
  RotateCcwIcon,
  ScrollTextIcon,
  ShieldCheckIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { DataTableState } from '@/components/ui/custom/data-table-state'
import { DataToolbar } from '@/components/ui/custom/data-toolbar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { NumberedPagination } from '@/components/ui/custom/numbered-pagination'
import { PageHeader } from '@/components/ui/custom/page-header'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value'
import { AdminPanel } from '../components/admin-panel'
import { useAudit } from '@/workspaces/admin/audit/use-audit'
import { useCourseAdministration } from '@/workspaces/admin/use-course-administration'
import { useManagedUsers } from '@/workspaces/admin/users/use-user-management'
import type { AuditEvent } from '@/features/audit/audit.schema'

const PAGE_SIZE = 20

const TARGET_TYPE_OPTIONS = [
  { value: 'ALL', label: 'All target types' },
  { value: 'user', label: 'User' },
  { value: 'course', label: 'Course' },
  { value: 'material', label: 'Material' },
  { value: 'auth_session', label: 'Auth Session' },
  { value: 'chat_session', label: 'Chat Session' },
  { value: 'course_membership', label: 'Course Membership' },
  { value: 'review_case', label: 'Review Case' },
  { value: 'system', label: 'System' },
]

const ACTION_OPTIONS = [
  { value: 'ALL', label: 'All actions' },
  { value: 'auth.login_succeeded', label: 'auth.login_succeeded' },
  { value: 'auth.login_failed', label: 'auth.login_failed' },
  { value: 'auth.logout', label: 'auth.logout' },
  { value: 'auth.password_changed', label: 'auth.password_changed' },
  { value: 'auth.profile_updated', label: 'auth.profile_updated' },
  { value: 'auth.session_revoked', label: 'auth.session_revoked' },
  { value: 'access.rbac_denied', label: 'access.rbac_denied' },
  {
    value: 'access.course_boundary_denied',
    label: 'access.course_boundary_denied',
  },
  { value: 'admin.account_created', label: 'admin.account_created' },
  { value: 'admin.account_updated', label: 'admin.account_updated' },
  { value: 'admin.account_disabled', label: 'admin.account_disabled' },
  { value: 'admin.account_enabled', label: 'admin.account_enabled' },
  { value: 'admin.course_created', label: 'admin.course_created' },
  { value: 'admin.course_updated', label: 'admin.course_updated' },
  { value: 'admin.course_archived', label: 'admin.course_archived' },
  { value: 'admin.course_member_added', label: 'admin.course_member_added' },
  {
    value: 'admin.course_member_removed',
    label: 'admin.course_member_removed',
  },
  { value: 'material.upload_succeeded', label: 'material.upload_succeeded' },
  { value: 'material.upload_failed', label: 'material.upload_failed' },
  { value: 'material.updated', label: 'material.updated' },
  { value: 'material.deleted', label: 'material.deleted' },
  { value: 'review.case_created', label: 'review.case_created' },
  { value: 'review.case_resolved', label: 'review.case_resolved' },
  { value: 'review.case_rejected', label: 'review.case_rejected' },
]

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

export function AdminAuditPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const [targetTypeFilter, setTargetTypeFilter] = useState('ALL')
  const [actionFilter, setActionFilter] = useState('ALL')
  const [courseFilter, setCourseFilter] = useState('ALL')
  const [actorFilter, setActorFilter] = useState('ALL')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null)

  const coursesQuery = useCourseAdministration()
  const usersQuery = useManagedUsers()

  const courseOptions = useMemo(
    () => [
      { value: 'ALL', label: 'All courses' },
      ...(coursesQuery.data?.map((course) => ({
        value: course.id,
        label: `${course.code} — ${course.title}`,
      })) ?? []),
    ],
    [coursesQuery.data],
  )

  const actorOptions = useMemo(() => {
    const users = usersQuery.data?.pages.flatMap((p) => p.users) ?? []
    return [
      { value: 'ALL', label: 'All actors' },
      ...users.map((user) => ({
        value: user.id,
        label: `${user.displayName} (${user.email})`,
      })),
    ]
  }, [usersQuery.data])

  const auditQueryParams = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      search:
        debouncedSearch.trim().length > 0 ? debouncedSearch.trim() : undefined,
      targetType: targetTypeFilter !== 'ALL' ? targetTypeFilter : undefined,
      action: actionFilter !== 'ALL' ? actionFilter : undefined,
      courseId: courseFilter !== 'ALL' ? courseFilter : undefined,
      actorUserId: actorFilter !== 'ALL' ? actorFilter : undefined,
      startDate: startDate.length > 0 ? startDate : undefined,
      endDate: endDate.length > 0 ? endDate : undefined,
    }),
    [
      page,
      debouncedSearch,
      targetTypeFilter,
      actionFilter,
      courseFilter,
      actorFilter,
      startDate,
      endDate,
    ],
  )

  const auditQuery = useAudit(auditQueryParams)
  const events = auditQuery.data?.events ?? []
  const total = auditQuery.data?.total ?? 0
  const totalPages = auditQuery.data?.totalPages ?? 1

  const hasActiveFilters =
    search.trim().length > 0 ||
    targetTypeFilter !== 'ALL' ||
    actionFilter !== 'ALL' ||
    courseFilter !== 'ALL' ||
    actorFilter !== 'ALL' ||
    startDate.length > 0 ||
    endDate.length > 0

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const handleTargetTypeChange = (value: string | null) => {
    setTargetTypeFilter(value ?? 'ALL')
    setPage(1)
  }

  const handleActionChange = (value: string | null) => {
    setActionFilter(value ?? 'ALL')
    setPage(1)
  }

  const handleCourseChange = (value: string | null) => {
    setCourseFilter(value ?? 'ALL')
    setPage(1)
  }

  const handleActorChange = (value: string | null) => {
    setActorFilter(value ?? 'ALL')
    setPage(1)
  }

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStartDate(e.target.value)
    setPage(1)
  }

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEndDate(e.target.value)
    setPage(1)
  }

  const handleResetFilters = () => {
    setSearch('')
    setTargetTypeFilter('ALL')
    setActionFilter('ALL')
    setCourseFilter('ALL')
    setActorFilter('ALL')
    setStartDate('')
    setEndDate('')
    setPage(1)
  }

  return (
    <div>
      <PageHeader
        className="mb-8"
        eyebrow="Governance"
        title="Recent Audit Activity"
        description="Track recent authentication, authorization, account, assignment, and material events."
        actions={
          <div className="flex items-center gap-2 rounded-full bg-success/10 px-3 py-1.5 text-sm font-medium text-success ring-1 ring-success/20">
            <ShieldCheckIcon className="size-4" />
            RBAC monitored
          </div>
        }
      />

      <AdminPanel>
        <DataToolbar
          className="border-b px-4 py-3"
          searchPlaceholder="Search actor, event, target..."
          search={search}
          onSearchChange={handleSearchChange}
          filters={
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={targetTypeFilter}
                onValueChange={handleTargetTypeChange}
                items={TARGET_TYPE_OPTIONS}
              >
                <SelectTrigger
                  className="h-9 px-3 text-xs rounded-lg border-border/80 w-full sm:w-40 max-w-full"
                  aria-label="Target Type"
                >
                  <SelectValue placeholder="Target type" />
                </SelectTrigger>
                <SelectContent>
                  {TARGET_TYPE_OPTIONS.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      className="text-xs py-1.5"
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={actionFilter}
                onValueChange={handleActionChange}
                items={ACTION_OPTIONS}
              >
                <SelectTrigger
                  className="h-9 px-3 text-xs rounded-lg border-border/80 w-full sm:w-48 max-w-full"
                  aria-label="Action"
                >
                  <SelectValue placeholder="Event action" />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_OPTIONS.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      className="text-xs py-1.5 font-mono"
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {courseOptions.length > 1 ? (
                <Select
                  value={courseFilter}
                  onValueChange={handleCourseChange}
                  items={courseOptions}
                >
                  <SelectTrigger
                    className="h-9 px-3 text-xs rounded-lg border-border/80 w-full sm:w-48 max-w-full"
                    aria-label="Course"
                  >
                    <SelectValue placeholder="All courses" />
                  </SelectTrigger>
                  <SelectContent>
                    {courseOptions.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={option.value}
                        className="text-xs py-1.5"
                      >
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}

              {actorOptions.length > 1 ? (
                <Select
                  value={actorFilter}
                  onValueChange={handleActorChange}
                  items={actorOptions}
                >
                  <SelectTrigger
                    className="h-9 px-3 text-xs rounded-lg border-border/80 w-full sm:w-48 max-w-full"
                    aria-label="Actor"
                  >
                    <SelectValue placeholder="All actors" />
                  </SelectTrigger>
                  <SelectContent>
                    {actorOptions.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={option.value}
                        className="text-xs py-1.5"
                      >
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}

              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <Input
                  type="date"
                  value={startDate}
                  onChange={handleStartDateChange}
                  aria-label="Start date"
                  className="h-9 px-2.5 text-xs rounded-lg w-full sm:w-36"
                />
                <span className="text-xs text-muted-foreground">to</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={handleEndDateChange}
                  aria-label="End date"
                  className="h-9 px-2.5 text-xs rounded-lg w-full sm:w-36"
                />
              </div>

              {hasActiveFilters ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResetFilters}
                  aria-label="Clear filters"
                  className="h-9 gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <RotateCcwIcon className="size-3.5" />
                  <span>Clear</span>
                </Button>
              ) : null}
            </div>
          }
        />

        <DataTableState
          isLoading={auditQuery.isPending}
          isError={auditQuery.isError}
          isEmpty={events.length === 0}
          onRetry={() => void auditQuery.refetch()}
          isRetrying={auditQuery.isFetching}
          emptyTitle={
            hasActiveFilters
              ? 'No matching audit events'
              : 'No audit events found'
          }
          emptyDescription={
            hasActiveFilters
              ? 'Try changing or clearing your search and filter criteria.'
              : 'Recent audit events returned by the API will appear here.'
          }
        >
          {/* Mobile Compact List (< md) — No Horizontal Scroll */}
          <div className="divide-y divide-border md:hidden">
            {events.map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between p-3.5 gap-3 hover:bg-secondary/20 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground truncate text-sm">
                    {event.action}
                  </p>
                  <p className="text-xs text-muted-foreground truncate pt-0.5">
                    By: {event.actor?.displayName ?? 'System'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate pt-0.5">
                    Target: {event.targetType}
                  </p>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setSelectedEvent(event)}
                  aria-label="View event details"
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                >
                  <EyeIcon className="size-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* Desktop Table (>= md) */}
          <div className="hidden md:block w-full max-h-[65vh] overflow-x-auto overflow-y-auto scrollbar-themed">
            <Table className="w-full min-w-[880px]">
              <TableHeader className="sticky top-0 z-10 bg-secondary/80 backdrop-blur-md">
                <TableRow>
                  <TableHead className="w-[30%] min-w-[220px] smallcaps-label h-11 px-4 pl-6">
                    Event
                  </TableHead>
                  <TableHead className="w-[18%] min-w-[140px] smallcaps-label h-11 px-4">
                    Actor
                  </TableHead>
                  <TableHead className="w-[22%] min-w-[180px] smallcaps-label h-11 px-4">
                    Target type
                  </TableHead>
                  <TableHead className="w-[14%] min-w-[120px] smallcaps-label h-11 px-4">
                    Course
                  </TableHead>
                  <TableHead className="w-[12%] min-w-[140px] smallcaps-label h-11 px-4 text-right">
                    Created
                  </TableHead>
                  <TableHead className="w-[4%] min-w-[60px] smallcaps-label h-11 px-4 pr-6 text-center">
                    View
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow
                    key={event.id}
                    className="h-[52px] hover:bg-secondary/40"
                  >
                    <TableCell className="px-4 py-3.5 pl-6 min-w-0">
                      <p className="font-medium text-foreground truncate max-w-[240px]">
                        {event.action}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground truncate max-w-[240px]">
                        {event.id}
                      </p>
                    </TableCell>
                    <TableCell className="px-4 py-3.5 min-w-0">
                      <p className="font-medium text-foreground truncate max-w-[140px]">
                        {event.actor?.displayName ?? 'System'}
                      </p>
                    </TableCell>
                    <TableCell className="px-4 py-3.5 min-w-0">
                      <p className="font-medium text-foreground truncate max-w-[180px]">
                        {event.targetType}
                      </p>
                      {event.targetId ? (
                        <p className="font-mono text-xs text-muted-foreground truncate max-w-[180px]">
                          {event.targetId}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="px-4 py-3.5 text-muted-foreground min-w-0">
                      <p className="font-mono text-xs truncate max-w-[120px]">
                        {event.courseId ?? '—'}
                      </p>
                    </TableCell>
                    <TableCell className="px-4 py-3.5 text-muted-foreground tabular-nums text-right whitespace-nowrap">
                      {dateFormatter.format(new Date(event.createdAt))}
                    </TableCell>
                    <TableCell className="px-4 py-3.5 pr-6 text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setSelectedEvent(event)}
                        aria-label="View event details"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <EyeIcon className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <NumberedPagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            disabled={auditQuery.isFetching}
          />
        </DataTableState>
      </AdminPanel>

      <Dialog
        open={Boolean(selectedEvent)}
        onOpenChange={(open) => !open && setSelectedEvent(null)}
      >
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <ScrollTextIcon className="size-5 text-primary" />
              Audit Event Details
            </DialogTitle>
          </DialogHeader>

          {selectedEvent ? (
            <div className="grid gap-3.5 py-1 text-sm">
              <div className="rounded-xl border bg-muted/40 p-3.5 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Event Action
                </p>
                <p className="font-semibold text-foreground text-base">
                  {selectedEvent.action}
                </p>
                <p className="font-mono text-xs text-muted-foreground select-all">
                  {selectedEvent.id}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border bg-card p-3 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Actor
                  </p>
                  <p className="font-medium text-foreground">
                    {selectedEvent.actor?.displayName ?? 'System'}
                  </p>
                  {selectedEvent.actor?.email ? (
                    <p className="text-xs text-muted-foreground truncate">
                      {selectedEvent.actor.email}
                    </p>
                  ) : null}
                </div>

                <div className="rounded-xl border bg-card p-3 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Target Type
                  </p>
                  <p className="font-medium text-foreground">
                    {selectedEvent.targetType}
                  </p>
                </div>
              </div>

              {selectedEvent.targetId ? (
                <div className="rounded-xl border bg-card p-3 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Target ID
                  </p>
                  <p className="font-mono text-xs text-foreground select-all break-all">
                    {selectedEvent.targetId}
                  </p>
                </div>
              ) : null}

              {selectedEvent.courseId ? (
                <div className="rounded-xl border bg-card p-3 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Course ID
                  </p>
                  <p className="font-mono text-xs text-foreground select-all break-all">
                    {selectedEvent.courseId}
                  </p>
                </div>
              ) : null}

              <div className="rounded-xl border bg-card p-3 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Timestamp
                </p>
                <p className="font-medium text-foreground">
                  {dateFormatter.format(new Date(selectedEvent.createdAt))}
                </p>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
