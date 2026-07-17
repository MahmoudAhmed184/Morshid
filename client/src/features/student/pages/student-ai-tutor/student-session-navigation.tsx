import { Link } from '@tanstack/react-router'
import { MessageSquareText } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { ErrorState } from '@/components/ui/custom/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import type { ChatSession } from '@/features/student/schemas/student-chat.schema'
import { cn } from '@/lib/utils'

import { StudentSessionNavigationSkeleton } from './student-session-navigation-skeleton'

interface StudentSessionNavigationProps {
  courseId: string
  sessions: ChatSession[]
  selectedSessionId?: string
  isPending: boolean
  isError: boolean
  isRefreshing: boolean
  onRetry: () => void
}

export function StudentSessionNavigation({
  courseId,
  sessions,
  selectedSessionId,
  isPending,
  isError,
  isRefreshing,
  onRetry,
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
        {isPending ? (
          <Skeleton className="h-5 w-8 rounded-full" />
        ) : isRefreshing ? (
          <Badge variant="outline">Refreshing</Badge>
        ) : (
          <Badge variant="secondary">{sessions.length}</Badge>
        )}
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
              {sessions.map((session) => {
                const isSelected = session.id === selectedSessionId

                return (
                  <li key={session.id}>
                    <Link
                      to="/student/ai-tutor"
                      search={{ courseId, sessionId: session.id }}
                      aria-current={isSelected ? 'page' : undefined}
                      className={cn(
                        'block rounded-md px-3 py-2.5 text-sm transition-colors',
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'text-foreground hover:bg-muted',
                      )}
                    >
                      <span className="block truncate font-medium">
                        {session.title}
                      </span>
                      <span
                        className={cn(
                          'mt-1 block text-xs',
                          isSelected
                            ? 'text-primary-foreground/75'
                            : 'text-muted-foreground',
                        )}
                      >
                        {session.lastMessageAt
                          ? 'Conversation history saved'
                          : 'No messages yet'}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>
        ) : null}
      </div>
    </aside>
  )
}
