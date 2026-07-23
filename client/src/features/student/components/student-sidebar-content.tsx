import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { Check, ChevronDown, Plus, Search } from 'lucide-react'
import { useState } from 'react'
import type { RefObject } from 'react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { ErrorState } from '@/components/ui/custom/error-state'
import { useSidebar } from '@/components/ui/sidebar'
import { useStudentChromeActions } from '@/features/student/components/student-chrome-context'
import { useStudentCourses } from '@/features/student/hooks/use-student-courses'
import type { StudentCourse } from '@/features/student/schemas/student-course.schema'
import {
  useDeleteStudentSession,
  useRenameStudentSession,
  useStudentSession,
  useStudentSessions,
} from '@/features/student/hooks/use-student-sessions'
import type { ChatSession } from '@/features/student/schemas/student-chat.schema'
import { StudentSessionInfiniteScroll } from '@/features/student/pages/student-ai-tutor/student-session-infinite-scroll'
import { StudentSessionListItem } from '@/features/student/pages/student-ai-tutor/student-session-list-item'
import { StudentSessionNavigationSkeleton } from '@/features/student/pages/student-ai-tutor/student-session-navigation-skeleton'

interface StudentSidebarContentProps {
  searchInputRef?: RefObject<HTMLInputElement | null>
  newChatButtonRef?: RefObject<HTMLButtonElement | null>
}

type SessionGroup = {
  key: string
  label: string
  sessions: ChatSession[]
}

function groupSessionsByRecency(sessions: ChatSession[]): SessionGroup[] {
  const now = new Date()
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime()
  const dayMs = 86_400_000

  const buckets: Record<string, ChatSession[]> = {
    today: [],
    yesterday: [],
    week: [],
    older: [],
  }

  for (const session of sessions) {
    const timestamp = new Date(
      session.lastMessageAt ?? session.updatedAt,
    ).getTime()

    if (timestamp >= startOfToday) {
      buckets.today.push(session)
    } else if (timestamp >= startOfToday - dayMs) {
      buckets.yesterday.push(session)
    } else if (timestamp >= startOfToday - 7 * dayMs) {
      buckets.week.push(session)
    } else {
      buckets.older.push(session)
    }
  }

  return [
    { key: 'today', label: 'Today', sessions: buckets.today },
    { key: 'yesterday', label: 'Yesterday', sessions: buckets.yesterday },
    { key: 'week', label: 'Last 7 days', sessions: buckets.week },
    { key: 'older', label: 'Older', sessions: buckets.older },
  ].filter((group) => group.sessions.length > 0)
}

// T12.1 — the notebook switcher. A full-width quiet control between the wordmark
// and New chat: current course title + chevron, opening a T10-kit dropdown of
// course titles with a check on the active one. Selecting a course navigates to
// `/chat?courseId=…` (the existing selection mechanism) and the session list
// beneath re-scopes. Zero courses render a static muted label with no menu.
function CourseSwitcher({
  courses,
  selectedCourse,
}: {
  courses: StudentCourse[]
  selectedCourse: StudentCourse | null
}) {
  if (courses.length === 0) {
    return (
      <div className="flex h-10 items-center rounded-lg px-3 text-sm font-medium text-muted-foreground">
        No courses yet
      </div>
    )
  }

  const triggerLabel = selectedCourse?.title ?? 'Choose a course'
  const ariaLabel = selectedCourse
    ? `Current course: ${selectedCourse.title}. Choose course`
    : 'Choose a course'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            className="h-10 w-full justify-between rounded-lg px-3 text-sm font-medium hover:bg-accent"
            aria-label={ariaLabel}
          />
        }
      >
        <span className="truncate">{triggerLabel}</span>
        <ChevronDown
          className="size-3.5 shrink-0 text-muted-foreground"
          aria-hidden
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 max-w-[90vw]">
        {courses.map((course) => (
          <DropdownMenuItem
            key={course.id}
            render={<Link to="/chat" search={{ courseId: course.id }} />}
          >
            <span className="min-w-0 flex-1 truncate">{course.title}</span>
            {selectedCourse && course.id === selectedCourse.id ? (
              <Check className="size-4 text-foreground" aria-hidden />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function StudentSidebarContent({
  searchInputRef,
  newChatButtonRef,
}: StudentSidebarContentProps) {
  const navigate = useNavigate()
  const { isMobile, setOpenMobile } = useSidebar()
  const { requestComposerFocus } = useStudentChromeActions()
  const search = useRouterState({
    select: (state) => state.location.search,
  })
  const routeCourseId = search.courseId
  const routeSessionId = search.sessionId

  const { data: assignedCourses } = useStudentCourses()
  const selectedCourse =
    (routeCourseId
      ? assignedCourses.find((course) => course.id === routeCourseId)
      : assignedCourses.length === 1
        ? assignedCourses[0]
        : undefined) ?? null

  const [query, setQuery] = useState('')

  const sessionsQuery = useStudentSessions({ courseId: selectedCourse?.id })
  const sessions =
    sessionsQuery.data?.pages.flatMap((page) => page.sessions) ?? []
  const listedSession =
    sessions.find((session) => session.id === routeSessionId) ?? null
  const routedSessionQuery = useStudentSession({
    courseId: selectedCourse?.id,
    sessionId: routeSessionId,
  })
  const routedSession = routedSessionQuery.data ?? null
  const visibleSessions =
    routedSession && !listedSession ? [routedSession, ...sessions] : sessions

  const renameSession = useRenameStudentSession({
    courseId: selectedCourse?.id,
  })
  const deleteSession = useDeleteStudentSession({
    courseId: selectedCourse?.id,
  })

  const closeOnMobile = () => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  const handleNewChat = async () => {
    // T12.4 — with no active course there is nowhere to open a conversation and
    // no library page to fall back to (the sidebar shows `No courses yet`), so
    // New chat is a no-op rather than navigating to a deleted route.
    if (!selectedCourse) {
      return
    }

    // T15.1 — New chat opens the draft state; no session is created until the
    // first message is sent. Already in the draft (no routed session) → skip the
    // redundant navigation. T15.7 — focus the draft composer on every activation
    // (the chat page registers its focus handle through the chrome context).
    if (routeSessionId !== undefined) {
      await navigate({
        to: '/chat',
        search: { courseId: selectedCourse.id },
      })
    }

    requestComposerFocus()
    closeOnMobile()
  }

  const handleRename = async (session: ChatSession, title: string) => {
    await renameSession.mutateAsync({ sessionId: session.id, input: { title } })
  }

  const handleDelete = async (session: ChatSession) => {
    if (!selectedCourse) {
      return
    }

    await deleteSession.mutateAsync(session.id)

    if (session.id === routeSessionId) {
      await navigate({
        to: '/chat',
        search: { courseId: selectedCourse.id },
      })
    }
  }

  const normalizedQuery = query.trim().toLowerCase()
  const filteredSessions =
    normalizedQuery.length === 0
      ? visibleSessions
      : visibleSessions.filter((session) =>
          session.title.toLowerCase().includes(normalizedQuery),
        )
  const groups = groupSessionsByRecency(filteredSessions)

  const isPending = sessionsQuery.isPending && Boolean(selectedCourse)
  const isError = sessionsQuery.isError && sessions.length === 0
  const areSessionMutationsPending =
    renameSession.isPending || deleteSession.isPending

  return (
    <>
      <div className="flex flex-col gap-2 px-2 pt-1 pb-2">
        <CourseSwitcher
          courses={assignedCourses}
          selectedCourse={selectedCourse}
        />
        <Button
          ref={newChatButtonRef}
          type="button"
          className="w-full justify-center rounded-lg"
          onClick={() => void handleNewChat()}
        >
          <Plus aria-hidden />
          New chat
        </Button>

        <div className="relative px-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            strokeWidth={1.75}
            aria-hidden
          />
          <Input
            ref={searchInputRef}
            type="search"
            role="searchbox"
            aria-label="Search your chats"
            placeholder="Search your chats..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-8 border-0 bg-transparent px-0 pl-9 shadow-none focus-visible:ring-0"
          />
        </div>
      </div>

      <div className="rule mx-3" aria-hidden />

      <div
        role="region"
        aria-label="Conversation list"
        tabIndex={0}
        className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-4 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-inset focus-visible:outline-none"
      >
        {isPending ? <StudentSessionNavigationSkeleton /> : null}

        {isError ? (
          <ErrorState
            title="Sessions unavailable"
            description="Check your connection and try loading your conversations again."
            onRetry={() => void sessionsQuery.refetch()}
            className="min-h-0 px-3 py-6"
          />
        ) : null}

        {!isPending && !isError && groups.length > 0 ? (
          <nav
            aria-label="Course conversations"
            className="flex flex-col gap-4 pt-3"
          >
            {groups.map((group) => (
              <div key={group.key}>
                <p className="smallcaps-label px-3 pb-1.5 font-semibold">
                  {group.label}
                </p>
                <ul className="flex flex-col gap-0.5">
                  {group.sessions.map((session) => (
                    <StudentSessionListItem
                      key={session.id}
                      courseId={session.courseId}
                      session={session}
                      isSelected={session.id === routeSessionId}
                      areLifecycleMutationsPending={areSessionMutationsPending}
                      isRenaming={
                        renameSession.isPending &&
                        renameSession.variables.sessionId === session.id
                      }
                      isDeleting={
                        deleteSession.isPending &&
                        deleteSession.variables === session.id
                      }
                      onRename={(title) => handleRename(session, title)}
                      onDelete={() => handleDelete(session)}
                      onNavigate={closeOnMobile}
                    />
                  ))}
                </ul>
              </div>
            ))}
            <StudentSessionInfiniteScroll
              hasNextPage={sessionsQuery.hasNextPage}
              isFetching={sessionsQuery.isFetchingNextPage}
              isError={sessionsQuery.isFetchNextPageError}
              onLoadMore={() => void sessionsQuery.fetchNextPage()}
            />
          </nav>
        ) : null}

        {!isPending && !isError && groups.length === 0 ? (
          <p className="footnote px-3 py-6 text-center">
            {selectedCourse
              ? normalizedQuery.length > 0
                ? 'No chats match your search.'
                : 'No conversations yet.'
              : 'Open a course to start a conversation.'}
          </p>
        ) : null}
      </div>
    </>
  )
}
