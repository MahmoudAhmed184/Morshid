import { ShieldCheckIcon } from 'lucide-react'

import { DataTableState } from '@/components/ui/custom/data-table-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AdminPanel } from '../components/admin-panel'
import { PageHeader } from '@/components/ui/custom/page-header'
import { useAdminAudit } from '../hooks/use-admin-audit'

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

export function AdminAuditPage() {
  const auditQuery = useAdminAudit()

  return (
    <div>
      <PageHeader
        className="mb-8"
        eyebrow="Governance"
        title="Recent Audit Activity"
        description="Track recent authentication, authorization, account, assignment, and material events."
        actions={
          <div className="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2 text-sm font-medium text-[color-mix(in_oklab,var(--success)_74%,var(--foreground))] ring-1 ring-success/20 dark:text-success">
            <ShieldCheckIcon className="size-4" />
            RBAC monitored
          </div>
        }
      />

      <AdminPanel>
        <DataTableState
          isLoading={auditQuery.isPending}
          isError={auditQuery.isError}
          isEmpty={auditQuery.data?.length === 0}
          onRetry={() => void auditQuery.refetch()}
          isRetrying={auditQuery.isFetching}
          emptyTitle="No audit events found"
          emptyDescription="Recent audit events returned by the API will appear here."
        >
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow>
                {['Event', 'Actor', 'Target type', 'Course', 'Created'].map(
                  (header) => (
                    <TableHead
                      key={header}
                      className="h-11 px-4 first:pl-6 last:pr-6"
                    >
                      {header}
                    </TableHead>
                  ),
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditQuery.data?.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="px-4 py-3.5 first:pl-6">
                    <p className="font-medium text-foreground">
                      {event.action}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {event.id}
                    </p>
                  </TableCell>
                  <TableCell className="px-4 py-3.5">
                    {event.actor?.displayName ?? 'System'}
                  </TableCell>
                  <TableCell className="px-4 py-3.5">
                    {event.targetType}
                    {event.targetId ? (
                      <p className="font-mono text-xs text-muted-foreground">
                        {event.targetId}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="px-4 py-3.5 text-muted-foreground">
                    {event.courseId ?? '—'}
                  </TableCell>
                  <TableCell className="px-4 py-3.5 text-muted-foreground tabular-nums last:pr-6">
                    {dateFormatter.format(new Date(event.createdAt))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataTableState>
      </AdminPanel>
    </div>
  )
}
