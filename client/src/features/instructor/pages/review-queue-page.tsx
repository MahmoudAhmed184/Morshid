import { ClipboardList } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/custom/empty-state'
import { InstructorSectionHeader } from '@/features/instructor/components/instructor-section-header'
import { reviewQueueFilters } from '@/features/instructor/constants/instructor-dashboard.constants'

export function ReviewQueuePage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <ClipboardList className="size-4 text-primary" aria-hidden />
          Instructor Workspace
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">
          Review Queue
        </h1>
      </div>

      <section className="space-y-3">
        <InstructorSectionHeader
          title="Review Queue"
          description="Shell view for flagged responses. Review actions are deferred."
        />
        <Card className="rounded-[8px] border-border bg-card py-0 text-card-foreground ring-0">
          <CardHeader className="border-b border-border px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2 text-sm text-foreground">
                <ClipboardList className="size-4 text-primary" aria-hidden />
                Review Queue
              </CardTitle>
              <div className="flex flex-wrap gap-2 text-xs">
                {reviewQueueFilters.map((item) => (
                  <Badge key={item} variant="outline">
                    {item}
                  </Badge>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 py-4">
            <EmptyState
              icon={<ClipboardList aria-hidden />}
              title="No review requests yet"
              description="Flagged exchanges will appear here after the Sprint 3 review workflow is implemented."
              className="min-h-44 rounded-[8px]"
            />
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
