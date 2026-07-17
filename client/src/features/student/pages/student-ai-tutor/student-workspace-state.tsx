import { MessageSquareText } from 'lucide-react'

import { EmptyState } from '@/components/ui/custom/empty-state'

import { StudentMessageHistorySkeleton } from './student-message-history-skeleton'

interface StudentWorkspaceStateProps {
  sessionId?: string
  sessionsPending: boolean
  sessionsError: boolean
  hasSessions: boolean
}

export function StudentWorkspaceState({
  sessionId,
  sessionsPending,
  sessionsError,
  hasSessions,
}: StudentWorkspaceStateProps) {
  if (sessionsPending) {
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
        description="Create a private conversation for this course to get started."
        className="w-full max-w-md border-0 bg-transparent"
      />
    )
  }

  return (
    <EmptyState
      icon={<MessageSquareText className="size-6" aria-hidden />}
      title="Choose a conversation"
      description="Select a conversation from the list to recover its saved history."
      className="w-full max-w-md border-0 bg-transparent"
    />
  )
}
