import { EyeIcon, ScrollTextIcon, ShieldCheckIcon } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { DataTableState } from '@/components/ui/custom/data-table-state'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { useAudit } from '@/features/audit/use-audit'
import type { AuditEvent } from '@/features/audit/audit.schema'

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

export function AdminAuditPage() {
  const auditQuery = useAudit()
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null)

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
        <DataTableState
          isLoading={auditQuery.isPending}
          isError={auditQuery.isError}
          isEmpty={auditQuery.data?.length === 0}
          onRetry={() => void auditQuery.refetch()}
          isRetrying={auditQuery.isFetching}
          emptyTitle="No audit events found"
          emptyDescription="Recent audit events returned by the API will appear here."
        >
          {/* Mobile Compact List (< md) — No Horizontal Scroll */}
          <div className="divide-y divide-border md:hidden">
            {auditQuery.data?.map((event) => (
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
                {auditQuery.data?.map((event) => (
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
