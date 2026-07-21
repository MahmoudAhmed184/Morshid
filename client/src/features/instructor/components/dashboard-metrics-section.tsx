import { BookOpen, FileText, Inbox } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { StatCard } from '@/components/ui/custom/stat-card'
import { Skeleton } from '@/components/ui/skeleton'
import type { InstructorDashboardState } from '@/features/instructor/types/instructor-dashboard-state'

type DashboardMetricsSectionProps = {
  state: InstructorDashboardState
}

/** The Register stat row — three cards summarising the teaching desk. */
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
  const materialCount = state.status === 'ready' ? state.materialCount : 0
  const reviewCount = state.status === 'ready' ? state.reviewQueueCount : 0
  const hasCourse = Boolean(course)

  return (
    <div className="grid gap-6 sm:grid-cols-3">
      <StatCard
        label="Course"
        tone="primary"
        icon={<BookOpen aria-hidden />}
        value={
          course ? (
            <span className="font-mono text-lg">{course.code}</span>
          ) : (
            '—'
          )
        }
        description={hasCourse ? 'Your assigned course' : 'No course assigned'}
      />
      <StatCard
        label="Materials"
        tone="primary"
        icon={<FileText aria-hidden />}
        value={
          <span className="tabular-nums">
            {hasCourse ? materialCount : '—'}
          </span>
        }
        description="Uploaded sources available to this course"
      />
      <StatCard
        label="Review queue"
        tone={hasCourse && reviewCount > 0 ? 'warning' : 'success'}
        icon={<Inbox aria-hidden />}
        value={
          <span className="tabular-nums">{hasCourse ? reviewCount : '—'}</span>
        }
        description={
          hasCourse ? (
            <span className="flex items-center gap-2">
              <Badge variant={reviewCount > 0 ? 'warning' : 'success'}>
                {reviewCount > 0 ? 'Needs review' : 'All clear'}
              </Badge>
              <span>Flagged exchanges awaiting review</span>
            </span>
          ) : (
            'Flagged exchanges awaiting review'
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
