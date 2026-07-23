import { LoaderCircle, MessageSquareText } from 'lucide-react'

import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/custom/empty-state'
import { ErrorState } from '@/components/ui/custom/error-state'
import {
  isStudentChatApiError,
  STUDENT_CHAT_ERROR_CODES,
} from '@/features/student/data/student-chat.errors'
import type { ChatMessage } from '@/features/student/schemas/student-chat.schema'

import { StudentChatMessage } from './student-chat-message'
import { StudentSuggestionRows } from './student-suggestion-rows'
import { STUDENT_CHAT_GENERATION_STATUS } from './student-chat-status'

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
  onRetryResponse: (studentMessageId: string) => void
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
  onSuggestionSelect,
}: StudentMessageHistoryProps) {
  if (isPending) {
    return null
  }

  if (
    isError &&
    isStudentChatApiError(error, STUDENT_CHAT_ERROR_CODES.SESSION_NOT_FOUND)
  ) {
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
        <h2 className="display-2 text-center text-foreground">
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
          />
        ))}
        {isGenerationActive && !hasPendingAssistant ? (
          <li
            aria-label={STUDENT_CHAT_GENERATION_STATUS}
            aria-live="polite"
            className="flex gap-3 py-2"
            role="status"
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Logo className="size-8" iconClassName="size-4" />
            </div>
            <div className="flex items-center gap-2 px-1 py-1 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
              {STUDENT_CHAT_GENERATION_STATUS}…
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
