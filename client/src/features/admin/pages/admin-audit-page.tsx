import { useQuery } from '@tanstack/react-query'
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
import { AdminStatusBadge } from '../components/admin-status-badge'
import { adminAuditQueryOptions } from '../data/admin-ops.queries'

export function AdminAuditPage() {
  const auditQuery = useQuery(adminAuditQueryOptions())

  return (
    <div>
      <PageHeader
        className="mb-8"
        eyebrow="Governance"
        title="Recent Audit Activity"
        description="Track high-signal administrative events until the full audit API is available."
        actions={
          <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground">
            <ShieldCheckIcon className="size-4 text-emerald-500" />
            RBAC monitored
          </div>
        }
      />

      <AdminPanel>
        <DataTableState
          isLoading={auditQuery.isPending}
          isError={auditQuery.isError}
          isEmpty={auditQuery.data?.length === 0}
          emptyTitle="No audit events found"
          emptyDescription="Recent audit events returned by the API will appear here."
        >
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                {['Event', 'Actor', 'Target', 'Severity', 'Created'].map(
                  (header) => (
                    <TableHead
                      key={header}
                      className="h-14 px-6 text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase"
                    >
                      {header}
                    </TableHead>
                  ),
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditQuery.data?.map((event) => (
                <TableRow
                  key={event.id}
                  className="border-border hover:bg-muted/40"
                >
                  <TableCell className="px-6 py-5">
                    <p className="font-medium text-foreground">
                      {event.action}
                    </p>
                    <p className="text-xs text-muted-foreground">{event.id}</p>
                  </TableCell>
                  <TableCell className="px-6 py-5">{event.actor}</TableCell>
                  <TableCell className="px-6 py-5">{event.target}</TableCell>
                  <TableCell className="px-6 py-5">
                    <AdminStatusBadge status={event.severity} />
                  </TableCell>
                  <TableCell className="px-6 py-5">{event.createdAt}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataTableState>
      </AdminPanel>
    </div>
  )
}
