import { Link } from '@tanstack/react-router'
import {
  ArrowUp,
  BookOpen,
  Check,
  ChevronDown,
  CircleAlert,
  Flag,
  Zap,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { useAuthStore } from '@/features/auth/session/interface/session-store'
import {
  useStudentReviewAllowance,
  useStudentTutoringAllowance,
} from '@/features/allowances/interface'
import { useStudentCourseContext } from '@/workspaces/student/navigation/student-course-context'
import { useChatSessionSummary } from '@/workspaces/student/tutor-workspace/use-chat-sessions'
import { useComposerDraft } from '@/features/chat/drafts/use-composer-draft'
import {
  isChatApiError,
  CHAT_ERROR_CODES,
} from '@/features/chat/messages/chat.errors'
import {
  sendChatMessageRequestSchema,
  chatMessageContentSchema,
} from '@/features/chat/messages/chat-message.schema'
import type { ChatMessage } from '@/features/chat/messages/chat-message.schema'
import { cn } from '@/lib/utils'
import {
  calculateConversationMetrics,
  formatTokens,
} from './conversation-metrics'

const maximumMessageCodePoints = 4_000

export interface StudentChatComposerActions {
  prefill: (text: string) => void
  submitWith: (text: string, clientMessageId: string) => void
  focus: () => void
  discardDraft?: () => void
}

interface StudentChatComposerProps {
  isGenerating: boolean
  sendError: unknown
  onDismissError: () => void
  onSend: (content: string, clientMessageId: string) => Promise<boolean>
  onActionsReady: (actions: StudentChatComposerActions | null) => void
  userId?: string
  courseId?: string
  sessionId?: string
  messages?: readonly ChatMessage[]
  debounceMs?: number
  storage?: Storage
}

export function StudentChatComposer({
  isGenerating,
  sendError,
  onDismissError,
  onSend,
  onActionsReady,
  userId,
  courseId,
  sessionId = 'new',
  messages = [],
  debounceMs,
  storage,
}: StudentChatComposerProps) {
  const [draft, setDraft] = useState('')
  const currentStudentId = useAuthStore((state) => state.user?.id)
  const effectiveUserId = userId ?? currentStudentId
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const clientMessageIdRef = useRef<string | null>(null)
  const autoSubmitRef = useRef(false)
  const wasGeneratingRef = useRef(isGenerating)

  const { courses: assignedCourses, activeCourse } = useStudentCourseContext()

  const tutoringAllowanceQuery = useStudentTutoringAllowance(courseId)
  const reviewAllowanceQuery = useStudentReviewAllowance(courseId)
  const sessionSummaryQuery = useChatSessionSummary({ courseId, sessionId })

  const tutoringAllowance = tutoringAllowanceQuery.data
  const reviewAllowance = reviewAllowanceQuery.data
  const sessionSummary = sessionSummaryQuery.data

  const isAllowanceExhausted =
    tutoringAllowance !== undefined && tutoringAllowance.remaining === 0
  const isAllowanceLow =
    tutoringAllowance !== undefined &&
    tutoringAllowance.remaining > 0 &&
    tutoringAllowance.remaining <= 3

  const metrics = calculateConversationMetrics(messages, sessionSummary)
  const isTurnLimitExhausted =
    sessionSummary?.isTurnLimitExhausted ?? metrics.turnsRemaining === 0

  const reviewsRemaining =
    reviewAllowance?.remaining ?? reviewAllowance?.limit ?? 3
  const reviewsLimit = reviewAllowance?.limit ?? 3

  const { isRestored, storageError, discardDraft, clearSavedDraft } =
    useComposerDraft({
      userId: effectiveUserId,
      courseId,
      sessionId,
      draft,
      setDraft,
      debounceMs,
      storage,
    })

  const canSend =
    !isGenerating &&
    !isAllowanceExhausted &&
    !isTurnLimitExhausted &&
    chatMessageContentSchema.safeParse(draft).success

  useEffect(() => {
    onActionsReady({
      prefill: (text: string) => {
        setDraft(limitMessageDraft(text))
        clientMessageIdRef.current = null
        textareaRef.current?.focus()
      },
      submitWith: (text: string, clientMessageId: string) => {
        setDraft(limitMessageDraft(text))
        clientMessageIdRef.current = clientMessageId
        autoSubmitRef.current = true
      },
      focus: () => {
        textareaRef.current?.focus()
      },
      discardDraft: () => {
        discardDraft()
      },
    })

    return () => {
      onActionsReady(null)
    }
  }, [onActionsReady, discardDraft])

  useEffect(() => {
    const generationFinished = wasGeneratingRef.current && !isGenerating
    wasGeneratingRef.current = isGenerating

    if (generationFinished) {
      textareaRef.current?.focus()
    }
  }, [isGenerating])

  useEffect(() => {
    if (autoSubmitRef.current && canSend) {
      autoSubmitRef.current = false
      formRef.current?.requestSubmit()
    }
  }, [canSend])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!canSend) {
      return
    }

    clientMessageIdRef.current ??= crypto.randomUUID()
    const parsed = sendChatMessageRequestSchema.safeParse({
      clientMessageId: clientMessageIdRef.current,
      content: draft,
    })
    if (!parsed.success) {
      return
    }

    const wasSent = await onSend(
      parsed.data.content,
      parsed.data.clientMessageId,
    )
    if (wasSent) {
      clearSavedDraft()
      clientMessageIdRef.current = null
      setDraft('')
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key !== 'Enter' ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    ) {
      return
    }

    event.preventDefault()
    if (canSend) {
      event.currentTarget.form?.requestSubmit()
    }
  }

  const currentCourseDisplay = activeCourse
    ? activeCourse.code || activeCourse.title
    : 'Select course'

  return (
    <form
      ref={formRef}
      aria-label="Message composer"
      className="shrink-0"
      onSubmit={(event) => void handleSubmit(event)}
    >
      {isRestored && (
        <div
          role="status"
          aria-live="polite"
          className="mx-auto mb-2 flex max-w-3xl items-center justify-between gap-2 rounded-xl border border-border bg-secondary/60 px-3.5 py-1.5 text-xs text-muted-foreground"
        >
          <span>Draft restored from this device.</span>
          <button
            type="button"
            onClick={discardDraft}
            className="font-medium text-foreground underline underline-offset-2 hover:text-foreground/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded px-1"
            aria-label="Discard restored draft"
          >
            Discard draft
          </button>
        </div>
      )}

      {storageError && (
        <div
          role="status"
          aria-live="polite"
          className="mx-auto mb-2 flex max-w-3xl items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-1.5 text-xs text-destructive"
        >
          <span>
            Draft could not be saved to this device (storage unavailable or
            full).
          </span>
        </div>
      )}

      {isAllowanceExhausted && (
        <div
          role="status"
          aria-live="polite"
          className="mx-auto mb-2 flex max-w-3xl items-center justify-between gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-2 text-xs text-destructive"
          data-testid="allowance-exhausted-banner"
        >
          <span>
            You have reached your daily tutoring allowance for this course (0
            turns remaining).
            {tutoringAllowance.resetAt && (
              <>
                {' '}
                Turns reset at{' '}
                {new Date(tutoringAllowance.resetAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                ({tutoringAllowance.policyTimeZone}).
              </>
            )}
          </span>
        </div>
      )}

      {isTurnLimitExhausted && !isAllowanceExhausted && (
        <div
          role="status"
          aria-live="polite"
          className="mx-auto mb-2 flex max-w-3xl items-center justify-between gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-2 text-xs text-destructive"
          data-testid="turn-limit-exhausted-banner"
        >
          <span>
            You have reached the per-conversation limit of {metrics.turnLimit}{' '}
            turns for this session. Start a new chat to continue.
          </span>
        </div>
      )}

      {isAllowanceLow && !isAllowanceExhausted && (
        <div
          role="status"
          aria-live="polite"
          className="mx-auto mb-2 flex max-w-3xl items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-1.5 text-xs text-amber-900 dark:text-amber-200"
          data-testid="allowance-low-banner"
        >
          <span>
            {tutoringAllowance.remaining}{' '}
            {tutoringAllowance.remaining === 1 ? 'turn' : 'turns'} remaining
            today for this course.
          </span>
        </div>
      )}

      <div className="glass-paper mx-auto max-w-3xl rounded-2xl border border-border-strong bg-card/85 p-3 shadow-md focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30 transition-all">
        <Textarea
          ref={textareaRef}
          aria-describedby="chat-composer-hint chat-composer-error"
          aria-invalid={Boolean(sendError)}
          aria-label="Message"
          autoComplete="off"
          className="min-h-12 max-h-40 w-full resize-none border-0 bg-transparent px-1 pt-1 pb-2 text-base! leading-relaxed shadow-none focus-visible:ring-0 md:text-base!"
          disabled={
            isGenerating || isAllowanceExhausted || isTurnLimitExhausted
          }
          name="chat-message"
          onChange={(event) => {
            setDraft(limitMessageDraft(event.target.value))
            clientMessageIdRef.current = null
            if (sendError) {
              onDismissError()
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={
            isTurnLimitExhausted
              ? 'Conversation turn limit reached (30 turns). Start a new chat.'
              : isAllowanceExhausted
                ? 'Daily tutoring allowance reached for this course.'
                : 'Ask a conceptual question about this course…'
          }
          rows={1}
          value={draft}
        />

        <div className="flex items-center justify-between gap-2 pt-1">
          {/* Status Row Controls: Left Side */}
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            {/* Course Context Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7.5 gap-1.5 rounded-full border border-border/60 bg-secondary/40 px-2.5 text-xs font-medium text-foreground hover:bg-secondary/70 hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
                    aria-label={`Course context: ${currentCourseDisplay}`}
                  />
                }
              >
                <BookOpen
                  className="size-3.5 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <span className="max-w-[120px] sm:max-w-[160px] truncate">
                  {currentCourseDisplay}
                </span>
                <ChevronDown
                  className="size-3 shrink-0 text-muted-foreground/80"
                  aria-hidden
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-60 max-w-[90vw]">
                {assignedCourses.map((course) => (
                  <DropdownMenuItem
                    key={course.id}
                    render={
                      <Link to="/chat" search={{ courseId: course.id }} />
                    }
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {course.code
                        ? `${course.code} · ${course.title}`
                        : course.title}
                    </span>
                    {activeCourse && course.id === activeCourse.id ? (
                      <Check className="size-4 text-foreground" aria-hidden />
                    ) : null}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Per-conversation Turn Limit Pill */}
            <div
              className={cn(
                'flex flex-col justify-center rounded-full border border-border/60 bg-secondary/40 px-2.5 py-1 text-xs font-medium text-foreground min-w-fit h-7.5 select-none',
                isTurnLimitExhausted &&
                  'border-destructive/40 bg-destructive/10 text-destructive',
              )}
              title={`${metrics.turnsRemaining} turns remaining out of ${metrics.turnLimit} in this conversation`}
            >
              <div className="flex items-center gap-1.5">
                <Zap
                  className={cn(
                    'size-3.5 shrink-0',
                    isTurnLimitExhausted
                      ? 'text-destructive'
                      : 'text-muted-foreground',
                  )}
                  aria-hidden
                />
                <span className="tabular-nums">
                  Turns left {metrics.turnsRemaining} / {metrics.turnLimit}
                </span>
              </div>
              <div className="mt-0.5 h-0.5 w-full rounded-full bg-muted/60 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-300',
                    isTurnLimitExhausted
                      ? 'bg-destructive'
                      : metrics.turnsRemaining <= 3
                        ? 'bg-amber-500'
                        : 'bg-emerald-500',
                  )}
                  style={{
                    width: `${(metrics.turnsRemaining / metrics.turnLimit) * 100}%`,
                  }}
                />
              </div>
            </div>

            {/* Review Requests Left Pill */}
            <div
              className="flex flex-col justify-center rounded-full border border-border/60 bg-secondary/40 px-2.5 py-1 text-xs font-medium text-foreground min-w-fit h-7.5 select-none"
              title={`${reviewsRemaining} review requests remaining today for this course`}
            >
              <div className="flex items-center gap-1.5">
                <Flag
                  className="size-3.5 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <span className="tabular-nums">
                  Reviews left {reviewsRemaining} / {reviewsLimit}
                </span>
              </div>
              <div className="mt-0.5 h-0.5 w-full rounded-full bg-muted/60 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-300',
                    reviewsRemaining === 0
                      ? 'bg-destructive'
                      : reviewsRemaining <= 1
                        ? 'bg-amber-500'
                        : 'bg-emerald-500',
                  )}
                  style={{
                    width: `${(reviewsRemaining / reviewsLimit) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Status Row Controls: Right Side */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Info Control Popover */}
            <Popover>
              <PopoverTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-full border border-border/60 bg-secondary/40 text-muted-foreground hover:bg-secondary/80 hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring transition-colors relative flex items-center justify-center cursor-pointer"
                    aria-label="Session summary"
                  />
                }
              >
                <ContextRing percent={metrics.contextPercent} />
              </PopoverTrigger>
              <PopoverContent
                align="end"
                side="top"
                sideOffset={8}
                className="w-72 sm:w-80 rounded-2xl border border-border/80 bg-popover/95 p-4 shadow-2xl backdrop-blur-md text-popover-foreground"
              >
                <h4 className="text-sm font-semibold tracking-tight text-foreground mb-3">
                  Session summary
                </h4>

                <div className="space-y-3 text-xs">
                  {/* Context usage */}
                  <div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="font-medium">Context usage</span>
                      <span className="font-mono font-medium text-foreground">
                        {metrics.contextPercent}% ·{' '}
                        {formatTokens(metrics.contextTokens)}/
                        {formatTokens(metrics.maxContextTokens)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full rounded-full bg-secondary/80 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                        style={{ width: `${metrics.contextPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Total processed */}
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-muted-foreground">
                      Total processed
                    </span>
                    <span className="font-mono font-medium text-foreground">
                      {formatTokens(metrics.totalProcessedTokens)}
                    </span>
                  </div>

                  {/* Progress in this chat */}
                  <div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="font-medium">Progress in this chat</span>
                      <span className="font-mono font-medium text-foreground">
                        {metrics.turnsUsed}/{metrics.turnLimit} exchanges
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full rounded-full bg-secondary/80 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                        style={{
                          width: `${(metrics.turnsUsed / metrics.turnLimit) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Footnote / Reset explanation */}
                <div className="mt-3.5 pt-2.5 border-t border-border/40 text-[11px] leading-relaxed text-muted-foreground">
                  {sessionSummary?.resetAt || tutoringAllowance?.resetAt ? (
                    <>
                      Daily tutoring allowance resets at{' '}
                      {new Date(
                        sessionSummary?.resetAt ??
                          tutoringAllowance?.resetAt ??
                          '',
                      ).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      (
                      {sessionSummary?.policyTimeZone ??
                        tutoringAllowance?.policyTimeZone}
                      ). Each chat session is limited to {metrics.turnLimit}{' '}
                      turns.
                    </>
                  ) : (
                    <>
                      We stay on track and reference your course when it helps.
                      Each chat session is limited to {metrics.turnLimit} turns.
                    </>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            {/* Send Button */}
            <Button
              aria-label="Send message"
              className="size-8.5 shrink-0 rounded-full bg-primary text-primary-foreground shadow-none disabled:border disabled:border-border/60 disabled:bg-muted/70 disabled:text-muted-foreground/60 transition-colors"
              disabled={!canSend}
              size="icon"
              type="submit"
            >
              <ArrowUp className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      </div>

      {sendError ? (
        <div
          id="chat-composer-error"
          className="mx-auto mt-2 flex max-w-3xl items-start gap-2 rounded-xl border border-border bg-secondary/60 px-3 py-2 text-sm text-foreground"
          role="alert"
        >
          <CircleAlert
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <p>{sendErrorMessage(sendError)}</p>
        </div>
      ) : (
        <span id="chat-composer-error" />
      )}
    </form>
  )
}

function limitMessageDraft(value: string) {
  const trimmed = value.trim()
  const codePoints = Array.from(trimmed)

  if (codePoints.length <= maximumMessageCodePoints) {
    return value
  }

  const leadingWhitespace = value.slice(0, value.indexOf(trimmed))
  return `${leadingWhitespace}${codePoints
    .slice(0, maximumMessageCodePoints)
    .join('')}`
}

function sendErrorMessage(error: unknown) {
  if (
    isChatApiError(error, CHAT_ERROR_CODES.CONVERSATION_TURN_LIMIT_EXHAUSTED)
  ) {
    return 'You have reached the per-conversation limit of 30 turns for this session. Start a new chat to continue.'
  }
  if (isChatApiError(error, CHAT_ERROR_CODES.TUTORING_ALLOWANCE_EXHAUSTED)) {
    return 'You have reached your daily tutoring allowance for this course. Turns will reset at midnight in the policy timezone.'
  }
  if (isChatApiError(error, CHAT_ERROR_CODES.TURN_IN_PROGRESS)) {
    return 'This conversation is already generating a response. Refresh the history before trying again.'
  }
  if (isChatApiError(error, CHAT_ERROR_CODES.SESSION_NOT_FOUND)) {
    return 'This conversation is no longer available.'
  }
  if (isChatApiError(error, CHAT_ERROR_CODES.TERMINAL_STATE_UNAVAILABLE)) {
    return 'Your message may have been saved, but its final state could not be confirmed. Refresh the history before retrying.'
  }

  return 'Your message could not be sent. It remains in the composer so you can try again.'
}

function ContextRing({
  percent,
  className,
}: {
  percent: number
  className?: string
}) {
  const size = 18
  const strokeWidth = 2.5
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset =
    circumference - (Math.min(100, Math.max(0, percent)) / 100) * circumference

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn('rotate-[-90deg] shrink-0', className)}
      aria-hidden="true"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        className="stroke-muted-foreground/25 fill-none"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        className={cn(
          'fill-none transition-all duration-300 ease-out',
          percent > 80 ? 'stroke-amber-500' : 'stroke-foreground/70',
        )}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
      />
    </svg>
  )
}
