import { MessageSquareText } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/custom/empty-state'
import { ErrorState } from '@/components/ui/custom/error-state'
import { isApiError } from '@/features/auth/api/authenticated-api-client'
import type { ChatMessage } from '@/features/student/schemas/student-chat.schema'

import { StudentChatMessage } from './student-chat-message'
import { StudentMessageHistorySkeleton } from './student-message-history-skeleton'

interface StudentMessageHistoryProps {
  messages: ChatMessage[]
  error: unknown
  isPending: boolean
  isError: boolean
  isFetching: boolean
  hasNextPage: boolean
  isFetchingNextPage: boolean
  isFetchNextPageError: boolean
  onRetry: () => void
  onLoadMore: () => void
  onRecover: () => void
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
  onRetry,
  onLoadMore,
  onRecover,
}: StudentMessageHistoryProps) {
  if (isPending) {
    return <StudentMessageHistorySkeleton />
  }

  if (
    isError &&
    isApiError(error) &&
    error.code === 'STUDENT_CHAT_SESSION_NOT_FOUND'
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

  if (messages.length === 0) {
    return (
      <EmptyState
        icon={<MessageSquareText className="size-6" aria-hidden />}
        title="No messages yet"
        description="Saved messages will appear here when this conversation begins."
        className="w-full border-0 bg-transparent"
      />
    )
  }

  return (
    <div>
      <ol aria-label="Conversation history" className="space-y-5">
        {messages.map((message) => (
          <StudentChatMessage key={message.id} message={message} />
        ))}
      </ol>
      {isError ? (
        <div
          role="alert"
          className="mt-6 rounded-md border border-destructive/30 px-3 py-3 text-center"
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
            className="mt-2"
            onClick={isFetchNextPageError ? onLoadMore : onRetry}
          >
            Retry loading messages
          </Button>
        </div>
      ) : hasNextPage ? (
        <div className="mt-6 text-center">
          <Button
            type="button"
            variant="outline"
            disabled={isFetchingNextPage}
            onClick={onLoadMore}
          >
            {isFetchingNextPage
              ? 'Loading more messages…'
              : 'Load more messages'}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
