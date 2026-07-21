import { Link } from '@tanstack/react-router'
import {
  BookOpenIcon,
  ClipboardListIcon,
  FileTextIcon,
  HistoryIcon,
  UsersIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTableState } from '@/components/ui/custom/data-table-state'
import { EmptyState } from '@/components/ui/custom/empty-state'
import { StatCard } from '@/components/ui/custom/stat-card'
import { AdminPanel } from '../components/admin-panel'
import { useAdminAudit } from '../hooks/use-admin-audit'
import { useAdminCourses } from '../hooks/use-admin-courses'
import { useAdminUsers } from '../hooks/use-admin-users'

const sections = [
  {
    title: 'Assignments',
    description: 'Manage student and instructor access to course shells.',
    to: '/admin/assignments',
    icon: ClipboardListIcon,
  },
  {
    title: 'Users',
    description: 'Create accounts, reset access, and manage active status.',
    to: '/admin/users',
    icon: UsersIcon,
  },
  {
    title: 'Courses',
    description: 'Track course ownership, enrollment, and material counts.',
    to: '/admin/courses',
    icon: BookOpenIcon,
  },
  {
    title: 'Materials',
    description: 'Audit learning assets across course shells.',
    to: '/admin/materials',
    icon: FileTextIcon,
  },
] as const

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
  const isLoading = usersQuery.isPending || coursesQuery.isPending
  const isError = usersQuery.isError || coursesQuery.isError

  const metrics = [
    {
      label: 'Users loaded',
      value: users.length,
      icon: <UsersIcon aria-hidden />,
      tone: 'primary',
      description: 'Managed student and instructor accounts',
    },
    {
      label: 'Courses',
      value: courses.length,
      icon: <BookOpenIcon aria-hidden />,
      tone: 'info',
      description: 'Active course shells across the platform',
    },
    {
      label: 'Materials',
      value: materialCount,
      icon: <FileTextIcon aria-hidden />,
      tone: 'gold',
      description: 'Learning assets ingested into courses',
    },
  ] as const

  return (
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
      <div>
        <div className="mb-6 grid gap-4 md:grid-cols-3">
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

        <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
          <div className="grid gap-4 md:grid-cols-2">
            {sections.map((section) => {
              const Icon = section.icon

              return (
                <AdminPanel
                  key={section.to}
                  className="flex flex-col p-5 transition-shadow hover:shadow-md"
                >
                  <div className="mb-5 flex size-11 items-center justify-center rounded-sm bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <h2 className="text-base font-semibold text-foreground">
                    {section.title}
                  </h2>
                  <p className="mt-2 min-h-12 text-sm leading-6 text-muted-foreground">
                    {section.description}
                  </p>
                  <Button
                    nativeButton={false}
                    variant="outline"
                    render={<Link to={section.to} />}
                    className="mt-5 w-fit"
                  >
                    Open section
                  </Button>
                </AdminPanel>
              )
            })}
          </div>

          <AdminPanel className="p-5">
            <div className="mb-5 flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <HistoryIcon className="size-4" />
              </span>
              <h2 className="text-base font-semibold text-foreground">
                Recent Audit Activity
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
                    className="rounded-lg bg-muted/40 p-3.5 ring-1 ring-foreground/5 transition-colors hover:bg-muted/60"
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
                    <p className="mt-1.5 text-xs text-muted-foreground tabular-nums">
                      {auditDateFormatter.format(new Date(event.createdAt))}
                    </p>
                  </li>
                ))}
              </ol>
            </DataTableState>
          </AdminPanel>
        </div>
      </div>
    </DataTableState>
  )
}
