import { Bot, LoaderCircle, MessageSquareText } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/custom/empty-state'
import { ErrorState } from '@/components/ui/custom/error-state'
import {
  isStudentChatApiError,
  STUDENT_CHAT_ERROR_CODES,
} from '@/features/student/data/student-chat.errors'
import type { ChatMessage } from '@/features/student/schemas/student-chat.schema'

import { StudentChatMessage } from './student-chat-message'

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
  onRetry: () => void
  onLoadMore: () => void
  onRecover: () => void
  onRetryResponse: (studentMessageId: string) => void
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
  onRetry,
  onLoadMore,
  onRecover,
  onRetryResponse,
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
      <div className="flex min-h-[50vh] items-center justify-center px-4 text-center">
        <div>
          <div className="mx-auto flex size-10 items-center justify-center rounded-full border border-border bg-card">
            <MessageSquareText className="size-5" aria-hidden />
          </div>
          <h2 className="mt-4 text-balance text-2xl font-semibold tracking-tight text-foreground">
            What can I help you learn?
          </h2>
          <p className="mt-2 text-pretty text-sm text-muted-foreground">
            Ask a question about your course materials.
          </p>
        </div>
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
      <ol aria-label="Conversation history" className="space-y-3">
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
          <li className="flex gap-3 py-2" role="status">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Bot className="size-4" aria-hidden />
            </div>
            <div className="flex items-center gap-2 px-1 py-1 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
              Thinking…
            </div>
          </li>
        ) : null}
      </ol>
      {isError ? (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-border bg-muted/40 px-3 py-3 text-center"
        >
          <p className="text-sm text-foreground">
            {isFetchNextPageError
              ? 'More messages could not be loaded.'
              : 'Conversation refresh failed.'}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={isFetchNextPageError ? onLoadMore : onRetry}
          >
            Retry loading messages
          </Button>
        </div>
      ) : null}
    </div>
  )
}
