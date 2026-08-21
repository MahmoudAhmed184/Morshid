import {
  ArrowLeft,
  Bot,
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
        'mx-auto flex min-w-0 w-full max-w-7xl flex-col gap-4 overflow-x-hidden [overflow-wrap:anywhere]',
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
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <h1 className="text-lg font-semibold tracking-tight">
                Review details
              </h1>
              <StatusBadge
                status={review.status}
                label={humanize(review.status)}
              />
            </div>
            <div
              aria-label="Review course and date"
              className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground"
            >
              <span className="inline-flex items-center gap-1.5">
                <BookOpen className="size-3.5" aria-hidden />
                <span>
                  {review.course.code} · {review.course.title}
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-3.5" aria-hidden />
                <span>{formatDate(review.requestedAt)}</span>
              </span>
            </div>
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

      {presentation === 'page' ? (
        <CompactReviewMetadata
          course={review.course.title}
          student={review.student.displayName}
          triggers={[
            ...review.triggers.map(humanize),
            ...(review.studentFlagReason
              ? [studentFlagReasonLabel(review.studentFlagReason)]
              : []),
          ]}
          status={humanize(review.status)}
          requested={formatDate(review.requestedAt)}
        />
      ) : null}

      {presentation === 'page' && review.studentNote ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-sm">
          <p className="min-w-0 flex-1 text-muted-foreground">
            <span className="font-medium text-foreground">Student note:</span>{' '}
            {review.studentNote}
          </p>
        </div>
      ) : null}

      <div
        aria-label="Review details layout"
        className="min-w-0 max-w-full space-y-4 overflow-x-hidden"
      >
        <div className="space-y-4">
          <section
            className="space-y-3"
            aria-labelledby={
              presentation === 'page' ? 'flagged-exchange-title' : undefined
            }
            aria-label={
              presentation === 'dialog' ? 'Flagged exchange' : undefined
            }
          >
            {presentation === 'page' ? (
              <SectionHeading
                id="flagged-exchange-title"
                icon={<MessageSquareText aria-hidden />}
                title="Flagged exchange"
                description="The question and original response submitted for review."
              />
            ) : null}
            <div
              className={cn(
                'space-y-3',
                presentation === 'page' &&
                  'rounded-xl border bg-muted/10 p-3 sm:p-4',
              )}
            >
              <ChatMessage
                sender={review.student.displayName}
                content={review.flaggedExchange.content}
                time={review.flaggedExchange.createdAt}
                tone="student"
              />
              <ChatMessage
                sender="Morshid assistant"
                content={review.assistantResponse.content}
                time={review.assistantResponse.createdAt}
                tone="assistant"
                editorPortalId={`review-edit-${review.reviewCaseId}`}
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
          <section aria-label="Review action">
            <ReviewActionPanel
              key={review.reviewCaseId}
              reviewCaseId={review.reviewCaseId}
              version={review.version}
              canReject={review.canReject}
              originalContent={review.assistantResponse.content}
              editPortalId={`review-edit-${review.reviewCaseId}`}
            />
          </section>
        ) : null}
      </div>
    </div>
  )
}

function CompactReviewMetadata({
  course,
  student,
  triggers,
  status,
  requested,
}: {
  course: string
  student: string
  triggers: string[]
  status: string
  requested: string
}) {
  const items = [
    { icon: <UserRound aria-hidden />, label: 'Student', values: [student] },
    { icon: <BookOpen aria-hidden />, label: 'Course', values: [course] },
    {
      icon: <MessageSquareText aria-hidden />,
      label: 'Trigger',
      values: triggers,
    },
    { icon: <Clock aria-hidden />, label: 'Status', values: [status] },
    { icon: <Clock aria-hidden />, label: 'Date', values: [requested] },
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
              title={item.values.join(' · ')}
            >
              {item.values.map((value, valueIndex) => (
                <span key={value}>
                  {valueIndex > 0 ? ' · ' : ''}
                  <span>{value}</span>
                </span>
              ))}
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
                  <SourceSnippet
                    key={`${citation.materialId}-${snippet.chunkNumber}`}
                    chunkNumber={snippet.chunkNumber}
                    excerpt={snippet.excerpt}
                  />
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

function SourceSnippet({
  chunkNumber,
  excerpt,
}: {
  chunkNumber: number
  excerpt: string
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const isLong = excerpt.length > 220

  return (
    <blockquote className="relative rounded-lg border bg-background p-3 pl-9 text-sm leading-6 text-muted-foreground">
      <Quote
        className="absolute top-3 left-3 size-3.5 text-primary/60"
        aria-hidden
      />
      <span className="mb-1 block text-xs font-medium text-foreground">
        Chunk {chunkNumber}
      </span>
      <span className={cn('block', isLong && !isExpanded && 'line-clamp-3')}>
        {excerpt}
      </span>
      {isLong ? (
        <button
          type="button"
          className="mt-1 text-xs font-medium text-primary hover:underline"
          onClick={() => setIsExpanded((expanded) => !expanded)}
        >
          {isExpanded ? 'Show less' : 'Show more'}
        </button>
      ) : null}
    </blockquote>
  )
}

function ChatMessage({
  sender,
  content,
  time,
  tone,
  editorPortalId,
}: {
  sender: string
  content: string
  time: string
  tone: 'student' | 'assistant'
  editorPortalId?: string
}) {
  const isAssistant = tone === 'assistant'

  return (
    <article
      aria-label={`${sender} message`}
      className={cn(
        'flex min-w-0 max-w-full items-end gap-2',
        isAssistant && 'flex-row-reverse',
      )}
    >
      <span
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-full text-[0.65rem] font-semibold',
          isAssistant
            ? 'bg-primary/10 text-primary'
            : 'bg-muted text-muted-foreground',
        )}
        aria-hidden
      >
        {isAssistant ? <Bot className="size-4" /> : initials(sender)}
      </span>
      <div
        className={cn(
          'min-w-0 max-w-[88%] space-y-1',
          isAssistant && 'text-right',
        )}
      >
        <p className="px-1 text-xs font-medium text-muted-foreground">
          {sender}
        </p>
        <div
          className={cn(
            'min-w-0 max-w-full rounded-2xl border px-3 py-2 text-left shadow-xs',
            isAssistant
              ? 'rounded-br-md border-primary/20 bg-primary/[0.045]'
              : 'rounded-bl-md bg-background',
          )}
        >
          <p className="whitespace-pre-wrap text-sm leading-6 [overflow-wrap:anywhere]">
            {content}
          </p>
          {editorPortalId ? <div id={editorPortalId} /> : null}
        </div>
        <time className="block px-1 text-[0.68rem] text-muted-foreground">
          {formatDate(time)}
        </time>
      </div>
    </article>
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
      title="Previous & Following Context"
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

function initials(displayName: string) {
  return displayName
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
