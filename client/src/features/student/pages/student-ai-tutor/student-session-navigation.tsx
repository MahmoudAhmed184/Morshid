import { MessageSquareText } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { ErrorState } from '@/components/ui/custom/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import type { ChatSession } from '@/features/student/schemas/student-chat.schema'

import { StudentCreateSessionButton } from './student-create-session-button'
import { StudentSessionListItem } from './student-session-list-item'
import { StudentSessionNavigationSkeleton } from './student-session-navigation-skeleton'

interface StudentSessionNavigationProps {
  courseId: string
  sessions: ChatSession[]
  selectedSessionId?: string
  isPending: boolean
  isError: boolean
  isRefreshing: boolean
  isCreating: boolean
  renamingSessionId?: string
  deletingSessionId?: string
  onRetry: () => void
  onCreate: () => Promise<void>
  onRename: (session: ChatSession, title: string) => Promise<void>
  onDelete: (session: ChatSession) => Promise<void>
}

export function StudentSessionNavigation({
  courseId,
  sessions,
  selectedSessionId,
  isPending,
  isError,
  isRefreshing,
  isCreating,
  renamingSessionId,
  deletingSessionId,
  onRetry,
  onCreate,
  onRename,
  onDelete,
}: StudentSessionNavigationProps) {
  return (
    <aside className="border-b border-border bg-muted/15 md:border-r md:border-b-0">
      <header className="flex min-h-14 items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Conversations
          </h2>
          <p className="text-xs text-muted-foreground">
            Private to your account
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isPending ? (
            <Skeleton className="h-5 w-8 rounded-full" />
          ) : isRefreshing ? (
            <Badge variant="outline">Refreshing</Badge>
          ) : (
            <Badge variant="secondary">{sessions.length}</Badge>
          )}
          <StudentCreateSessionButton
            isPending={isCreating}
            onCreate={onCreate}
          />
        </div>
      </header>

      <div className="max-h-64 overflow-y-auto p-3 md:max-h-none">
        {isPending ? <StudentSessionNavigationSkeleton /> : null}

        {isError ? (
          <ErrorState
            title="Sessions unavailable"
            description="Check your connection and try loading your conversations again."
            onRetry={onRetry}
            className="min-h-0 px-3 py-6"
          />
        ) : null}

        {!isPending && !isError && sessions.length === 0 ? (
          <div className="rounded-md border border-dashed border-border px-3 py-8 text-center">
            <MessageSquareText
              className="mx-auto size-5 text-muted-foreground"
              aria-hidden
            />
            <p className="mt-3 text-sm font-medium text-foreground">
              No conversations yet
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Create a conversation to start working in this course.
            </p>
          </div>
        ) : null}

        {!isPending && !isError && sessions.length > 0 ? (
          <nav aria-label="Course conversations">
            <ul className="space-y-1">
              {sessions.map((session) => (
                <StudentSessionListItem
                  key={session.id}
                  courseId={courseId}
                  session={session}
                  isSelected={session.id === selectedSessionId}
                  isRenaming={renamingSessionId === session.id}
                  isDeleting={deletingSessionId === session.id}
                  onRename={(title) => onRename(session, title)}
                  onDelete={() => onDelete(session)}
                />
              ))}
            </ul>
          </nav>
        ) : null}
      </div>
    </aside>
  )
}
