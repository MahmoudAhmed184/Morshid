import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { EmptyState } from '@/components/ui/custom/empty-state'
import { InstructorListSkeleton } from '@/features/instructor/components/instructor-list-skeleton'

type DashboardSourceReadinessSectionProps = {
  isLoading: boolean
}

export function DashboardSourceReadinessSection({
  isLoading,
}: DashboardSourceReadinessSectionProps) {
  return (
    <section
      aria-labelledby="sources-heading"
      aria-busy={isLoading || undefined}
    >
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 id="sources-heading">Source readiness</h2>
          </CardTitle>
          <CardDescription>
            Processing, ready, warning, and failed source statuses will be
            reported here after ingestion integration.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <InstructorListSkeleton aria-label="Loading source readiness" />
          ) : (
            <EmptyState
              title="No source status yet"
              description="Source processing statuses will appear here after ingestion is connected."
              className="min-h-40"
            />
          )}
        </CardContent>
      </Card>
    </section>
  )
}
