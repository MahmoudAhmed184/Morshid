import {
  BookMarked,
  Check,
  CircleAlert,
  ClipboardCheck,
  Copy,
  FileText,
  GraduationCap,
  LoaderCircle,
  RotateCcw,
  ThumbsDown,
  ThumbsUp,
  Clock3,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Logo } from '@/components/logo'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { ChatMessage } from '@/features/student/schemas/student-chat.schema'
import { cn } from '@/lib/utils'

import { StudentCitationSources } from './student-citation-sources'
import { StudentReviewRequestDialog } from './student-review-request-dialog'
import {
  STUDENT_CHAT_COMPLETION_STATUS,
  STUDENT_CHAT_FAILURE_STATUS,
  STUDENT_CHAT_GENERATION_STATUS,
} from './student-chat-status'

interface StudentChatMessageProps {
  message: ChatMessage
  isGenerationActive: boolean
  retryError: unknown
  retryMessageId?: string
  onRetry: (studentMessageId: string) => void
  onRequestReview: (input: {
    messageId: string
    note: string
  }) => Promise<unknown>
}

type GuidanceLabel = NonNullable<ChatMessage['guidanceLabel']>

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
            'px-4 py-3 text-sm leading-7 transition-colors',
            isStudent
              ? 'rounded-2xl rounded-br-lg bg-accent text-foreground'
              : 'rounded-2xl rounded-bl-lg border bg-card text-card-foreground shadow-xs',
            message.reviewSummary?.status === 'PENDING' &&
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
                {message.reviewSummary?.status === 'PENDING' ? (
                  <Badge
                    variant="outline"
                    className="gap-1 border-warning/30 bg-warning/10 px-2 py-0.5 text-[0.65rem] text-warning"
                  >
                    <Clock3 className="size-3" aria-hidden />
                    Pending review
                  </Badge>
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
          ) : (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
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

        {!isStudent && message.guidanceLabel ? (
          <GuidanceBadge guidanceLabel={message.guidanceLabel} />
        ) : null}
        {message.reviewSummary?.status === 'PENDING' ? (
          <span className="sr-only" role="status" aria-live="polite">
            Review requested — pending Instructor review
          </span>
        ) : null}
      </div>
    </li>
  )
}

function GuidanceBadge({ guidanceLabel }: { guidanceLabel: GuidanceLabel }) {
  const presentation = guidancePresentation[guidanceLabel]
  const Icon = presentation.icon

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 max-w-full">
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
