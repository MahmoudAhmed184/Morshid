import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  BookOpenIcon,
  FileTextIcon,
  HistoryIcon,
  UsersIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DataTableState } from '@/components/ui/custom/data-table-state'
import { EmptyState } from '@/components/ui/custom/empty-state'
import { AdminPanel } from '../components/admin-panel'
import { AdminStatusBadge } from '../components/admin-status-badge'
import {
  adminAuditQueryOptions,
  adminCoursesQueryOptions,
  adminMaterialsQueryOptions,
  adminUsersQueryOptions,
} from '../data/admin-ops.queries'

const sections = [
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

export function AdminDashboardPage() {
  const usersQuery = useQuery(adminUsersQueryOptions())
  const coursesQuery = useQuery(adminCoursesQueryOptions())
  const materialsQuery = useQuery(adminMaterialsQueryOptions())
  const auditQuery = useQuery(adminAuditQueryOptions())

  const metrics = [
    ['Users', usersQuery.data?.length],
    ['Courses', coursesQuery.data?.length],
    ['Materials', materialsQuery.data?.length],
  ] as const

  return (
    <div>
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        {metrics.map(([label, value]) => (
          <AdminPanel key={label} className="p-5">
            <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
              {label}
            </p>
            <p className="mt-3 text-3xl font-semibold text-foreground">
              {value ?? '--'}
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
                      {event.action}
                    </p>
                    <AdminStatusBadge status={event.severity} />
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {event.actor} on {event.target}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {event.createdAt}
                  </p>
                </div>
              ))}
            </div>
          </DataTableState>
        </AdminPanel>
      </div>
    </div>
  )
}
