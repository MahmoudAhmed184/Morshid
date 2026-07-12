import { Link } from '@tanstack/react-router'
import {
  BookOpenIcon,
  ClipboardListIcon,
  FileTextIcon,
  HistoryIcon,
  UsersIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DataTableState } from '@/components/ui/custom/data-table-state'
import { EmptyState } from '@/components/ui/custom/empty-state'
import { AdminPanel } from '../components/admin-panel'
import { AdminStatusBadge } from '../components/admin-status-badge'
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
  const isLoading =
    usersQuery.isPending || coursesQuery.isPending || auditQuery.isPending
  const isError =
    usersQuery.isError || coursesQuery.isError || auditQuery.isError

  const metrics = [
    ['Users', users.length],
    ['Courses', courses.length],
    ['Materials', materialCount],
  ] as const

  return (
    <DataTableState
      isLoading={isLoading}
      isError={isError}
      isEmpty={users.length === 0 && courses.length === 0}
      onRetry={() =>
        void Promise.all([
          usersQuery.refetch(),
          coursesQuery.refetch(),
          auditQuery.refetch(),
        ])
      }
      isRetrying={
        usersQuery.isFetching ||
        coursesQuery.isFetching ||
        auditQuery.isFetching
      }
      emptyTitle="No admin data found"
      emptyDescription="Users and courses will appear after the P0 seed or API setup is complete."
    >
      <div>
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          {metrics.map(([label, value]) => (
            <AdminPanel key={label} className="p-5">
              <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                {label}
              </p>
              <p className="mt-3 text-3xl font-semibold text-foreground">
              {value}
              </p>
            </AdminPanel>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
          <div className="grid gap-4 md:grid-cols-2">
            {sections.map((section) => {
              const Icon = section.icon

              return (
                <AdminPanel key={section.to} className="p-5">
                  <div className="mb-5 flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <h2 className="text-lg font-semibold text-foreground">
                    {section.title}
                  </h2>
                  <p className="mt-2 min-h-12 text-sm leading-6 text-muted-foreground">
                    {section.description}
                  </p>
                  <Button
                    nativeButton={false}
                    render={<Link to={section.to} />}
                    className="mt-5"
                  >
                    Open section
                  </Button>
                </AdminPanel>
              )
            })}
          </div>

          <AdminPanel className="p-5">
            <div className="mb-5 flex items-center gap-3">
              <HistoryIcon className="size-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">
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
              <div className="space-y-4">
                {auditQuery.data?.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-lg border border-border bg-muted/20 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-foreground">
                        {event.action.replaceAll('.', ' ')}
                      </p>
                      <AdminStatusBadge
                        status="ACTIVE"
                        label={event.targetType}
                      />
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {event.actor?.displayName ?? 'System'}
                      {event.targetId ? ` on ${event.targetId}` : ''}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {auditDateFormatter.format(new Date(event.createdAt))}
                    </p>
                  </div>
                ))}
              </div>
            </DataTableState>
          </AdminPanel>
        </div>
      </div>
    </DataTableState>
  )
}
