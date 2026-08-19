import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  Clock,
  FileText,
  MessageSquareText,
  Quote,
  UserRound,
} from 'lucide-react'
import { useState } from 'react'

import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorState } from '@/components/ui/custom/error-state'
import { PageHeader } from '@/components/ui/custom/page-header'
import { StatusBadge } from '@/components/ui/custom/status-badge/status-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ReviewActionPanel } from '@/workspaces/instructor/reviews/review-action-panel'
import { useInstructorReviewDetail } from '@/workspaces/instructor/reviews/use-reviews'
import type {
  InstructorReviewDetail,
  InstructorReviewExchange,
} from '@/features/reviews/interface/instructor-review.schema'
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
        'mx-auto flex w-full max-w-7xl flex-col gap-4',
        presentation === 'dialog' && 'max-w-none',
      )}
    >
      <div className={cn('border-b pb-4', presentation === 'dialog' && 'pr-8')}>
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

      <CompactReviewMetadata
        course={review.course.title}
        student={review.student.displayName}
        trigger={review.triggers.map(humanize).join(' · ')}
        requested={formatDate(review.requestedAt)}
        studentFlagCategory={
          review.studentFlagReason
            ? studentFlagReasonLabel(review.studentFlagReason)
            : null
        }
      />

      {review.studentNote ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-sm">
          <p className="min-w-0 flex-1 text-muted-foreground">
            <span className="font-medium text-foreground">Student note:</span>{' '}
            {review.studentNote}
          </p>
        </div>
      ) : null}

      <div
        aria-label="Review details layout"
        className={cn(
          'grid items-start gap-4',
          isOpen && 'xl:grid-cols-[minmax(0,1fr)_24rem]',
        )}
      >
        <div className="space-y-4">
          <section
            className="space-y-3"
            aria-labelledby="flagged-exchange-title"
          >
            <SectionHeading
              id="flagged-exchange-title"
              icon={<MessageSquareText aria-hidden />}
              title="Flagged exchange"
              description="The question and original response submitted for review."
            />
            <div className="grid gap-3 lg:grid-cols-2">
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
            <ReviewSources citations={review.assistantResponse.citations} />
          ) : null}

          {review.previousExchange || review.followingExchange ? (
            <ReviewContext
              previous={review.previousExchange}
              following={review.followingExchange}
            />
          ) : null}
        </div>

        {isOpen ? (
          <aside aria-label="Review action" className="xl:sticky xl:top-6">
            <ReviewActionPanel
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
  studentFlagCategory,
}: {
  course: string
  student: string
  trigger: string
  requested: string
  studentFlagCategory: string | null
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
    ...(studentFlagCategory
      ? [
          {
            icon: <MessageSquareText aria-hidden />,
            label: 'Student flag category',
            value: studentFlagCategory,
          },
        ]
      : []),
  ]

  return (
    <dl className="grid overflow-hidden rounded-lg border bg-muted/15 sm:grid-cols-2 lg:grid-cols-5">
      {items.map((item, index) => (
        <div
          key={item.label}
          className={cn(
            'flex min-w-0 items-center gap-2 px-3 py-2',
            index > 0 && 'border-t sm:border-t-0',
            index % 2 === 1 && 'sm:border-l',
            index > 1 && 'sm:border-t lg:border-t-0',
            index > 0 && 'lg:border-l',
          )}
        >
          <span className="shrink-0 text-muted-foreground [&_svg]:size-3.5">
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

function ReviewSources({
  citations,
}: {
  citations: InstructorReviewDetail['assistantResponse']['citations']
}) {
  return (
    <CompactCollapsible
      id="review-sources"
      title="Sources"
      count={citations.length}
      icon={<FileText aria-hidden />}
    >
      <div className="grid gap-2 p-3">
        {citations.map((citation) => (
          <div
            key={`${citation.materialId}-${citation.order}`}
            className="rounded-lg border bg-muted/20 p-3"
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
      </div>
    </CompactCollapsible>
  )
}

function CompactCollapsible({
  id,
  title,
  count,
  icon,
  children,
}: {
  id: string
  title: string
  count?: number
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(false)
  const contentId = `${id}-content`

  return (
    <section className="overflow-hidden rounded-lg border" aria-labelledby={id}>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={contentId}
        onClick={() => setIsOpen((open) => !open)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        {icon ? (
          <span className="text-muted-foreground [&_svg]:size-3.5">{icon}</span>
        ) : null}
        <span id={id} className="flex-1 text-sm font-medium">
          {title}
          {count === undefined ? '' : ` (${count})`}
        </span>
        <ChevronDown
          className={cn(
            'size-4 text-muted-foreground transition-transform',
            isOpen && 'rotate-180',
          )}
          aria-hidden
        />
      </button>
      {isOpen ? (
        <div id={contentId} className="border-t">
          {children}
        </div>
      ) : null}
    </section>
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
      <CardHeader className="border-b px-4 py-3">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <p className="whitespace-pre-wrap text-sm leading-6">{content}</p>
        <p className="mt-3 text-xs text-muted-foreground">{formatDate(time)}</p>
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

function ReviewContext({
  previous,
  following,
}: {
  previous: InstructorReviewExchange | null
  following: InstructorReviewExchange | null
}) {
  return (
    <CompactCollapsible
      id="previous-and-following"
      title="Previous & Following"
    >
      <div className="grid gap-3 p-3 lg:grid-cols-2">
        {previous ? (
          <ExchangeContent title="Previous" exchange={previous} />
        ) : null}
        {following ? (
          <ExchangeContent title="Following" exchange={following} />
        ) : null}
      </div>
    </CompactCollapsible>
  )
}

function ExchangeContent({
  title,
  exchange,
}: {
  title: string
  exchange: InstructorReviewExchange
}) {
  return (
    <section className="min-w-0 space-y-2" aria-label={title}>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
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
    </section>
  )
}

function MessageBlock({ label, content }: { label: string; content: string }) {
  return (
    <div className="rounded-lg bg-muted/25 p-3">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
