import { Link } from '@tanstack/react-router'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { InstructorListSkeleton } from '@/features/instructor/components/instructor-list-skeleton'
import type { InstructorDashboardState } from '@/features/instructor/types/instructor-dashboard-state'

type DashboardReviewQueuePanelProps = {
  state: InstructorDashboardState
}

/**
 * The Register review-queue panel (col-1).
 *
 * The dashboard queries only expose a review-queue *count*, not the individual
 * flagged rows, so this panel degrades to an at-a-glance summary plus the
 * "Open the queue →" link rather than rendering per-row entries.
 */
export function DashboardReviewQueuePanel({
  state,
}: DashboardReviewQueuePanelProps) {
  const hasCourse = state.status === 'ready'
  const reviewCount = state.status === 'ready' ? state.reviewQueueCount : 0

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="smallcaps-label">Needs review</div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        {state.status === 'loading' ? (
          <InstructorListSkeleton rows={3} aria-label="Loading review queue" />
        ) : (
          <div className="flex-1 rounded-xl border border-dashed bg-secondary/20 px-4 py-8 text-center">
            <p className="text-sm font-medium text-foreground">
              {hasCourse && reviewCount > 0
                ? `${reviewCount} awaiting review`
                : 'No reviews waiting'}
            </p>
            <p className="footnote mt-1">
              {hasCourse
                ? 'Flagged exchanges from this course appear here.'
                : 'Assign a course to collect flagged exchanges.'}
            </p>
          </div>
        )}
        <Link
          to="/instructor/review-queue"
          className="link-editorial footnote w-fit"
        >
          Open the queue →
        </Link>
      </CardContent>
    </Card>
  )
}
