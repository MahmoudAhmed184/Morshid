import { ArrowRight, ClipboardCheck } from 'lucide-react'
import { Link } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/custom/empty-state'
import { ErrorState } from '@/components/ui/custom/error-state'
import { PageHeader } from '@/components/ui/custom/page-header'
import { StatusBadge } from '@/components/ui/custom/status-badge/status-badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { InstructorListSkeleton } from '@/features/instructor/components/instructor-list-skeleton'
import { useInstructorReviewQueue } from '@/features/instructor/hooks/use-instructor-reviews'
import type { InstructorReviewQueueItem } from '@/features/instructor/schemas/instructor-review.schema'

export function ReviewQueuePage() {
  const query = useInstructorReviewQueue()
  const pages = query.data?.pages ?? []
  const items = pages.flatMap((page) => page.items)
  const pendingCount = pages[0]?.pendingCount ?? 0

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Instructor workspace"
        title="Review Queue"
        description="Review flagged responses from your assigned courses."
      />

      <Card>
        <CardHeader className="border-b">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ClipboardCheck
                className="size-4 text-muted-foreground"
                aria-hidden
              />
              Assigned reviews
            </CardTitle>
            <StatusBadge
              status={pendingCount > 0 ? 'pending' : 'complete'}
              label={`${pendingCount} pending`}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {query.isPending ? (
            <div className="p-6">
              <InstructorListSkeleton aria-label="Loading review queue" />
            </div>
          ) : query.isError ? (
            <div className="p-6">
              <ErrorState
                title="Unable to load review queue"
                description="The review queue could not be loaded. Try again."
                onRetry={() => void query.refetch()}
                isRetrying={query.isFetching}
                className="min-h-44"
              />
            </div>
          ) : items.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<ClipboardCheck aria-hidden />}
                title="No review requests"
                description="New flagged responses from your assigned courses will appear here."
                className="min-h-44"
              />
            </div>
          ) : (
            <ReviewQueueTable items={items} />
          )}
        </CardContent>
      </Card>

      {query.hasNextPage ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            disabled={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          >
            {query.isFetchingNextPage ? 'Loading…' : 'Load more reviews'}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function ReviewQueueTable({ items }: { items: InstructorReviewQueueItem[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Student</TableHead>
            <TableHead>Course</TableHead>
            <TableHead>Trigger</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Age</TableHead>
            <TableHead>
              <span className="sr-only">Open review</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow
              key={item.reviewCaseId}
              className="group relative transition-colors hover:bg-muted/50 has-[a:focus-visible]:bg-muted/50 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-inset has-[a:focus-visible]:ring-ring"
            >
              <TableCell className="font-medium">
                {item.student.displayName}
              </TableCell>
              <TableCell>
                <span className="block">{item.course.title}</span>
                <span className="text-xs text-muted-foreground">
                  {item.course.code}
                </span>
              </TableCell>
              <TableCell>{humanize(item.trigger)}</TableCell>
              <TableCell>
                <StatusBadge
                  status={item.status}
                  label={humanize(item.status)}
                />
              </TableCell>
              <TableCell>{formatDate(item.createdAt)}</TableCell>
              <TableCell>{formatAge(item.age)}</TableCell>
              <TableCell className="text-right">
                <Link
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary outline-none after:absolute after:inset-0"
                  to="/instructor/review-queue/$reviewCaseId"
                  params={{ reviewCaseId: item.reviewCaseId }}
                  state={(previous) => ({
                    ...previous,
                    reviewQueueOverlay: true,
                  })}
                  aria-label={`Review ${item.student.displayName} in ${item.course.title}`}
                >
                  <span className="hidden sm:inline">Review</span>
                  <ArrowRight
                    className="size-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function humanize(value: string) {
  return value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^./u, (letter) => letter.toUpperCase())
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatAge(seconds: number) {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3_600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86_400) return `${Math.floor(seconds / 3_600)}h`
  return `${Math.floor(seconds / 86_400)}d`
}
