import { BookOpen, FileText, Inbox, Upload } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { EmptyState } from '@/components/ui/custom/empty-state'
import { LoadingState } from '@/components/ui/custom/loading-state'
import { PageHeader } from '@/components/ui/custom/page-header'
import { StatCard } from '@/components/ui/custom/stat-card'

type InstructorCourse = {
  code: string
  title: string
}

type InstructorDashboardState =
  | { status: 'loading' }
  | { status: 'empty' }
  | {
      status: 'ready'
      course: InstructorCourse
      materialCount: number
      reviewQueueCount: number
    }

type InstructorDashboardPageProps = {
  state: InstructorDashboardState
  actions?: React.ReactNode
}

export function InstructorDashboardPage({
  state,
  actions,
}: InstructorDashboardPageProps) {
  if (state.status === 'loading') {
    return (
      <main className="min-h-[calc(100svh-8rem)] bg-background">
        <div
          aria-label="Loading instructor dashboard"
          className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8"
          role="status"
        >
          <div>
            <h1 className="text-3xl font-semibold tracking-normal text-foreground">
              Loading your course workspace
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Checking your assigned course, materials, and review queue.
            </p>
          </div>
          <LoadingState rows={4} />
        </div>
      </main>
    )
  }

  if (state.status === 'empty') {
    return (
      <main className="min-h-[calc(100svh-8rem)] bg-background">
        <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
          <PageHeader
            eyebrow={<Badge variant="secondary">Instructor workspace</Badge>}
            title="Instructor dashboard"
            description="Manage course sources and review activity for your assigned course."
            actions={actions}
          />
          <EmptyState
            icon={<BookOpen aria-hidden />}
            title="No assigned course"
            description="Ask an administrator to assign you to a course before managing materials or reviews."
          />
        </div>
      </main>
    )
  }

  const { course, materialCount, reviewQueueCount } = state

  return (
    <main className="min-h-[calc(100svh-8rem)] bg-background">
      <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow={<Badge variant="secondary">Instructor workspace</Badge>}
          title="Instructor dashboard"
          description="Manage course sources and review activity for your assigned course."
          actions={actions}
        />

        <section aria-labelledby="course-heading" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle>
                    <h2 id="course-heading">{course.title}</h2>
                  </CardTitle>
                  <CardDescription>
                    Your protected Sprint 1 course workspace
                  </CardDescription>
                </div>
                <Badge variant="outline">{course.code}</Badge>
              </div>
            </CardHeader>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard
              label="Course materials"
              value={materialCount}
              icon={<FileText aria-hidden />}
              description="Uploaded sources available to this course"
            />
            <StatCard
              label="Review queue"
              value={reviewQueueCount}
              icon={<Inbox aria-hidden />}
              description="Flagged exchanges awaiting review"
            />
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section aria-labelledby="materials-heading" id="materials">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>
                  <h2 id="materials-heading">Course materials</h2>
                </CardTitle>
                <CardDescription>
                  Upload and source management will connect in the next sprint.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EmptyState
                  icon={<BookOpen aria-hidden />}
                  title="No course materials yet"
                  description="The materials API is not connected yet. This area is ready for Python course sources."
                  action={
                    <Button disabled type="button">
                      <Upload aria-hidden />
                      Upload material
                    </Button>
                  }
                />
              </CardContent>
            </Card>
          </section>

          <section aria-labelledby="reviews-heading" id="reviews">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>
                  <h2 id="reviews-heading">Review queue</h2>
                </CardTitle>
                <CardDescription>
                  Only flagged exchanges from this course will appear here.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EmptyState
                  icon={<Inbox aria-hidden />}
                  title="No reviews waiting"
                  description="Flagged and student-requested reviews will appear after the review API is connected."
                />
              </CardContent>
            </Card>
          </section>
        </div>

        <section aria-labelledby="sources-heading">
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
          </Card>
        </section>
      </div>
    </main>
  )
}
