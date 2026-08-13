import { LoaderCircle, MessageSquareText } from 'lucide-react'

import { Logo } from '@/components/branding/logo'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/custom/empty-state'
import { ErrorState } from '@/components/ui/custom/error-state'
import {
  isChatApiError,
  CHAT_ERROR_CODES,
} from '@/features/chat/messages/chat.errors'
import type { ChatMessage } from '@/features/chat/messages/chat-message.schema'
import type { StudentFlagReason } from '@/features/reviews/interface/student-review.schema'

import { StudentChatMessage } from './chat-message'
import { StudentSuggestionRows } from './suggestion-rows'
import { CHAT_GENERATION_STATUS } from './chat-status'

interface StudentMessageHistoryProps {
  messages: ChatMessage[]
  error: unknown
  isPending: boolean
  isError: boolean
  isFetching: boolean
  hasNextPage: boolean
  isFetchingNextPage: boolean
  isFetchNextPageError: boolean
  isGenerationActive: boolean
  retryError: unknown
  retryMessageId?: string
  firstName?: string
  onRetry: () => void
  onLoadMore: () => void
  onRecover: () => void
  onRetryResponse: (input: {
    attemptId: string
    studentMessageId: string
  }) => void
  onRequestReview: (input: {
    messageId: string
    flagReason: StudentFlagReason
    note: string
  }) => Promise<unknown>
  onSuggestionSelect: (text: string) => void
}

export function StudentMessageHistory({
  messages,
  error,
  isPending,
  isError,
  isFetching,
  hasNextPage,
  isFetchingNextPage,
  isFetchNextPageError,
  isGenerationActive,
  retryError,
  retryMessageId,
  firstName,
  onRetry,
  onLoadMore,
  onRecover,
  onRetryResponse,
  onRequestReview,
  onSuggestionSelect,
}: StudentMessageHistoryProps) {
  if (isPending && !isGenerationActive && messages.length === 0) {
    return (
      <div className="flex min-h-[40vh] w-full items-center justify-center">
        <LoaderCircle
          className="size-6 animate-spin text-muted-foreground"
          aria-hidden
        />
      </div>
    )
  }

  if (isError && isChatApiError(error, CHAT_ERROR_CODES.SESSION_NOT_FOUND)) {
    return (
      <EmptyState
        icon={<MessageSquareText className="size-6" aria-hidden />}
        title="Conversation unavailable"
        description="This conversation was deleted or is no longer available in the selected course."
        action={<Button onClick={onRecover}>Return to conversations</Button>}
        className="w-full border-0 bg-transparent"
      />
    )
  }

  if (isError && messages.length === 0) {
    return (
      <ErrorState
        title="History unavailable"
        description="Your saved messages could not be loaded."
        onRetry={onRetry}
        isRetrying={isFetching}
        className="w-full border-0 bg-transparent"
      />
    )
  }

  if (messages.length === 0 && !isGenerationActive) {
    return (
      <div className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-8 px-4">
        <h2 className="text-balance text-center font-sans text-[clamp(2rem,4vw,3.5rem)] leading-[1.08] font-semibold tracking-[-0.03em] text-foreground">
          {firstName
            ? `How can I help you, ${firstName}?`
            : 'How can I help you?'}
        </h2>
        <StudentSuggestionRows onSelect={onSuggestionSelect} />
      </div>
    )
  }

  const hasPendingAssistant = messages.some(
    (message) =>
      message.role === 'ASSISTANT' &&
      (message.status === 'PENDING' || message.status === 'STREAMING'),
  )

  return (
    <div>
      {hasNextPage && !isError ? (
        <div className="mb-6 text-center">
          <Button
            type="button"
            variant="outline"
            disabled={isFetchingNextPage}
            onClick={onLoadMore}
          >
            {isFetchingNextPage
              ? 'Loading earlier messages…'
              : 'Load earlier messages'}
          </Button>
        </div>
      ) : null}
      <ol aria-label="Conversation history" className="space-y-6">
        {messages.map((message) => (
          <StudentChatMessage
            key={message.id}
            message={message}
            isGenerationActive={isGenerationActive}
            retryError={retryError}
            retryMessageId={retryMessageId}
            onRetry={onRetryResponse}
            onRequestReview={onRequestReview}
          />
        ))}
        {isGenerationActive && !hasPendingAssistant ? (
          <li
            aria-label={CHAT_GENERATION_STATUS}
            aria-live="polite"
            className="flex gap-3 py-2"
            role="status"
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Logo className="size-8" iconClassName="size-4" />
            </div>
            <div className="flex items-center gap-2 px-1 py-1 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
              {CHAT_GENERATION_STATUS}…
            </div>
          </li>
        ) : null}
      </ol>
      {isError ? (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3.5 text-center"
        >
          <p className="text-sm text-destructive">
            {isFetchNextPageError
              ? 'More messages could not be loaded.'
              : 'Conversation refresh failed.'}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2.5"
            onClick={isFetchNextPageError ? onLoadMore : onRetry}
          >
            Retry loading messages
          </Button>
        </div>
      ) : null}
    </div>
  )
}
