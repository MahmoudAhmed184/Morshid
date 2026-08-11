import {
  BookMarked,
  Check,
  CircleAlert,
  CircleCheck,
  CircleX,
  ClipboardCheck,
  CodeXml,
  Copy,
  FileText,
  Flag,
  GraduationCap,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  Clock3,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Logo } from '@/components/branding/logo'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useStudentReviewDetail } from '@/workspaces/student/tutor-workspace/use-review-detail'
import type { ChatMessage } from '@/features/chat/messages/chat-message.schema'
import type { StudentFlagReason } from '@/features/reviews/interface/student-review.schema'
import { cn } from '@/lib/utils'

import { StudentCitationSources } from './citation-sources'
import { StudentChatContent } from './chat-content'
import { StudentReviewRequestDialog } from './review-request-dialog'
import {
  STUDENT_CHAT_COMPLETION_STATUS,
  STUDENT_CHAT_FAILURE_STATUS,
  STUDENT_CHAT_GENERATION_STATUS,
} from './chat-status'
import { StudentAssistantMarkdown } from './assistant-markdown'

interface StudentChatMessageProps {
  message: ChatMessage
  isGenerationActive: boolean
  retryError: unknown
  retryMessageId?: string
  onRetry: (studentMessageId: string) => void
  onRequestReview: (input: {
    messageId: string
    flagReason: StudentFlagReason
    note: string
  }) => Promise<unknown>
}

type GuidanceLabel = NonNullable<ChatMessage['guidanceLabel']>
type ReviewStatus = NonNullable<ChatMessage['reviewSummary']>['status']

const reviewStatusPresentation: Record<
  ReviewStatus,
  { label: string; className: string; icon: LucideIcon }
> = {
  PENDING: {
    label: 'Pending review',
    className: 'border-warning/30 bg-warning/10 text-warning',
    icon: Clock3,
  },
  IN_REVIEW: {
    label: 'Under review',
    className: 'border-info/30 bg-info/10 text-info',
    icon: ClipboardCheck,
  },
  RESOLVED: {
    label: 'Reviewed',
    className: 'border-success/30 bg-success/10 text-success',
    icon: CircleCheck,
  },
  REJECTED: {
    label: 'Review rejected',
    className: 'border-destructive/30 bg-destructive/10 text-destructive',
    icon: CircleX,
  },
}

const guidancePresentation: Record<
  GuidanceLabel,
  {
    label: string
    supportingLabel?: string
    className: string
    icon?: LucideIcon
  }
> = {
  COURSE_GROUNDED: {
    label: 'GROUNDED IN COURSE SOURCES',
    supportingLabel: 'Course-grounded guidance',
    className: 'border-success/25 bg-success/10 text-success',
    icon: FileText,
  },
  GENERAL_NOT_FOUND: {
    label: 'GENERAL GUIDANCE · NOT FROM COURSE SOURCES',
    supportingLabel: 'Course evidence not found',
    className: 'border-border bg-secondary text-muted-foreground',
  },
  UNCERTAIN_AWAITING_REVIEW: {
    label: 'AWAITING INSTRUCTOR REVIEW',
    className: 'border-warning/25 bg-warning/10 text-warning',
    icon: ClipboardCheck,
  },
  INSTRUCTOR_REVIEWED: {
    label: 'INSTRUCTOR-REVIEWED',
    className: 'border-gold/25 bg-gold/10 text-gold',
    icon: BookMarked,
  },
  REFUSAL: {
    label: 'GUIDANCE REFUSED',
    supportingLabel: 'Request declined',
    className: 'border-border bg-secondary text-muted-foreground',
  },
}

export function StudentChatMessage({
  message,
  isGenerationActive,
  retryError,
  retryMessageId,
  onRetry,
  onRequestReview,
}: StudentChatMessageProps) {
  const isStudent = message.role === 'STUDENT'
  const isSystem = message.role === 'SYSTEM'
  const isAssistantPending =
    message.role === 'ASSISTANT' &&
    (message.status === 'PENDING' || message.status === 'STREAMING')
  const previousStatusRef = useRef(message.status)
  const terminalAnnouncementRef = useRef<HTMLSpanElement>(null)
  const [isCopied, setIsCopied] = useState(false)
  const [feedback, setFeedback] = useState<'like' | 'dislike' | null>(null)
  const canRetry =
    message.role === 'ASSISTANT' &&
    message.status === 'FAILED' &&
    message.responseToMessageId !== null
  const hasRetryError =
    Boolean(retryError) && message.responseToMessageId === retryMessageId
  const canRequestReview =
    message.role === 'ASSISTANT' &&
    message.status === 'COMPLETED' &&
    message.completedAt !== null &&
    message.reviewSummary === null
  const showResponseActions =
    message.role === 'ASSISTANT' && message.status === 'COMPLETED'
  const reviewSummary = message.reviewSummary
  const hasTerminalReview =
    reviewSummary?.status === 'RESOLVED' || reviewSummary?.status === 'REJECTED'
  const showGuidanceBadge =
    message.guidanceLabel !== 'UNCERTAIN_AWAITING_REVIEW' || !hasTerminalReview
  const reviewDetailQuery = useStudentReviewDetail({
    reviewCaseId: reviewSummary?.reviewCaseId ?? null,
    enabled: message.role === 'ASSISTANT' && hasTerminalReview,
  })

  const copyResponse = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setIsCopied(true)
    } catch {
      setIsCopied(false)
    }
  }

  useEffect(() => {
    const previousStatus = previousStatusRef.current
    previousStatusRef.current = message.status
    const wasPending =
      previousStatus === 'PENDING' || previousStatus === 'STREAMING'
    if (!wasPending || isAssistantPending || message.role !== 'ASSISTANT') {
      return
    }

    const announcement =
      message.status === 'FAILED'
        ? STUDENT_CHAT_FAILURE_STATUS
        : STUDENT_CHAT_COMPLETION_STATUS
    terminalAnnouncementRef.current?.setAttribute('aria-label', announcement)
    if (terminalAnnouncementRef.current) {
      terminalAnnouncementRef.current.textContent = announcement
    }
  }, [isAssistantPending, message.role, message.status])

  useEffect(() => {
    if (!isCopied) return

    const resetCopyState = window.setTimeout(() => setIsCopied(false), 2_000)
    return () => window.clearTimeout(resetCopyState)
  }, [isCopied])

  if (isSystem) {
    return (
      <li className="flex justify-center">
        <p className="footnote max-w-prose break-words text-center">
          <span className="sr-only">System: </span>
          {message.content}
        </p>
      </li>
    )
  }

  return (
    <li
      id={`message-${message.id}`}
      tabIndex={-1}
      className={cn(
        'flex items-end gap-3',
        isStudent ? 'flex-row-reverse' : 'flex-row',
      )}
    >
      <div
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-full',
          isStudent
            ? 'bg-secondary text-foreground'
            : 'bg-primary/10 text-primary',
        )}
        aria-hidden
      >
        {isStudent ? (
          <GraduationCap className="size-4" />
        ) : (
          <Logo className="size-8" iconClassName="size-4" />
        )}
      </div>
      <div className="max-w-[min(90%,44rem)]">
        <div
          className={cn(
            'px-4 py-3 text-base leading-[1.6] transition-colors',
            isStudent
              ? 'rounded-2xl rounded-br-lg bg-chat-student text-foreground'
              : 'rounded-2xl rounded-bl-lg border bg-card text-card-foreground shadow-xs',
            (reviewSummary?.status === 'PENDING' ||
              reviewSummary?.status === 'IN_REVIEW') &&
              'border-warning/35 bg-warning/[0.04] shadow-[inset_3px_0_0_hsl(var(--warning)/0.45)]',
          )}
        >
          <span className="sr-only">{isStudent ? 'You' : 'AI Tutor'}: </span>

          {!isStudent ? (
            <div className="mb-2 flex min-h-8 items-center gap-3 border-b border-border/60 pb-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">
                  AI Tutor
                </span>
                {reviewSummary ? (
                  <ReviewStatusBadge status={reviewSummary.status} />
                ) : null}
              </div>
            </div>
          ) : null}

          {isAssistantPending ? (
            <p
              aria-label={STUDENT_CHAT_GENERATION_STATUS}
              aria-live="polite"
              className="flex items-center gap-2 text-muted-foreground"
              role="status"
            >
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
              {STUDENT_CHAT_GENERATION_STATUS}…
            </p>
          ) : isStudent ? (
            <StudentChatContent message={message} />
          ) : (
            <StudentAssistantMarkdown content={message.content} />
          )}

          <span
            ref={terminalAnnouncementRef}
            aria-atomic="true"
            aria-live="polite"
            className="sr-only"
            role="status"
          />

          {isStudent && message.status === 'PENDING' ? (
            <p className="mt-1 text-xs opacity-75">Sending…</p>
          ) : null}

          {message.guidanceLabel === 'GENERAL_NOT_FOUND' &&
          message.citations.length === 0 ? (
            <p className="mt-3 border-t border-border/70 pt-3 text-xs text-muted-foreground">
              No supporting course sources were found.
            </p>
          ) : null}

          <StudentCitationSources citations={message.citations} />

          {canRetry ? (
            <div className="mt-3 border-t border-border pt-3">
              <p className="flex items-start gap-2 text-sm text-foreground">
                <CircleAlert className="mt-1 size-4 shrink-0" aria-hidden />
                The grounded response failed. Your question is saved and can be
                retried without creating another message.
              </p>
              <Button
                className="mt-2"
                disabled={isGenerationActive}
                onClick={() => onRetry(message.responseToMessageId!)}
                size="sm"
                type="button"
                variant="outline"
              >
                {isGenerationActive &&
                message.responseToMessageId === retryMessageId ? (
                  <LoaderCircle className="animate-spin" aria-hidden />
                ) : (
                  <RotateCcw aria-hidden />
                )}
                Retry response
              </Button>

              {hasRetryError ? (
                <Alert className="mt-2">
                  <CircleAlert aria-hidden />
                  <AlertDescription>
                    The retry could not be completed. Your saved question is
                    unchanged, so you can try again.
                  </AlertDescription>
                </Alert>
              ) : null}
            </div>
          ) : null}

          {showResponseActions ? (
            <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2">
              <div className="flex items-center gap-0.5">
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Like response"
                  aria-pressed={feedback === 'like'}
                  className={cn(
                    feedback === 'like' &&
                      'bg-info/15 text-info hover:bg-info/20 hover:text-info',
                  )}
                  onClick={() =>
                    setFeedback((current) =>
                      current === 'like' ? null : 'like',
                    )
                  }
                >
                  <ThumbsUp aria-hidden />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Dislike response"
                  aria-pressed={feedback === 'dislike'}
                  className={cn(
                    feedback === 'dislike' &&
                      'bg-destructive/10 text-destructive',
                  )}
                  onClick={() =>
                    setFeedback((current) =>
                      current === 'dislike' ? null : 'dislike',
                    )
                  }
                >
                  <ThumbsDown aria-hidden />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={isCopied ? 'Response copied' : 'Copy response'}
                  onClick={() => void copyResponse()}
                >
                  {isCopied ? <Check aria-hidden /> : <Copy aria-hidden />}
                </Button>
              </div>
              {canRequestReview ? (
                <StudentReviewRequestDialog
                  messageId={message.id}
                  onSubmit={onRequestReview}
                />
              ) : null}
            </div>
          ) : null}
        </div>

        {!isStudent && hasTerminalReview ? (
          <StudentReviewOutcomeCard
            detail={reviewDetailQuery.data}
            isLoading={reviewDetailQuery.isPending}
            hasError={reviewDetailQuery.isError}
          />
        ) : null}

        {!isStudent &&
        message.requestKind === 'CODE_DIAGNOSIS' &&
        message.status === 'COMPLETED' &&
        message.guidanceLabel === 'COURSE_GROUNDED' ? (
          <Badge
            variant="outline"
            className="mt-2 h-auto max-w-full gap-1.5 border-primary/25 bg-primary/5 px-2.5 py-1 font-mono text-[0.65rem] leading-normal text-primary sm:text-xs"
          >
            <CodeXml className="size-3 shrink-0" aria-hidden />
            STATIC PYTHON DIAGNOSIS
          </Badge>
        ) : null}

        {!isStudent && message.guidanceLabel && showGuidanceBadge ? (
          <GuidanceBadge guidanceLabel={message.guidanceLabel} />
        ) : null}
        {reviewSummary?.status === 'PENDING' ||
        reviewSummary?.status === 'IN_REVIEW' ? (
          <span className="sr-only" role="status" aria-live="polite">
            {reviewSummary.status === 'PENDING'
              ? 'Review requested — pending review'
              : 'Review request is under review'}
          </span>
        ) : null}
      </div>
    </li>
  )
}

function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  const presentation = reviewStatusPresentation[status]
  const Icon = presentation.icon

  return (
    <Badge
      variant="outline"
      className={cn('gap-1 px-2 py-0.5 text-[0.65rem]', presentation.className)}
    >
      <Icon className="size-3" aria-hidden />
      {presentation.label}
    </Badge>
  )
}

function StudentReviewOutcomeCard({
  detail,
  isLoading,
  hasError,
}: {
  detail: ReturnType<typeof useStudentReviewDetail>['data']
  isLoading: boolean
  hasError: boolean
}) {
  if (isLoading) {
    return (
      <div
        className="mt-3 rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground"
        role="status"
      >
        Loading reviewed outcome…
      </div>
    )
  }

  if (hasError || !detail) {
    return (
      <Alert className="mt-3" role="alert">
        <CircleAlert aria-hidden />
        <AlertDescription>
          The reviewed outcome could not be loaded safely.
        </AlertDescription>
      </Alert>
    )
  }

  const isRejected = detail.status === 'REJECTED'
  const outcomeLabel =
    detail.outcome === 'APPROVED'
      ? 'Approved guidance'
      : detail.outcome === 'EDITED'
        ? 'Edited guidance'
        : detail.outcome === 'REPLACED'
          ? 'Replacement guidance'
          : 'Request rejected'
  const visibleContent = isRejected
    ? detail.rejectionReason
    : detail.publishedContent
  const resolvedLabel = detail.resolvedAt
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(detail.resolvedAt))
    : null

  return (
    <div className="mt-4">
      <div
        className={cn(
          'mb-4 flex items-center gap-3 text-xs font-medium',
          isRejected ? 'text-destructive' : 'text-success',
        )}
        aria-hidden
      >
        <span className="h-px flex-1 bg-border" />
        {isRejected ? (
          <Flag className="size-3.5" />
        ) : (
          <ShieldCheck className="size-3.5" />
        )}
        <span>
          {isRejected ? 'Reviewed — no correction' : 'Reviewed answer'}
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <section
        aria-label="Reviewed outcome"
        className={cn(
          'rounded-2xl border px-4 py-4 shadow-xs sm:px-5',
          isRejected
            ? 'border-destructive/35 bg-destructive/[0.06]'
            : 'border-success/35 bg-success/[0.07]',
        )}
      >
        <div className="mb-3 flex items-start gap-3">
          <span
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-full',
              isRejected
                ? 'bg-destructive text-destructive-foreground'
                : 'bg-success text-success-foreground',
            )}
            aria-hidden
          >
            {isRejected ? (
              <Flag className="size-4" />
            ) : (
              <ShieldCheck className="size-4" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-foreground">
              {isRejected ? 'Review Closed — No Change' : 'Reviewed Guidance'}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {outcomeLabel}
              {resolvedLabel ? ` · ${resolvedLabel}` : ''}
            </p>
          </div>
          <Badge
            variant="outline"
            className={cn(
              'hidden shrink-0 sm:inline-flex',
              isRejected
                ? 'border-destructive/30 bg-background/70 text-destructive'
                : 'border-success/30 bg-background/70 text-success',
            )}
          >
            {isRejected ? 'Closed' : 'Published'}
          </Badge>
        </div>
        {visibleContent ? (
          isRejected ? (
            <p className="whitespace-pre-wrap break-words text-sm leading-7 text-foreground">
              {visibleContent}
            </p>
          ) : (
            <StudentAssistantMarkdown
              className="text-sm leading-7 text-foreground"
              content={visibleContent}
            />
          )
        ) : null}
      </section>
    </div>
  )
}

function GuidanceBadge({ guidanceLabel }: { guidanceLabel: GuidanceLabel }) {
  const presentation = guidancePresentation[guidanceLabel]
  const Icon = presentation.icon

  return (
    <div className="flex max-w-full flex-wrap items-center gap-2">
      <Badge
        variant="outline"
        className={cn(
          'h-auto max-w-full flex-wrap gap-1.5 px-2.5 py-1 font-mono text-[0.65rem] text-balance leading-normal sm:text-xs',
          presentation.className,
        )}
      >
        {Icon ? <Icon className="size-3 shrink-0" aria-hidden /> : null}
        <span className="max-w-full break-words">{presentation.label}</span>
      </Badge>
      {presentation.supportingLabel ? (
        <span className="footnote text-[0.7rem] text-muted-foreground">
          {presentation.supportingLabel}
        </span>
      ) : null}
    </div>
  )
}
