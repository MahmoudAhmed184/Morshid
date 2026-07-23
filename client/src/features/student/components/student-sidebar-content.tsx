import { useNavigate, useRouterState } from '@tanstack/react-router'
import { Plus, Search } from 'lucide-react'
import { useState } from 'react'
import type { RefObject } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ErrorState } from '@/components/ui/custom/error-state'
import { useSidebar } from '@/components/ui/sidebar'
import { useStudentCourses } from '@/features/student/hooks/use-student-courses'
import {
  useCreateStudentSession,
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

// A session that has never recorded a message has a null `lastMessageAt` — the
// same signal the pre-v5 rail used to render its "No messages yet" subtitle.
function isEmptySession(session: ChatSession): boolean {
  return session.lastMessageAt === null
}

// Newest by creation time, so the New-chat guard reuses the most recently
// opened empty session rather than an older abandoned one.
function findNewestEmptySession(sessions: ChatSession[]): ChatSession | null {
  return sessions.reduce<ChatSession | null>((newest, session) => {
    if (!isEmptySession(session)) {
      return newest
    }

    if (
      !newest ||
      new Date(session.createdAt).getTime() >
        new Date(newest.createdAt).getTime()
    ) {
      return session
    }

    return newest
  }, null)
}

export function StudentSidebarContent({
  searchInputRef,
  newChatButtonRef,
}: StudentSidebarContentProps) {
  const navigate = useNavigate()
  const { isMobile, setOpenMobile } = useSidebar()
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
  const selectedSession =
    visibleSessions.find((session) => session.id === routeSessionId) ?? null

  const createSession = useCreateStudentSession({
    courseId: selectedCourse?.id,
  })
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

  const handleCreate = async () => {
    if (!selectedCourse) {
      await navigate({ to: '/courses' })
      closeOnMobile()
      return
    }

    // T11.2 guard — do not spawn another empty session when one is at hand.
    // 1. The currently-selected session has no messages → stay on it (it is
    //    already the active route by definition) and do not create. Focusing
    //    the composer is not trivially reachable from here — it lives in a
    //    separate route subtree with no ref/callback wired to the sidebar — so
    //    we navigate/stay only.
    if (selectedSession && isEmptySession(selectedSession)) {
      closeOnMobile()
      return
    }

    // 2. Reuse the newest already-loaded empty session for this course.
    const reusableEmptySession = findNewestEmptySession(visibleSessions)
    if (reusableEmptySession) {
      await navigate({
        to: '/chat',
        search: {
          courseId: selectedCourse.id,
          sessionId: reusableEmptySession.id,
        },
      })
      closeOnMobile()
      return
    }

    // 3. Neither applies → create via the existing mutation, unchanged.
    try {
      const session = await createSession.mutateAsync({})
      await navigate({
        to: '/chat',
        search: { courseId: selectedCourse.id, sessionId: session.id },
      })
      closeOnMobile()
    } catch {
      // The failure surfaces via the create mutation error below the button.
    }
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
        <Button
          ref={newChatButtonRef}
          type="button"
          className="w-full justify-center rounded-lg"
          onClick={() => void handleCreate()}
          disabled={createSession.isPending}
        >
          <Plus aria-hidden />
          New chat
        </Button>
        {createSession.isError ? (
          <p role="alert" className="px-1 text-xs text-destructive">
            {createSession.error instanceof Error
              ? createSession.error.message
              : 'Unable to create a conversation.'}
          </p>
        ) : null}

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
