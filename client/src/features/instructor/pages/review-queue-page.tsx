import { ClipboardList } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/custom/empty-state'
import { ErrorState } from '@/components/ui/custom/error-state'
import { PageHeader } from '@/components/ui/custom/page-header'
import { InstructorListSkeleton } from '@/features/instructor/components/instructor-list-skeleton'
import { reviewQueueFilters } from '@/features/instructor/constants/instructor-dashboard.constants'
import { useInstructorCourses } from '@/features/instructor/hooks/use-instructor-courses'

export function ReviewQueuePage() {
  const coursesQuery = useInstructorCourses()
  const isLoading = coursesQuery.isPending
  const isError = coursesQuery.isError
  const hasCourse =
    coursesQuery.isSuccess &&
    coursesQuery.data.some((course) => course.code === 'PYTHON-PROG-P0')

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={<Badge variant="secondary">Instructor workspace</Badge>}
        title="Review Queue"
        description="Shell view for flagged responses. Review actions are deferred."
      />

      <section aria-busy={isLoading || undefined}>
        <Card className="py-0">
          <CardHeader className="border-b px-4 py-3.5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2 text-sm text-foreground">
                <ClipboardList className="size-4 text-primary" aria-hidden />
                Review Queue
              </CardTitle>
              <div className="flex flex-wrap gap-2 text-xs">
                {reviewQueueFilters.map((item, index) => (
                  <Badge
                    key={item}
                    variant={index === 0 ? 'secondary' : 'outline'}
                  >
                    {item}
                  </Badge>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 py-4">
            <ReviewQueueListContent
              isLoading={isLoading}
              isError={isError}
              hasCourse={hasCourse}
              isRetrying={coursesQuery.isFetching}
              onRetry={() => {
                void coursesQuery.refetch()
              }}
            />
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

function ReviewQueueListContent({
  isLoading,
  isError,
  hasCourse,
  isRetrying,
  onRetry,
}: {
  isLoading: boolean
  isError: boolean
  hasCourse: boolean
  isRetrying: boolean
  onRetry: () => void
}) {
  if (isLoading) {
    return <InstructorListSkeleton aria-label="Loading review queue" />
  }

  if (isError) {
    return (
      <ErrorState
        title="Unable to load review queue"
        description="Course context could not be loaded for reviews. Try again."
        onRetry={onRetry}
        isRetrying={isRetrying}
        className="min-h-44 rounded-xl"
      />
    )
  }

  if (!hasCourse) {
    return (
      <EmptyState
        icon={<ClipboardList aria-hidden />}
        title="No assigned course"
        description="Assign a course before this workspace can show review requests."
        className="min-h-44 rounded-xl"
      />
    )
  }

  return (
    <EmptyState
      icon={<ClipboardList aria-hidden />}
      title="No review requests yet"
      description="Flagged exchanges will appear here after the Sprint 3 review workflow is implemented."
      className="min-h-44 rounded-[8px]"
    />
  )
}
