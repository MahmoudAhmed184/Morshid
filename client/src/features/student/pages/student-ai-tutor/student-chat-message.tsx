import {
  Bot,
  CircleAlert,
  GraduationCap,
  Info,
  LoaderCircle,
  RotateCcw,
} from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { ChatMessage } from '@/features/student/schemas/student-chat.schema'
import { cn } from '@/lib/utils'

import { StudentCitationSources } from './student-citation-sources'

interface StudentChatMessageProps {
  message: ChatMessage
  isGenerationActive: boolean
  retryError: unknown
  retryMessageId?: string
  onRetry: (studentMessageId: string) => void
}

const guidanceLabels: Partial<
  Record<NonNullable<ChatMessage['guidanceLabel']>, string>
> = {
  COURSE_GROUNDED: 'Course-grounded guidance',
  GENERAL_NOT_FOUND: 'Course evidence not found',
  UNCERTAIN_AWAITING_REVIEW: 'Awaiting review',
  INSTRUCTOR_REVIEWED: 'Instructor-reviewed guidance',
  REFUSAL: 'Request declined',
}

export function StudentChatMessage({
  message,
  isGenerationActive,
  retryError,
  retryMessageId,
  onRetry,
}: StudentChatMessageProps) {
  const isStudent = message.role === 'STUDENT'
  const isSystem = message.role === 'SYSTEM'
  const isAssistantPending =
    message.role === 'ASSISTANT' &&
    (message.status === 'PENDING' || message.status === 'STREAMING')
  const canRetry =
    message.role === 'ASSISTANT' &&
    message.status === 'FAILED' &&
    message.responseToMessageId !== null
  const guidanceLabel = message.guidanceLabel
    ? guidanceLabels[message.guidanceLabel]
    : undefined
  const hasRetryError =
    Boolean(retryError) && message.responseToMessageId === retryMessageId

  return (
    <li
      className={cn(
        'flex gap-3',
        isStudent ? 'flex-row-reverse' : 'flex-row',
        isSystem && 'justify-center',
      )}
    >
      <div
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-full',
          isStudent
            ? 'bg-secondary text-secondary-foreground'
            : 'bg-primary text-primary-foreground',
          isSystem && 'bg-muted text-muted-foreground',
        )}
        aria-hidden
      >
        {isStudent ? (
          <GraduationCap className="size-4" />
        ) : isSystem ? (
          <Info className="size-4" />
        ) : (
          <Bot className="size-4" />
        )}
      </div>
      <div
        className={cn(
          'max-w-[90%] min-w-0 rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm sm:max-w-[85%]',
          isStudent
            ? 'rounded-tr-md bg-primary text-primary-foreground'
            : 'rounded-tl-md border border-border bg-card text-card-foreground',
          isSystem && 'rounded-xl border border-border bg-card',
        )}
      >
        <span className="sr-only">
          {isStudent ? 'You' : isSystem ? 'System' : 'AI Tutor'}:{' '}
        </span>
        {guidanceLabel ? (
          <Badge className="mb-2" variant="secondary">
            {guidanceLabel}
          </Badge>
        ) : null}

        {isAssistantPending ? (
          <p className="flex items-center gap-2 text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
            Grounding your question in course materials…
          </p>
        ) : (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        )}

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
          <div className="mt-3 border-t border-destructive/20 pt-3">
            <p className="flex items-start gap-2 text-sm text-destructive">
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
              <Alert className="mt-2" variant="destructive">
                <CircleAlert aria-hidden />
                <AlertDescription>
                  The retry could not be completed. Your saved question is
                  unchanged, so you can try again.
                </AlertDescription>
              </Alert>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  )
}
