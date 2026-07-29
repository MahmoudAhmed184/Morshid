import {
  ArrowLeft,
  BookOpen,
  Clock,
  MessageSquareText,
  UserRound,
} from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorState } from '@/components/ui/custom/error-state'
import { PageHeader } from '@/components/ui/custom/page-header'
import { StatusBadge } from '@/components/ui/custom/status-badge/status-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useInstructorReviewDetail } from '@/features/instructor/hooks/use-instructor-reviews'
import type { InstructorReviewExchange } from '@/features/instructor/schemas/instructor-review.schema'

export function ReviewDetailPage({ reviewCaseId }: { reviewCaseId: string }) {
  const query = useInstructorReviewDetail(reviewCaseId)

  if (query.isPending) return <ReviewDetailSkeleton />
  if (query.isError) {
    return (
      <ErrorState
        title="Unable to load review"
        description="This review is unavailable or you no longer have access."
        onRetry={() => void query.refetch()}
        isRetrying={query.isFetching}
      />
    )
  }

  const review = query.data
  return (
    <div className="flex flex-col gap-8">
      <div>
        <a
          className={buttonVariants({
            variant: 'ghost',
            size: 'sm',
            className: 'mb-3 -ml-2',
          })}
          href="/instructor/review-queue"
        >
          <ArrowLeft aria-hidden /> Back to queue
        </a>
        <PageHeader
          eyebrow={`${review.course.code} · ${review.student.displayName}`}
          title="Review detail"
          description="Bounded context captured for this flagged response."
          actions={
            <StatusBadge
              status={review.status}
              label={humanize(review.status)}
            />
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          icon={<BookOpen aria-hidden />}
          label="Course"
          value={review.course.title}
        />
        <SummaryCard
          icon={<UserRound aria-hidden />}
          label="Student"
          value={review.student.displayName}
        />
        <SummaryCard
          icon={<MessageSquareText aria-hidden />}
          label="Trigger"
          value={humanize(review.trigger)}
        />
        <SummaryCard
          icon={<Clock aria-hidden />}
          label="Requested"
          value={formatDate(review.requestedAt)}
        />
      </div>

      {review.studentNote ? (
        <Alert>
          <MessageSquareText aria-hidden />
          <AlertTitle>Student note</AlertTitle>
          <AlertDescription>{review.studentNote}</AlertDescription>
        </Alert>
      ) : null}

      <section
        className="grid gap-4 lg:grid-cols-2"
        aria-label="Flagged exchange"
      >
        <MessageCard
          title="Flagged student message"
          content={review.flaggedExchange.content}
          time={review.flaggedExchange.createdAt}
        />
        <MessageCard
          title="Assistant response"
          content={review.assistantResponse.content}
          time={review.assistantResponse.createdAt}
        />
      </section>

      {review.assistantResponse.citations.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Citations and snippets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {review.assistantResponse.citations.map((citation) => (
              <div
                key={`${citation.materialId}-${citation.order}`}
                className="rounded-xl border p-4"
              >
                <p className="font-medium">
                  [{citation.order}] {citation.materialTitle}
                </p>
                {citation.snippets.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {citation.snippets.map((snippet) => (
                      <blockquote
                        key={`${citation.materialId}-${snippet.chunkNumber}`}
                        className="border-l-2 pl-3 text-sm text-muted-foreground"
                      >
                        <span className="mb-1 block text-xs font-medium text-foreground">
                          Chunk {snippet.chunkNumber}
                        </span>
                        {snippet.excerpt}
                      </blockquote>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    No bounded snippet is available.
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <ExchangeCard
          title="Previous exchange"
          exchange={review.previousExchange}
        />
        <ExchangeCard
          title="Following exchange"
          exchange={review.followingExchange}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Created {formatDate(review.createdAt)} · Requested{' '}
        {formatDate(review.requestedAt)}
      </p>
    </div>
  )
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <span className="mt-0.5 text-muted-foreground [&_svg]:size-4">
          {icon}
        </span>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-sm font-medium">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function MessageCard({
  title,
  content,
  time,
}: {
  title: string
  content: string
  time: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="whitespace-pre-wrap text-sm leading-6">{content}</p>
        <p className="mt-4 text-xs text-muted-foreground">{formatDate(time)}</p>
      </CardContent>
    </Card>
  )
}

function ExchangeCard({
  title,
  exchange,
}: {
  title: string
  exchange: InstructorReviewExchange | null
}) {
  if (!exchange) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {exchange.studentMessage ? (
          <MessageBlock
            label="Student"
            content={exchange.studentMessage.content}
          />
        ) : null}
        {exchange.assistantResponse ? (
          <MessageBlock
            label="Assistant"
            content={exchange.assistantResponse.content}
          />
        ) : null}
      </CardContent>
    </Card>
  )
}

function MessageBlock({ label, content }: { label: string; content: string }) {
  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="whitespace-pre-wrap text-sm leading-6">{content}</p>
    </div>
  )
}

function ReviewDetailSkeleton() {
  return (
    <div role="status" aria-label="Loading review detail" className="space-y-6">
      <Skeleton className="h-24 w-full" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
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
