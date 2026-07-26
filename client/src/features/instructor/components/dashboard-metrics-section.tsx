import { BookOpen, FileText, Inbox } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { StatCard } from '@/components/ui/custom/stat-card'
import { Skeleton } from '@/components/ui/skeleton'
import type { InstructorDashboardState } from '@/features/instructor/types/instructor-dashboard-state'

type DashboardMetricsSectionProps = {
  state: InstructorDashboardState
}

export function DashboardMetricsSection({
  state,
}: DashboardMetricsSectionProps) {
  if (state.status === 'loading') {
    return (
      <div
        className="grid gap-6 sm:grid-cols-3"
        role="status"
        aria-label="Loading workspace metrics"
      >
        {['Course', 'Materials', 'Review queue'].map((label) => (
          <MetricCardSkeleton key={label} label={label} />
        ))}
      </div>
    )
  }

  const course = state.status === 'ready' ? state.course : undefined
  const materialCount =
    state.status === 'ready' ? state.materialCount : undefined
  const reviewCount =
    state.status === 'ready' ? state.reviewQueueCount : undefined

  return (
    <div className="grid gap-6 sm:grid-cols-3">
      <StatCard
        label="Course"
        tone="default"
        icon={<BookOpen aria-hidden />}
        value={
          course ? (
            <span className="font-mono text-lg">{course.code}</span>
          ) : (
            '—'
          )
        }
        description={course ? 'Your assigned course' : 'No course assigned'}
      />
      <StatCard
        label="Materials"
        tone="default"
        icon={<FileText aria-hidden />}
        value={<span className="tabular-nums">{materialCount ?? '—'}</span>}
        description={
          materialCount === undefined
            ? 'Live totals are available in Materials'
            : 'Uploaded sources available to this course'
        }
      />
      <StatCard
        label="Review queue"
        tone={
          reviewCount !== undefined && reviewCount > 0 ? 'warning' : 'success'
        }
        icon={<Inbox aria-hidden />}
        value={<span className="tabular-nums">{reviewCount ?? '—'}</span>}
        description={
          reviewCount === undefined ? (
            'Open the queue for current requests'
          ) : (
            <span className="flex items-center gap-2">
              <Badge variant={reviewCount > 0 ? 'warning' : 'success'}>
                {reviewCount > 0 ? 'Needs review' : 'All clear'}
              </Badge>
              <span>Flagged exchanges awaiting review</span>
            </span>
          )
        }
      />
    </div>
  )
}

function MetricCardSkeleton({ label }: { label: string }) {
  return (
    <Card aria-label={`Loading ${label} metric`}>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="size-9 rounded-lg" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16" />
        <Skeleton className="mt-2 h-4 w-3/4" />
      </CardContent>
    </Card>
  )
}
