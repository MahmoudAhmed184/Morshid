import { MessageSquareText, Sparkles } from 'lucide-react'

import { EmptyState } from '@/components/ui/custom/empty-state'
import { ErrorState } from '@/components/ui/custom/error-state'
import { isApiError } from '@/features/auth/api/authenticated-api-client'
import { cn } from '@/lib/utils'

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

/** Eight-pointed guiding-star mark for the workspace's warm first-run moments. */
function GuidingStar({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('size-6', className)}
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M4.8 4.8h14.4v14.4H4.8zM12 1.5l10.5 10.5L12 22.5 1.5 12z"
        opacity="0.95"
      />
      <circle cx="12" cy="12" r="2.6" fill="currentColor" opacity="0.4" />
    </svg>
  )
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
        icon={<GuidingStar />}
        title="No conversations yet"
        description="Start a private conversation and your tutor will guide you through this course, one question at a time."
        className="w-full max-w-md border-0 bg-transparent"
      />
    )
  }

  return (
    <EmptyState
      icon={<Sparkles className="size-6" aria-hidden />}
      title="Choose a conversation"
      description="Pick a conversation from the list to pick up exactly where you left off."
      className="w-full max-w-md border-0 bg-transparent"
    />
  )
}
