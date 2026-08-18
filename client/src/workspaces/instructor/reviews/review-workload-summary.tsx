import { AlertCircle, CheckCircle2, Clock3, Inbox, XCircle } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/ui/custom/stat-card'
import { Skeleton } from '@/components/ui/skeleton'
import type {
  InstructorReviewWorkloadSummary,
  ReviewTriggerType,
  StudentFlagReason,
} from '@/features/reviews/interface/instructor-review.schema'
import {
  studentFlagReasonLabel,
  studentFlagReasons,
} from '@/features/reviews/interface/student-flag-reason'
import { cn } from '@/lib/utils'

export interface ReviewWorkloadSummaryProps {
  summary?: InstructorReviewWorkloadSummary
  isLoading?: boolean
  error?: Error | null
  onRetry?: () => void
  resolvedCount?: number
  rejectedCount?: number
  onSelectStatus?: (status: 'PENDING' | 'RESOLVED' | 'REJECTED') => void
  onSelectStudentFlagReason?: (reason: StudentFlagReason) => void
  onSelectTrigger?: (trigger: ReviewTriggerType) => void
  className?: string
}

const triggerLabels: Record<ReviewTriggerType, string> = {
  STUDENT_REQUEST: 'Student request',
  GENERAL_NOT_FOUND: 'General not found',
  CITATION_MISSING: 'Citation missing',
  SOURCE_CONFLICT: 'Source conflict',
  POLICY_CHECK_FAILED: 'Policy check failed',
  FINAL_ANSWER_RISK: 'Final answer risk',
}

export function ReviewWorkloadSummary({
  summary,
  isLoading,
  error,
  onRetry,
  resolvedCount = 0,
  rejectedCount = 0,
  onSelectStatus,
  onSelectStudentFlagReason,
  onSelectTrigger,
  className,
}: ReviewWorkloadSummaryProps) {
  if (isLoading) {
    return <WorkloadSummarySkeleton className={className} />
  }

  if (error) {
    return (
      <Card className={cn('border-destructive/30 bg-destructive/5', className)}>
        <CardContent className="flex flex-col items-center justify-center gap-3 p-6 text-center">
          <AlertCircle className="size-6 text-destructive" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-foreground">
              Unable to load workload summary
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {error.message ||
                'A network error occurred while loading review metrics.'}
            </p>
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="text-xs font-medium text-primary hover:underline"
            >
              Retry
            </button>
          )}
        </CardContent>
      </Card>
    )
  }

  if (!summary) return null

  const isZeroState = summary.totalActiveCount === 0
  const formattedAge =
    summary.oldestPendingAge !== null
      ? formatAge(summary.oldestPendingAge)
      : null
  const formattedDate =
    summary.oldestPendingCreatedAt !== null
      ? new Date(summary.oldestPendingCreatedAt).toLocaleString()
      : null

  return (
    <div className={cn('flex flex-col gap-5', className)}>
      <div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        role="region"
        aria-label="Review Workload Snapshot"
      >
        <div
          className={cn(
            'h-full',
            onSelectStatus &&
              'cursor-pointer transition-transform hover:scale-[1.01]',
          )}
          onClick={() => onSelectStatus?.('PENDING')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onSelectStatus?.('PENDING')
            }
          }}
          role={onSelectStatus ? 'button' : undefined}
          tabIndex={onSelectStatus ? 0 : undefined}
          aria-label={`Pending cases: ${summary.pendingCount}. Click to filter.`}
        >
          <StatCard
            className="h-full"
            label="Pending"
            tone={summary.pendingCount > 0 ? 'warning' : 'success'}
            icon={<Clock3 aria-hidden />}
            value={<span className="tabular-nums">{summary.pendingCount}</span>}
            description={
              summary.pendingCount > 0
                ? 'Awaiting instructor review'
                : 'All pending cases resolved'
            }
          />
        </div>

        <div
          className={cn(
            'h-full',
            onSelectStatus &&
              'cursor-pointer transition-transform hover:scale-[1.01]',
          )}
          onClick={() => onSelectStatus?.('RESOLVED')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onSelectStatus?.('RESOLVED')
            }
          }}
          role={onSelectStatus ? 'button' : undefined}
          tabIndex={onSelectStatus ? 0 : undefined}
          aria-label={`Resolved cases: ${resolvedCount}. Click to filter.`}
        >
          <StatCard
            className="h-full"
            label="Resolved"
            tone={resolvedCount > 0 ? 'success' : 'default'}
            icon={<CheckCircle2 aria-hidden />}
            value={<span className="tabular-nums">{resolvedCount}</span>}
            description="Successfully reviewed cases"
          />
        </div>

        <div
          className={cn(
            'h-full',
            onSelectStatus &&
              'cursor-pointer transition-transform hover:scale-[1.01]',
          )}
          onClick={() => onSelectStatus?.('REJECTED')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onSelectStatus?.('REJECTED')
            }
          }}
          role={onSelectStatus ? 'button' : undefined}
          tabIndex={onSelectStatus ? 0 : undefined}
          aria-label={`Rejected cases: ${rejectedCount}. Click to filter.`}
        >
          <StatCard
            className="h-full"
            label="Rejected"
            tone="default"
            icon={<XCircle aria-hidden />}
            value={<span className="tabular-nums">{rejectedCount}</span>}
            description="Rejected review requests"
          />
        </div>

        <div className="h-full">
          <StatCard
            className="h-full"
            label="Oldest Pending Case"
            tone={summary.pendingCount > 0 ? 'warning' : 'default'}
            icon={<Inbox aria-hidden />}
            value={formattedAge ?? '—'}
            description={
              formattedDate ? `Waiting since ${formattedDate}` : 'No backlog'
            }
          />
        </div>
      </div>

      {isZeroState ? (
        <Card className="border-dashed bg-secondary/10">
          <CardContent className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <CheckCircle2 className="size-8 text-success" aria-hidden />
            <p className="text-sm font-semibold text-foreground">
              All clear — No review cases need attention
            </p>
            <p className="text-xs text-muted-foreground max-w-md">
              There are currently no pending cases across your assigned courses.
              New flagged exchanges will appear here immediately.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {/* Student Flag Reasons Breakdown */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold tracking-tight">
                Workload by Student Flag Reason
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table
                  className="w-full text-left text-xs"
                  aria-label="Student flag reasons workload table"
                >
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th scope="col" className="pb-2 font-medium">
                        Reason
                      </th>
                      <th scope="col" className="pb-2 text-right font-medium">
                        Active Cases
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {studentFlagReasons.map((reason) => {
                      const count =
                        summary.byStudentFlagReason.find(
                          (item) => item.reason === reason,
                        )?.count ?? 0
                      const hasCount = count > 0

                      return (
                        <tr
                          key={reason}
                          className={cn(
                            hasCount && onSelectStudentFlagReason
                              ? 'cursor-pointer hover:bg-muted/40 transition-colors'
                              : 'opacity-70',
                          )}
                          onClick={() => {
                            if (hasCount && onSelectStudentFlagReason) {
                              onSelectStudentFlagReason(reason)
                            }
                          }}
                        >
                          <td className="py-2 font-medium text-foreground">
                            {studentFlagReasonLabel(reason)}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            <Badge
                              variant={hasCount ? 'secondary' : 'outline'}
                              className={cn(
                                'text-[0.7rem] px-2 py-0.5',
                                hasCount && 'font-semibold',
                              )}
                            >
                              {count}
                            </Badge>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Trigger Types Breakdown */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold tracking-tight">
                Workload by Trigger Type
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table
                  className="w-full text-left text-xs"
                  aria-label="Trigger types workload table"
                >
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th scope="col" className="pb-2 font-medium">
                        Trigger
                      </th>
                      <th scope="col" className="pb-2 text-right font-medium">
                        Active Cases
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {(Object.keys(triggerLabels) as ReviewTriggerType[]).map(
                      (trigger) => {
                        const count =
                          summary.byTriggerType.find(
                            (item) => item.trigger === trigger,
                          )?.count ?? 0
                        const hasCount = count > 0

                        return (
                          <tr
                            key={trigger}
                            className={cn(
                              hasCount && onSelectTrigger
                                ? 'cursor-pointer hover:bg-muted/40 transition-colors'
                                : 'opacity-70',
                            )}
                            onClick={() => {
                              if (hasCount && onSelectTrigger) {
                                onSelectTrigger(trigger)
                              }
                            }}
                          >
                            <td className="py-2 font-medium text-foreground">
                              {triggerLabels[trigger]}
                            </td>
                            <td className="py-2 text-right tabular-nums">
                              <Badge
                                variant={hasCount ? 'secondary' : 'outline'}
                                className={cn(
                                  'text-[0.7rem] px-2 py-0.5',
                                  hasCount && 'font-semibold',
                                )}
                              >
                                {count}
                              </Badge>
                            </td>
                          </tr>
                        )
                      },
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

function WorkloadSummarySkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('flex flex-col gap-4', className)}
      role="status"
      aria-label="Loading review workload summary"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {['Pending', 'Resolved', 'Rejected', 'Oldest'].map((label) => (
          <Card key={label} className="h-full">
            <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="size-8 rounded-lg" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-7 w-12" />
              <Skeleton className="mt-2 h-3.5 w-3/4" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function formatAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3_600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86_400) {
    const hours = Math.floor(seconds / 3_600)
    const mins = Math.floor((seconds % 3_600) / 60)
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }
  const days = Math.floor(seconds / 86_400)
  const hours = Math.floor((seconds % 86_400) / 3_600)
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`
}
