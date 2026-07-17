import { MessageSquareText } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/custom/empty-state'
import { ErrorState } from '@/components/ui/custom/error-state'
import { isApiError } from '@/features/auth/api/authenticated-api-client'
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
  onRetry,
  onLoadMore,
  onRecover,
}: StudentMessageHistoryProps) {
  if (isPending) {
    return (
      <div
        role="status"
        aria-label="Loading conversation history"
        aria-busy="true"
        className="min-h-full"
      />
    )
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

  if (isError) {
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
      {hasNextPage ? (
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
