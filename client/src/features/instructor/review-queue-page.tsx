import { ClipboardList } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function SectionHeader({
  description,
  title,
}: {
  description: string
  title: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="text-xs leading-5 text-muted-foreground">{description}</p>
    </div>
  )
}

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
        <SectionHeader
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
                {['Pending / 0', 'AI Concerns', 'Student Requests'].map(
                  (item) => (
                    <span
                      key={item}
                      className="rounded-[6px] border border-border bg-background px-3 py-1.5 text-muted-foreground"
                    >
                      {item}
                    </span>
                  ),
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 py-4">
            <div className="rounded-[8px] border border-dashed border-border bg-muted/20 px-5 py-8 text-center">
              <div className="mx-auto flex size-10 items-center justify-center rounded-[8px] bg-muted text-primary">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="lucide lucide-clipboard-list"
                  aria-hidden
                >
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                  <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
                </svg>
              </div>
              <p className="mt-3 text-sm font-medium text-foreground">
                No review requests yet
              </p>
              <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-muted-foreground">
                Flagged exchanges will appear here after the Sprint 3 review
                workflow is implemented.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
