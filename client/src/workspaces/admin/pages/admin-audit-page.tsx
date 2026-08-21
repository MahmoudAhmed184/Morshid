import {
  BotIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  CopyIcon,
  EyeIcon,
  FileTextIcon,
  KeyRoundIcon,
  LayersIcon,
  RotateCcwIcon,
  ScrollTextIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  UserCheckIcon,
  UserIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getUserInitials } from '@/components/branding/get-user-initials'
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
import { AdminPanel } from '@/workspaces/admin/components/admin-panel'
import { useAudit } from '@/workspaces/admin/audit/use-audit'
import { useCourseAdministration } from '@/workspaces/admin/use-course-administration'
import { useManagedUsers } from '@/workspaces/admin/users/use-user-management'
import type { AuditEvent } from '@/features/audit/audit.schema'

const PAGE_SIZE = 20

const DATE_PRESET_OPTIONS = [
  { value: 'ALL', label: 'All time' },
  { value: 'TODAY', label: 'Today' },
  { value: 'LAST_WEEK', label: 'Last week' },
  { value: 'LAST_MONTH', label: 'Last month' },
  { value: 'CUSTOM', label: 'Custom range...' },
]

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
  { value: 'auth.login_succeeded', label: 'Auth: Login succeeded' },
  { value: 'auth.login_failed', label: 'Auth: Login failed' },
  { value: 'auth.logout', label: 'Auth: Logout' },
  { value: 'auth.password_changed', label: 'Auth: Password changed' },
  { value: 'auth.profile_updated', label: 'Auth: Profile updated' },
  { value: 'auth.session_revoked', label: 'Auth: Session revoked' },
  { value: 'access.rbac_denied', label: 'Access: RBAC denied' },
  {
    value: 'access.course_boundary_denied',
    label: 'Access: Course boundary denied',
  },
  { value: 'admin.account_created', label: 'Admin: Account created' },
  { value: 'admin.account_updated', label: 'Admin: Account updated' },
  { value: 'admin.account_disabled', label: 'Admin: Account disabled' },
  { value: 'admin.account_enabled', label: 'Admin: Account enabled' },
  { value: 'admin.course_created', label: 'Admin: Course created' },
  { value: 'admin.course_updated', label: 'Admin: Course updated' },
  { value: 'admin.course_archived', label: 'Admin: Course archived' },
  { value: 'admin.course_member_added', label: 'Admin: Member added' },
  {
    value: 'admin.course_member_removed',
    label: 'Admin: Member removed',
  },
  { value: 'material.upload_succeeded', label: 'Material: Upload succeeded' },
  { value: 'material.upload_failed', label: 'Material: Upload failed' },
  { value: 'material.updated', label: 'Material: Updated' },
  { value: 'material.deleted', label: 'Material: Deleted' },
  { value: 'review.case_created', label: 'Review: Case created' },
  { value: 'review.case_resolved', label: 'Review: Case resolved' },
  { value: 'review.case_rejected', label: 'Review: Case rejected' },
]

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function getEventMeta(action: string) {
  if (action.startsWith('auth.')) {
    const isDestructive =
      action.includes('failed') || action.includes('revoked')
    return {
      category: 'Auth',
      badgeVariant: isDestructive
        ? ('destructive' as const)
        : ('info' as const),
      icon: KeyRoundIcon,
    }
  }
  if (action.startsWith('access.')) {
    return {
      category: 'Access',
      badgeVariant: 'destructive' as const,
      icon: ShieldAlertIcon,
    }
  }
  if (action.startsWith('admin.')) {
    const isDestructive =
      action.includes('disabled') || action.includes('removed')
    return {
      category: 'Admin',
      badgeVariant: isDestructive ? ('warning' as const) : ('gold' as const),
      icon: UserCheckIcon,
    }
  }
  if (action.startsWith('material.')) {
    const isDestructive =
      action.includes('failed') || action.includes('deleted')
    return {
      category: 'Material',
      badgeVariant: isDestructive ? ('warning' as const) : ('success' as const),
      icon: FileTextIcon,
    }
  }
  if (action.startsWith('review.')) {
    return {
      category: 'Review',
      badgeVariant: 'secondary' as const,
      icon: LayersIcon,
    }
  }
  return {
    category: 'System',
    badgeVariant: 'default' as const,
    icon: BotIcon,
  }
}

function formatTargetType(type: string): string {
  switch (type) {
    case 'auth_session':
      return 'Auth Session'
    case 'user':
      return 'User'
    case 'course':
      return 'Course'
    case 'material':
      return 'Material'
    case 'chat_session':
      return 'Chat Session'
    case 'course_membership':
      return 'Membership'
    case 'review_case':
      return 'Review Case'
    case 'system':
      return 'System'
    default:
      return type.replace(/_/g, ' ')
  }
}

export function AdminAuditPage() {
  const [dateReference] = useState(() => Date.now())
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const [datePreset, setDatePreset] = useState('ALL')
  const [targetTypeFilter, setTargetTypeFilter] = useState('ALL')
  const [actionFilter, setActionFilter] = useState('ALL')
  const [courseFilter, setCourseFilter] = useState('ALL')
  const [actorFilter, setActorFilter] = useState('ALL')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

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

  const coursesMap = useMemo(() => {
    const map = new Map<string, { code: string; title: string }>()
    for (const c of coursesQuery.data ?? []) {
      map.set(c.id, { code: c.code, title: c.title })
    }
    return map
  }, [coursesQuery.data])

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

  const computedDates = useMemo(() => {
    if (datePreset === 'TODAY') {
      const start = new Date()
      start.setHours(0, 0, 0, 0)
      return {
        startDate: start.toISOString(),
        endDate: undefined,
      }
    }
    if (datePreset === 'LAST_WEEK') {
      const start = new Date(dateReference - 7 * 24 * 60 * 60 * 1000)
      return {
        startDate: start.toISOString(),
        endDate: undefined,
      }
    }
    if (datePreset === 'LAST_MONTH') {
      const start = new Date(dateReference - 30 * 24 * 60 * 60 * 1000)
      return {
        startDate: start.toISOString(),
        endDate: undefined,
      }
    }
    if (datePreset === 'CUSTOM') {
      return {
        startDate: startDate.length > 0 ? startDate : undefined,
        endDate: endDate.length > 0 ? endDate : undefined,
      }
    }
    return {
      startDate: undefined,
      endDate: undefined,
    }
  }, [datePreset, startDate, endDate, dateReference])

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
      startDate: computedDates.startDate,
      endDate: computedDates.endDate,
    }),
    [
      page,
      debouncedSearch,
      targetTypeFilter,
      actionFilter,
      courseFilter,
      actorFilter,
      computedDates,
    ],
  )

  const auditQuery = useAudit(auditQueryParams)
  const events = auditQuery.data?.events ?? []
  const total = auditQuery.data?.total ?? 0
  const totalPages = auditQuery.data?.totalPages ?? 1

  const hasActiveFilters =
    search.trim().length > 0 ||
    datePreset !== 'ALL' ||
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

  const handleDatePresetChange = (value: string | null) => {
    setDatePreset(value ?? 'ALL')
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
    setDatePreset('ALL')
    setTargetTypeFilter('ALL')
    setActionFilter('ALL')
    setCourseFilter('ALL')
    setActorFilter('ALL')
    setStartDate('')
    setEndDate('')
    setPage(1)
  }

  const copyToClipboard = (text: string, idKey: string) => {
    void navigator.clipboard.writeText(text)
    setCopiedId(idKey)
    setTimeout(() => setCopiedId(null), 2000)
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
          searchClassName="w-full sm:w-56 lg:w-64"
          filters={
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-wrap sm:flex-nowrap">
              {/* Date Filter Dropdown */}
              <Select
                value={datePreset}
                onValueChange={handleDatePresetChange}
                items={DATE_PRESET_OPTIONS}
              >
                <SelectTrigger
                  className="h-9 px-2.5 text-xs rounded-lg border-border/80 w-auto min-w-[110px]"
                  aria-label="Date Range"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <CalendarIcon className="size-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">
                      {DATE_PRESET_OPTIONS.find((o) => o.value === datePreset)
                        ?.label ?? 'All time'}
                    </span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL" className="text-xs py-1.5">
                    All time
                  </SelectItem>
                  <SelectItem value="TODAY" className="text-xs py-1.5">
                    Today
                  </SelectItem>
                  <SelectItem value="LAST_WEEK" className="text-xs py-1.5">
                    Last week
                  </SelectItem>
                  <SelectItem value="LAST_MONTH" className="text-xs py-1.5">
                    Last month
                  </SelectItem>
                  <SelectItem value="CUSTOM" className="text-xs py-1.5">
                    Custom range...
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Custom Date Inputs (only when Custom range is active) */}
              {datePreset === 'CUSTOM' ? (
                <div className="flex items-center gap-1.5 rounded-lg border border-border/80 bg-background/50 px-2 h-9 shrink-0">
                  <span className="text-[11px] font-medium text-muted-foreground select-none">
                    From:
                  </span>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={handleStartDateChange}
                    aria-label="Start date"
                    className="h-7 px-1 text-xs border-0 bg-transparent rounded-none focus-visible:ring-0 w-28 text-foreground"
                  />
                  <span className="text-[11px] font-medium text-muted-foreground select-none">
                    To:
                  </span>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={handleEndDateChange}
                    aria-label="End date"
                    className="h-7 px-1 text-xs border-0 bg-transparent rounded-none focus-visible:ring-0 w-28 text-foreground"
                  />
                </div>
              ) : null}

              {/* Target Type Filter */}
              <Select
                value={targetTypeFilter}
                onValueChange={handleTargetTypeChange}
                items={TARGET_TYPE_OPTIONS}
              >
                <SelectTrigger
                  className="h-9 px-2.5 text-xs rounded-lg border-border/80 w-auto min-w-[120px]"
                  aria-label="Target Type"
                >
                  <span className="truncate">
                    {targetTypeFilter === 'ALL'
                      ? 'All targets'
                      : formatTargetType(targetTypeFilter)}
                  </span>
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

              {/* Action Filter */}
              <Select
                value={actionFilter}
                onValueChange={handleActionChange}
                items={ACTION_OPTIONS}
              >
                <SelectTrigger
                  className="h-9 px-2.5 text-xs rounded-lg border-border/80 w-auto min-w-[110px] max-w-[160px]"
                  aria-label="Action"
                >
                  <span className="truncate">
                    {actionFilter === 'ALL'
                      ? 'All actions'
                      : (ACTION_OPTIONS.find((a) => a.value === actionFilter)
                          ?.label ?? actionFilter)}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {ACTION_OPTIONS.map((option) => (
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

              {/* Course Filter */}
              {courseOptions.length > 1 ? (
                <Select
                  value={courseFilter}
                  onValueChange={handleCourseChange}
                  items={courseOptions}
                >
                  <SelectTrigger
                    className="h-9 px-2.5 text-xs rounded-lg border-border/80 w-auto min-w-[110px] max-w-[150px]"
                    aria-label="Course"
                  >
                    <span className="truncate">
                      {courseFilter === 'ALL'
                        ? 'All courses'
                        : (coursesMap.get(courseFilter)?.code ??
                          'Selected course')}
                    </span>
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

              {/* Actor Filter */}
              {actorOptions.length > 1 ? (
                <Select
                  value={actorFilter}
                  onValueChange={handleActorChange}
                  items={actorOptions}
                >
                  <SelectTrigger
                    className="h-9 px-2.5 text-xs rounded-lg border-border/80 w-auto min-w-[105px] max-w-[150px]"
                    aria-label="Actor"
                  >
                    <span className="truncate">
                      {actorFilter === 'ALL'
                        ? 'All actors'
                        : (actorOptions.find((a) => a.value === actorFilter)
                            ?.label ?? 'Selected actor')}
                    </span>
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

              {/* Clear Filters Button */}
              {hasActiveFilters ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResetFilters}
                  aria-label="Clear filters"
                  className="h-9 px-2.5 gap-1.5 text-xs text-muted-foreground hover:text-foreground shrink-0"
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
          {/* Mobile Compact List (< md) */}
          <div className="divide-y divide-border md:hidden">
            {events.map((event) => {
              const meta = getEventMeta(event.action)

              return (
                <div
                  key={event.id}
                  className="flex items-center justify-between p-3.5 gap-3 hover:bg-secondary/20 transition-colors"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={meta.badgeVariant}
                        className="text-[10px] px-1.5 py-0 h-4.5"
                      >
                        {meta.category}
                      </Badge>
                      <p className="font-semibold text-foreground truncate text-sm">
                        {event.action}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground pt-0.5">
                      <span>By: {event.actor?.displayName ?? 'System'}</span>
                      <span>•</span>
                      <span>Target: {formatTargetType(event.targetType)}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground/80 flex items-center gap-1 pt-0.5">
                      <ClockIcon className="size-3 text-muted-foreground/60" />
                      <span>
                        {dateFormatter.format(new Date(event.createdAt))}
                      </span>
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
              )
            })}
          </div>

          {/* Desktop Table (>= md) */}
          <div className="hidden md:block w-full max-h-[65vh] overflow-x-auto overflow-y-auto scrollbar-themed">
            <Table className="w-full min-w-[880px]">
              <TableHeader className="sticky top-0 z-10 bg-secondary/80 backdrop-blur-md">
                <TableRow>
                  <TableHead className="w-[32%] min-w-[240px] smallcaps-label h-11 px-4 pl-6">
                    Event
                  </TableHead>
                  <TableHead className="w-[20%] min-w-[160px] smallcaps-label h-11 px-4">
                    Actor
                  </TableHead>
                  <TableHead className="w-[18%] min-w-[150px] smallcaps-label h-11 px-4">
                    Target
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
                {events.map((event) => {
                  const meta = getEventMeta(event.action)
                  const courseInfo = event.courseId
                    ? coursesMap.get(event.courseId)
                    : null

                  return (
                    <TableRow
                      key={event.id}
                      className="h-[56px] hover:bg-secondary/30 transition-colors"
                    >
                      <TableCell className="px-4 py-3 pl-6 min-w-0">
                        <div className="flex items-center gap-2.5">
                          <Badge
                            variant={meta.badgeVariant}
                            className="shrink-0 text-[10px] px-1.5 py-0 h-5"
                          >
                            {meta.category}
                          </Badge>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground text-sm truncate max-w-[260px]">
                              {event.action}
                            </p>
                            <p className="font-mono text-[11px] text-muted-foreground/80 truncate max-w-[260px]">
                              {event.id}
                            </p>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="px-4 py-3 min-w-0">
                        {event.actor ? (
                          <div className="flex items-center gap-2">
                            <div className="size-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                              {getUserInitials(event.actor.displayName)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-foreground text-sm truncate max-w-[140px]">
                                {event.actor.displayName}
                              </p>
                              <p className="text-[11px] text-muted-foreground truncate max-w-[140px]">
                                {event.actor.email}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="size-7 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs shrink-0">
                              <BotIcon className="size-3.5" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-foreground text-sm">
                                System
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                Automated
                              </p>
                            </div>
                          </div>
                        )}
                      </TableCell>

                      <TableCell className="px-4 py-3 min-w-0">
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center rounded-md bg-secondary/80 px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                            {formatTargetType(event.targetType)}
                          </span>
                          {event.targetId ? (
                            <p className="font-mono text-[11px] text-muted-foreground truncate max-w-[160px]">
                              {event.targetId}
                            </p>
                          ) : null}
                        </div>
                      </TableCell>

                      <TableCell className="px-4 py-3 text-muted-foreground min-w-0">
                        {courseInfo ? (
                          <div className="min-w-0">
                            <p className="font-medium text-foreground text-xs truncate max-w-[120px]">
                              {courseInfo.code}
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate max-w-[120px]">
                              {courseInfo.title}
                            </p>
                          </div>
                        ) : event.courseId ? (
                          <p className="font-mono text-xs truncate max-w-[120px]">
                            {event.courseId}
                          </p>
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </TableCell>

                      <TableCell className="px-4 py-3 text-muted-foreground tabular-nums text-right whitespace-nowrap text-xs">
                        {dateFormatter.format(new Date(event.createdAt))}
                      </TableCell>

                      <TableCell className="px-4 py-3 pr-6 text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setSelectedEvent(event)}
                          aria-label="View event details"
                          className="text-muted-foreground hover:text-foreground hover:bg-secondary/60 rounded-lg"
                        >
                          <EyeIcon className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
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
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg sm:max-w-xl p-0 overflow-hidden">
          <DialogHeader className="p-5 pb-3 border-b bg-muted/20">
            <DialogTitle className="flex items-center gap-2.5 text-lg font-semibold">
              <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <ScrollTextIcon className="size-4.5" />
              </div>
              <span>Audit Event Details</span>
            </DialogTitle>
          </DialogHeader>

          {selectedEvent ? (
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Event Action Card */}
              <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Badge
                    variant={getEventMeta(selectedEvent.action).badgeVariant}
                  >
                    {getEventMeta(selectedEvent.action).category}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {dateFormatter.format(new Date(selectedEvent.createdAt))}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Event Action
                  </p>
                  <p className="font-semibold text-foreground text-base pt-0.5">
                    {selectedEvent.action}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50">
                  <span className="font-mono text-xs text-muted-foreground truncate">
                    ID: {selectedEvent.id}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() =>
                      copyToClipboard(selectedEvent.id, 'event-id')
                    }
                    aria-label="Copy event ID"
                    className="text-muted-foreground hover:text-foreground shrink-0"
                  >
                    {copiedId === 'event-id' ? (
                      <CheckIcon className="size-3.5 text-success" />
                    ) : (
                      <CopyIcon className="size-3.5" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Actor & Target Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl border bg-card p-3.5 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <UserIcon className="size-3.5" />
                    <span>Actor</span>
                  </div>
                  {selectedEvent.actor ? (
                    <div>
                      <p className="font-semibold text-foreground text-sm">
                        {selectedEvent.actor.displayName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selectedEvent.actor.email}
                      </p>
                      <p className="font-mono text-[11px] text-muted-foreground/70 truncate pt-1">
                        {selectedEvent.actor.id}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="font-semibold text-foreground text-sm">
                        System
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Automated background process
                      </p>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border bg-card p-3.5 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <LayersIcon className="size-3.5" />
                    <span>Target Type</span>
                  </div>
                  <div>
                    <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
                      {formatTargetType(selectedEvent.targetType)}
                    </span>
                    <p className="font-mono text-xs text-muted-foreground pt-1">
                      {selectedEvent.targetType}
                    </p>
                  </div>
                </div>
              </div>

              {/* Target ID Card */}
              {selectedEvent.targetId ? (
                <div className="rounded-xl border bg-card p-3.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Target ID
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() =>
                        copyToClipboard(selectedEvent.targetId!, 'target-id')
                      }
                      aria-label="Copy target ID"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {copiedId === 'target-id' ? (
                        <CheckIcon className="size-3.5 text-success" />
                      ) : (
                        <CopyIcon className="size-3.5" />
                      )}
                    </Button>
                  </div>
                  <p className="font-mono text-xs text-foreground select-all break-all bg-muted/40 p-2 rounded-lg">
                    {selectedEvent.targetId}
                  </p>
                </div>
              ) : null}

              {/* Course ID Card */}
              {selectedEvent.courseId ? (
                <div className="rounded-xl border bg-card p-3.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Course Reference
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() =>
                        copyToClipboard(selectedEvent.courseId!, 'course-id')
                      }
                      aria-label="Copy course ID"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {copiedId === 'course-id' ? (
                        <CheckIcon className="size-3.5 text-success" />
                      ) : (
                        <CopyIcon className="size-3.5" />
                      )}
                    </Button>
                  </div>
                  {coursesMap.get(selectedEvent.courseId) ? (
                    <p className="font-semibold text-sm text-foreground">
                      {coursesMap.get(selectedEvent.courseId)!.code} —{' '}
                      {coursesMap.get(selectedEvent.courseId)!.title}
                    </p>
                  ) : null}
                  <p className="font-mono text-xs text-muted-foreground select-all break-all bg-muted/40 p-2 rounded-lg">
                    {selectedEvent.courseId}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
