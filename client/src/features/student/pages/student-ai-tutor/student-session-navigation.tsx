import { MessageSquareText } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { ErrorState } from '@/components/ui/custom/error-state'
import type { ChatSession } from '@/features/student/schemas/student-chat.schema'
import type { StudentCourse } from '@/features/student/schemas/student-course.schema'
import { cn } from '@/lib/utils'

import { StudentCourseSwitcher } from './student-course-switcher'
import { StudentCreateSessionButton } from './student-create-session-button'
import { StudentSessionInfiniteScroll } from './student-session-infinite-scroll'
import { StudentSessionListItem } from './student-session-list-item'
import { StudentSessionNavigationSkeleton } from './student-session-navigation-skeleton'

interface StudentSessionNavigationProps {
  selectedCourse: StudentCourse
  courses: StudentCourse[]
  sessions: ChatSession[]
  selectedSessionId?: string
  isPending: boolean
  isError: boolean
  isRefreshing: boolean
  hasNextPage: boolean
  isFetchingNextPage: boolean
  isFetchNextPageError: boolean
  isCreating: boolean
  areSessionMutationsPending: boolean
  renamingSessionId?: string
  deletingSessionId?: string
  onRetry: () => void
  onLoadMore: () => void
  onCreate: () => Promise<void>
  onRename: (session: ChatSession, title: string) => Promise<void>
  onDelete: (session: ChatSession) => Promise<void>
  onNavigate?: () => void
  className?: string
}

export function StudentSessionNavigation({
  selectedCourse,
  courses,
  sessions,
  selectedSessionId,
  isPending,
  isError,
  isRefreshing,
  hasNextPage,
  isFetchingNextPage,
  isFetchNextPageError,
  isCreating,
  areSessionMutationsPending,
  renamingSessionId,
  deletingSessionId,
  onRetry,
  onLoadMore,
  onCreate,
  onRename,
  onDelete,
  onNavigate,
  className,
}: StudentSessionNavigationProps) {
  return (
    <aside
      aria-label="Session navigation"
      className={cn(
        'flex min-h-0 flex-col overflow-hidden border-b border-border bg-card text-card-foreground md:border-r md:border-b-0',
        className,
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <StudentCourseSwitcher
          courses={courses}
          selectedCourse={selectedCourse}
          onNavigate={onNavigate}
        />

        <div className="px-4 pb-5">
          <StudentCreateSessionButton
            isPending={isCreating}
            onCreate={async () => {
              await onCreate()
              onNavigate?.()
            }}
          />
        </div>

        <header className="flex items-center justify-between gap-3 px-5 pb-2.5">
          <h2 className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
            Sessions
          </h2>
          {isRefreshing ? (
            <Badge variant="outline" className="gap-1.5">
              <span
                className="size-1.5 motion-safe:animate-pulse rounded-full bg-primary"
                aria-hidden
              />
              Refreshing
            </Badge>
          ) : null}
        </header>

        <div
          role="region"
          aria-label="Conversation list"
          tabIndex={0}
          className="scrollbar-themed min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-inset focus-visible:outline-none"
        >
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
            <div className="mx-1 rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
              <div className="mx-auto flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
                <MessageSquareText className="size-4.5" aria-hidden />
              </div>
              <p className="mt-3 text-sm font-medium text-foreground">
                No conversations yet
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Start a new chat to begin studying this course with your tutor.
              </p>
            </div>
          ) : null}

          {!isPending && !isError && sessions.length > 0 ? (
            <nav aria-label="Course conversations">
              <ul className="space-y-1">
                {sessions.map((session) => (
                  <StudentSessionListItem
                    key={session.id}
                    courseId={selectedCourse.id}
                    session={session}
                    isSelected={session.id === selectedSessionId}
                    areLifecycleMutationsPending={areSessionMutationsPending}
                    isRenaming={renamingSessionId === session.id}
                    isDeleting={deletingSessionId === session.id}
                    onRename={(title) => onRename(session, title)}
                    onDelete={() => onDelete(session)}
                    onNavigate={onNavigate}
                  />
                ))}
              </ul>
              <StudentSessionInfiniteScroll
                hasNextPage={hasNextPage}
                isFetching={isFetchingNextPage}
                isError={isFetchNextPageError}
                onLoadMore={onLoadMore}
              />
            </nav>
          ) : null}
        </div>
      </div>
    </aside>
  )
}
