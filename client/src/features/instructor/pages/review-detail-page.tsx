import {
  ArrowLeft,
  BookOpen,
  Clock,
  FileText,
  MessageSquareText,
  Quote,
  UserRound,
} from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorState } from '@/components/ui/custom/error-state'
import { PageHeader } from '@/components/ui/custom/page-header'
import { StatusBadge } from '@/components/ui/custom/status-badge/status-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { InstructorReviewActionPanel } from '@/features/instructor/components/instructor-review-action-panel'
import { useInstructorReviewDetail } from '@/features/reviews/instructor-queue/use-instructor-reviews'
import type { InstructorReviewExchange } from '@/features/reviews/interface/instructor-review.schema'
import { studentFlagReasonLabel } from '@/features/reviews/interface/student-flag-reason'
import { cn } from '@/lib/utils'

export function ReviewDetailPage({
  reviewCaseId,
  presentation = 'page',
}: {
  reviewCaseId: string
  presentation?: 'page' | 'dialog'
}) {
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
  const isOpen = review.status === 'PENDING' || review.status === 'IN_REVIEW'
  return (
    <div
      className={cn(
        'mx-auto flex w-full max-w-7xl flex-col gap-8',
        presentation === 'dialog' && 'max-w-none gap-6',
      )}
    >
      <div
        className={cn(
          'border-b pb-6',
          presentation === 'dialog' && 'pb-4 pr-8',
        )}
      >
        {presentation === 'page' ? (
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
        ) : null}
        {presentation === 'dialog' ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {review.course.code} · Instructor review
              </p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight">
                Review flagged response
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                The relevant exchange, evidence, and nearby context in one view.
              </p>
            </div>
            <StatusBadge
              status={review.status}
              label={humanize(review.status)}
            />
          </div>
        ) : (
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
        )}
      </div>

      {presentation === 'dialog' ? (
        <CompactReviewMetadata
          course={review.course.title}
          student={review.student.displayName}
          trigger={review.triggers.map(humanize).join(' · ')}
          requested={formatDate(review.requestedAt)}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
            label={review.triggers.length === 1 ? 'Trigger' : 'Triggers'}
            value={review.triggers.map(humanize).join(' · ')}
          />
          <SummaryCard
            icon={<Clock aria-hidden />}
            label="Requested"
            value={formatDate(review.requestedAt)}
          />
        </div>
      )}

      {review.studentFlagReason ? (
        <Alert className="border-info/20 bg-info/[0.04] py-4">
          <MessageSquareText aria-hidden />
          <AlertTitle>Student flag category</AlertTitle>
          <AlertDescription>
            {studentFlagReasonLabel(review.studentFlagReason)}
          </AlertDescription>
        </Alert>
      ) : null}

      {review.studentNote ? (
        <Alert
          className={cn(
            'border-primary/20 bg-primary/[0.04] py-4',
            presentation === 'dialog' && 'py-3',
          )}
        >
          <MessageSquareText aria-hidden />
          <AlertTitle>Student note</AlertTitle>
          <AlertDescription>{review.studentNote}</AlertDescription>
        </Alert>
      ) : null}

      <div
        className={cn(
          'grid items-start gap-6',
          isOpen && 'xl:grid-cols-[minmax(0,1fr)_26rem]',
        )}
      >
        <div className="space-y-6">
          <section
            className="space-y-4"
            aria-labelledby="flagged-exchange-title"
          >
            <SectionHeading
              id="flagged-exchange-title"
              icon={<MessageSquareText aria-hidden />}
              title="Flagged exchange"
              description="The question and original response submitted for review."
            />
            <div className="grid gap-4">
              <MessageCard
                title="Student message"
                content={review.flaggedExchange.content}
                time={review.flaggedExchange.createdAt}
                tone="student"
              />
              <MessageCard
                title="Original assistant response"
                content={review.assistantResponse.content}
                time={review.assistantResponse.createdAt}
                tone="assistant"
              />
            </div>
          </section>

          {review.assistantResponse.citations.length > 0 ? (
            <section
              className="space-y-4"
              aria-labelledby="review-sources-title"
            >
              <SectionHeading
                id="review-sources-title"
                icon={<FileText aria-hidden />}
                title="Sources and evidence"
                description="Bounded excerpts associated with the original response."
              />
              <Card className="overflow-hidden">
                <CardContent className="grid gap-3 p-4">
                  {review.assistantResponse.citations.map((citation) => (
                    <div
                      key={`${citation.materialId}-${citation.order}`}
                      className="rounded-xl border bg-muted/20 p-4 shadow-xs"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {citation.order}
                        </span>
                        <p className="pt-1 text-sm font-semibold">
                          {citation.materialTitle}
                        </p>
                      </div>
                      {citation.snippets.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {citation.snippets.map((snippet) => (
                            <blockquote
                              key={`${citation.materialId}-${snippet.chunkNumber}`}
                              className="relative rounded-lg border bg-background p-3 pl-9 text-sm leading-6 text-muted-foreground"
                            >
                              <Quote
                                className="absolute top-3 left-3 size-3.5 text-primary/60"
                                aria-hidden
                              />
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
            </section>
          ) : null}

          {review.previousExchange || review.followingExchange ? (
            <section
              className="space-y-4"
              aria-labelledby="review-context-title"
            >
              <SectionHeading
                id="review-context-title"
                icon={<BookOpen aria-hidden />}
                title="Conversation context"
                description="A limited view of the exchanges immediately around the flagged response."
              />
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
            </section>
          ) : null}

          <section
            className="space-y-4"
            aria-labelledby="review-action-history-title"
          >
            <SectionHeading
              id="review-action-history-title"
              icon={<Clock aria-hidden />}
              title="Action history"
              description="A chronological record of this review case."
            />
            <Card>
              <CardContent className="divide-y p-0">
                {review.actions.map((action) => (
                  <div
                    key={`${action.version}-${action.type}`}
                    className="space-y-2 px-4 py-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold">
                        {humanize(action.type)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Version {action.version} ·{' '}
                        {formatDate(action.createdAt)}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {action.actorDisplayName ?? 'Automated review system'}
                    </p>
                    {action.reason ? (
                      <p className="whitespace-pre-wrap text-sm">
                        {action.reason}
                      </p>
                    ) : null}
                    {action.content ? (
                      <blockquote className="whitespace-pre-wrap rounded-lg border bg-muted/20 p-3 text-sm">
                        {action.content}
                      </blockquote>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>
        </div>

        {isOpen ? (
          <aside className="xl:sticky xl:top-6">
            <InstructorReviewActionPanel
              key={review.reviewCaseId}
              reviewCaseId={review.reviewCaseId}
              version={review.version}
              canReject={review.canReject}
              originalContent={review.assistantResponse.content}
            />
          </aside>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">
        Created {formatDate(review.createdAt)} · Requested{' '}
        {formatDate(review.requestedAt)}
      </p>
    </div>
  )
}

function CompactReviewMetadata({
  course,
  student,
  trigger,
  requested,
}: {
  course: string
  student: string
  trigger: string
  requested: string
}) {
  const items = [
    { icon: <BookOpen aria-hidden />, label: 'Course', value: course },
    { icon: <UserRound aria-hidden />, label: 'Student', value: student },
    {
      icon: <MessageSquareText aria-hidden />,
      label: 'Trigger',
      value: trigger,
    },
    { icon: <Clock aria-hidden />, label: 'Requested', value: requested },
  ]

  return (
    <dl className="grid overflow-hidden rounded-xl border bg-muted/20 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item, index) => (
        <div
          key={item.label}
          className={cn(
            'flex min-w-0 items-center gap-3 px-4 py-3',
            index > 0 && 'border-t sm:border-t-0',
            index % 2 === 1 && 'sm:border-l',
            index > 1 && 'sm:border-t lg:border-t-0',
            index > 0 && 'lg:border-l',
          )}
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground shadow-xs [&_svg]:size-4">
            {item.icon}
          </span>
          <div className="min-w-0">
            <dt className="text-[0.68rem] font-medium uppercase tracking-wide text-muted-foreground">
              {item.label}
            </dt>
            <dd
              className="mt-0.5 truncate text-sm font-medium"
              title={item.value}
            >
              {item.value}
            </dd>
          </div>
        </div>
      ))}
    </dl>
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
  tone,
}: {
  title: string
  content: string
  time: string
  tone: 'student' | 'assistant'
}) {
  return (
    <Card
      className={
        tone === 'assistant' ? 'border-primary/20 bg-primary/[0.025]' : ''
      }
    >
      <CardHeader className="border-b pb-4">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="whitespace-pre-wrap text-sm leading-6">{content}</p>
        <p className="mt-4 text-xs text-muted-foreground">{formatDate(time)}</p>
      </CardContent>
    </Card>
  )
}

function SectionHeading({
  id,
  icon,
  title,
  description,
}: {
  id: string
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/40 text-muted-foreground [&_svg]:size-4">
        {icon}
      </span>
      <div>
        <h2 id={id} className="text-base font-semibold tracking-tight">
          {title}
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
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
