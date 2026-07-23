import { Link } from '@tanstack/react-router'
import { LogOut, MessageSquareText, Settings2 } from 'lucide-react'

import { getUserInitials } from '@/components/layout/dashboard-header'
import { Logo } from '@/components/logo'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/ui/custom/error-state'
import { useLogout } from '@/features/auth/hooks/use-logout'
import { useAuthStore } from '@/features/auth/stores/auth.store'
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
  const user = useAuthStore((state) => state.user)
  const logout = useLogout()
  const displayName = user?.displayName ?? 'Student'
  const roleLabel = user?.role
    ? `${user.role.charAt(0)}${user.role.slice(1).toLowerCase()}`
    : 'Student'

  return (
    <aside
      aria-label="Session navigation"
      className={cn(
        'flex min-h-0 flex-col overflow-hidden border-b border-border bg-sidebar text-sidebar-foreground md:border-r md:border-b-0',
        className,
      )}
    >
      <div className="flex items-center gap-2.5 px-4 pt-4">
        <Logo className="size-8 text-foreground" iconClassName="size-5" />
        <span className="font-display text-[1.125rem] leading-none text-foreground">
          Morshid
        </span>
        <Badge variant="secondary" className="ml-auto">
          Student
        </Badge>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <StudentCourseSwitcher
          courses={courses}
          selectedCourse={selectedCourse}
          onNavigate={onNavigate}
        />

        <div className="-mt-2 px-4 pb-4">
          <Link
            to="/student/courses"
            onClick={onNavigate}
            className="link-editorial text-sm text-muted-foreground"
          >
            All courses →
          </Link>
        </div>

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
          <h2 className="smallcaps-label">Sessions</h2>
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
            <div className="mx-1 rounded-xl border border-dashed border-border bg-secondary/40 px-4 py-8 text-center">
              <div className="mx-auto flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
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

      <div className="m-3 flex items-center gap-2 rounded-xl border bg-card p-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-foreground"
          aria-hidden
        >
          {getUserInitials(user?.displayName)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {displayName}
          </p>
          <p className="footnote truncate">{roleLabel}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Settings"
          render={<Link to="/student/settings" onClick={onNavigate} />}
        >
          <Settings2 className="size-4" strokeWidth={1.75} aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Sign out"
          onClick={() => void logout()}
        >
          <LogOut className="size-4" strokeWidth={1.75} aria-hidden />
        </Button>
      </div>
    </aside>
  )
}
