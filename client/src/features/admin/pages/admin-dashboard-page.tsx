import { Link } from '@tanstack/react-router'
import {
  BookOpenIcon,
  ChevronRightIcon,
  FileTextIcon,
  GraduationCapIcon,
  ScrollTextIcon,
  UsersIcon,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { DataTableState } from '@/components/ui/custom/data-table-state'
import { EmptyState } from '@/components/ui/custom/empty-state'
import { PageHeader } from '@/components/ui/custom/page-header'
import { StatCard } from '@/components/ui/custom/stat-card'
import { cn } from '@/lib/utils'
import { AdminPanel } from '../components/admin-panel'
import { useAdminAudit } from '../hooks/use-admin-audit'
import { useAdminCourses } from '../hooks/use-admin-courses'
import { useAdminUsers } from '../hooks/use-admin-users'

type QuickNavTone = 'neutral' | 'gold' | 'success'

const quickNav: {
  title: string
  to: string
  icon: LucideIcon
  tone: QuickNavTone
}[] = [
  { title: 'Users', to: '/admin/users', icon: UsersIcon, tone: 'neutral' },
  {
    title: 'Courses',
    to: '/admin/courses',
    icon: BookOpenIcon,
    tone: 'neutral',
  },
  {
    title: 'Materials',
    to: '/admin/materials',
    icon: FileTextIcon,
    tone: 'gold',
  },
  {
    title: 'Audit Logs',
    to: '/admin/audit',
    icon: ScrollTextIcon,
    tone: 'success',
  },
]

const quickNavChip: Record<QuickNavTone, string> = {
  neutral: 'bg-secondary text-foreground',
  gold: 'bg-gold/10 text-gold',
  success: 'bg-success/10 text-success',
}

const auditDateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

export function AdminDashboardPage() {
  const usersQuery = useAdminUsers()
  const coursesQuery = useAdminCourses()
  const auditQuery = useAdminAudit(5)
  const users = usersQuery.data?.pages.flatMap((page) => page.users) ?? []
  const courses = coursesQuery.data ?? []
  const materialCount = courses.reduce(
    (total, course) => total + course.adminMetadata.materialCount,
    0,
  )
  const studentCount = users.filter((user) => user.role === 'STUDENT').length
  const instructorCount = users.filter(
    (user) => user.role === 'INSTRUCTOR',
  ).length
  const isLoading = usersQuery.isPending || coursesQuery.isPending
  const isError = usersQuery.isError || coursesQuery.isError

  const metrics = [
    {
      label: 'Students',
      value: studentCount,
      icon: <GraduationCapIcon aria-hidden />,
      tone: 'gold',
      description: 'Managed student accounts loaded',
    },
    {
      label: 'Instructors',
      value: instructorCount,
      icon: <UsersIcon aria-hidden />,
      tone: 'default',
      description: 'Managed instructor accounts loaded',
    },
    {
      label: 'Courses',
      value: courses.length,
      icon: <BookOpenIcon aria-hidden />,
      tone: 'gold',
      description: 'Active course shells across the platform',
    },
    {
      label: 'Materials',
      value: materialCount,
      icon: <FileTextIcon aria-hidden />,
      tone: 'success',
      description: 'Learning assets ingested into courses',
    },
  ] as const

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="THE LEDGER"
        title="System overview."
        description="Platform-wide identity, enrollment, and content activity."
      />

      <DataTableState
        isLoading={isLoading}
        isError={isError}
        isEmpty={users.length === 0 && courses.length === 0}
        onRetry={() =>
          void Promise.all([usersQuery.refetch(), coursesQuery.refetch()])
        }
        isRetrying={usersQuery.isFetching || coursesQuery.isFetching}
        emptyTitle="No admin data found"
        emptyDescription="Users and courses will appear after the P0 seed or API setup is complete."
      >
        <div className="flex flex-col gap-6">
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <StatCard
                key={metric.label}
                label={metric.label}
                value={<span className="tabular-nums">{metric.value}</span>}
                icon={metric.icon}
                tone={metric.tone}
                description={metric.description}
              />
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <AdminPanel className="p-5 lg:col-span-2">
              <div className="mb-5 flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-lg bg-secondary text-foreground [&_svg]:size-4">
                  <ScrollTextIcon />
                </span>
                <h2 className="text-base font-semibold text-foreground">
                  Recent activity
                </h2>
              </div>
              <DataTableState
                isLoading={auditQuery.isPending}
                isError={auditQuery.isError}
                isEmpty={auditQuery.data?.length === 0}
                onRetry={() => void auditQuery.refetch()}
                isRetrying={auditQuery.isFetching}
                empty={
                  <EmptyState
                    title="No audit activity"
                    description="Operational events will appear here once APIs start returning activity."
                    className="min-h-52"
                  />
                }
              >
                <ol className="space-y-2.5">
                  {auditQuery.data?.map((event) => (
                    <li
                      key={event.id}
                      className="rounded-xl bg-secondary/30 p-3.5 transition-colors hover:bg-secondary/50"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-medium text-foreground">
                          {event.action.replaceAll('.', ' ')}
                        </p>
                        <Badge variant="secondary" className="shrink-0">
                          {event.targetType}
                        </Badge>
                      </div>
                      <p className="mt-1.5 truncate text-sm text-muted-foreground">
                        {event.actor?.displayName ?? 'System'}
                        {event.targetId ? ` on ${event.targetId}` : ''}
                      </p>
                      <p className="footnote mt-1.5 tabular-nums">
                        {auditDateFormatter.format(new Date(event.createdAt))}
                      </p>
                    </li>
                  ))}
                </ol>
              </DataTableState>
            </AdminPanel>

            <AdminPanel className="p-5">
              <h2 className="smallcaps-label mb-4 px-1">Quick navigation</h2>
              <nav
                className="flex flex-col gap-1"
                aria-label="Quick navigation"
              >
                {quickNav.map((item) => {
                  const Icon = item.icon

                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-secondary/60"
                    >
                      <span
                        className={cn(
                          'flex size-9 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4',
                          quickNavChip[item.tone],
                        )}
                        aria-hidden
                      >
                        <Icon />
                      </span>
                      <span className="flex-1 text-sm font-medium text-foreground">
                        {item.title}
                      </span>
                      <ChevronRightIcon
                        className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </Link>
                  )
                })}
              </nav>
            </AdminPanel>
          </div>
        </div>
      </DataTableState>
    </div>
  )
}
