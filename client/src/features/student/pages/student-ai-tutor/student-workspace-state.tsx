import { MessageSquareText } from 'lucide-react'

import { EmptyState } from '@/components/ui/custom/empty-state'
import { ErrorState } from '@/components/ui/custom/error-state'
import { isApiError } from '@/features/auth/api/authenticated-api-client'

import { StudentMessageHistorySkeleton } from './student-message-history-skeleton'

interface StudentWorkspaceStateProps {
  sessionId?: string
  sessionsPending: boolean
  sessionsError: boolean
  hasSessions: boolean
  sessionPending: boolean
  sessionError: unknown
  sessionRetrying: boolean
  onRetrySession: () => void
}

export function StudentWorkspaceState({
  sessionId,
  sessionsPending,
  sessionsError,
  hasSessions,
  sessionPending,
  sessionError,
  sessionRetrying,
  onRetrySession,
}: StudentWorkspaceStateProps) {
  if (sessionsPending || (sessionId !== undefined && sessionPending)) {
    return <StudentMessageHistorySkeleton />
  }

  if (sessionsError) {
    return (
      <EmptyState
        title="Workspace unavailable"
        description="Retry the conversation list to continue."
        className="w-full max-w-md border-0 bg-transparent"
      />
    )
  }

  if (
    sessionId &&
    sessionError &&
    !(
      isApiError(sessionError) &&
      sessionError.code === 'STUDENT_CHAT_SESSION_NOT_FOUND'
    )
  ) {
    return (
      <ErrorState
        title="Conversation unavailable"
        description="The selected conversation could not be loaded."
        onRetry={onRetrySession}
        isRetrying={sessionRetrying}
        className="w-full max-w-md border-0 bg-transparent"
      />
    )
  }

  if (sessionId) {
    return (
      <EmptyState
        icon={<MessageSquareText className="size-6" aria-hidden />}
        title="Conversation unavailable"
        description="This conversation may have been deleted or does not belong to the selected course."
        className="w-full max-w-md border-0 bg-transparent"
      />
    )
  }

  if (!hasSessions) {
    return (
      <EmptyState
        icon={<MessageSquareText className="size-6" aria-hidden />}
        title="No conversations yet"
        description="Start a private conversation and your tutor will guide you through this course, one question at a time."
        className="w-full max-w-md border-0 bg-transparent"
      />
    )
  }

  return (
    <EmptyState
      icon={<MessageSquareText className="size-6" aria-hidden />}
      title="Choose a conversation"
      description="Pick a conversation from the list to pick up exactly where you left off."
      className="w-full max-w-md border-0 bg-transparent"
    />
  )
}
