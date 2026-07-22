import { useNavigate } from '@tanstack/react-router'
import { BookMarked, BookOpen, PanelLeft } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/custom/empty-state'
import { ModeToggle } from '@/components/ui/mode-toggle'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useStudentCourses } from '@/features/student/hooks/use-student-courses'
import {
  useCreateStudentSession,
  useDeleteStudentSession,
  useRenameStudentSession,
  useStudentSession,
  useStudentSessionMessages,
  useStudentSessions,
} from '@/features/student/hooks/use-student-sessions'
import type { ChatSession } from '@/features/student/schemas/student-chat.schema'

import { StudentConversationHeader } from './student-conversation-header'
import { StudentDisabledComposer } from './student-disabled-composer'
import { StudentMessageHistory } from './student-message-history'
import { StudentSessionNavigation } from './student-session-navigation'
import { StudentSourcesPanel } from './student-sources-panel'
import { StudentWorkspaceState } from './student-workspace-state'

interface StudentAiTutorPageProps {
  courseId?: string
  sessionId?: string
}

export function StudentAiTutorPage({
  courseId,
  sessionId,
}: StudentAiTutorPageProps) {
  const navigate = useNavigate()
  const [mobileSessionsOpen, setMobileSessionsOpen] = useState(false)
  const [mobileSourcesOpen, setMobileSourcesOpen] = useState(false)
  const [sourcesOpen, setSourcesOpen] = useState(true)
  const { data: assignedCourses } = useStudentCourses()
  const selectedCourse =
    (courseId
      ? assignedCourses.find((course) => course.id === courseId)
      : assignedCourses.length === 1
        ? assignedCourses[0]
        : undefined) ?? null
  const sessionsQuery = useStudentSessions({ courseId: selectedCourse?.id })
  const sessions =
    sessionsQuery.data?.pages.flatMap((page) => page.sessions) ?? []
  const listedSession =
    sessions.find((session) => session.id === sessionId) ?? null
  const routedSessionQuery = useStudentSession({
    courseId: selectedCourse?.id,
    sessionId,
  })
  const selectedSession = routedSessionQuery.data ?? null
  const visibleSessions =
    selectedSession && !listedSession
      ? [selectedSession, ...sessions]
      : sessions
  const messagesQuery = useStudentSessionMessages({
    courseId: selectedCourse?.id,
    sessionId: selectedSession?.id,
  })
  const messages =
    messagesQuery.data?.pages.flatMap((page) => page.messages) ?? []
  const createSession = useCreateStudentSession({
    courseId: selectedCourse?.id,
  })
  const renameSession = useRenameStudentSession({
    courseId: selectedCourse?.id,
  })
  const deleteSession = useDeleteStudentSession({
    courseId: selectedCourse?.id,
  })

  const handleCreate = async () => {
    if (!selectedCourse) {
      return
    }

    const session = await createSession.mutateAsync({})
    await navigate({
      to: '/student/ai-tutor',
      search: { courseId: selectedCourse.id, sessionId: session.id },
    })
  }

  const handleRename = async (session: ChatSession, title: string) => {
    await renameSession.mutateAsync({
      sessionId: session.id,
      input: { title },
    })
  }

  const handleDelete = async (session: ChatSession) => {
    if (!selectedCourse) {
      return
    }

    await deleteSession.mutateAsync(session.id)

    if (session.id === sessionId) {
      await navigate({
        to: '/student/ai-tutor',
        search: { courseId: selectedCourse.id },
      })
    }
  }

  const handleStaleSession = async () => {
    if (!selectedCourse) {
      return
    }

    await navigate({
      to: '/student/ai-tutor',
      search: { courseId: selectedCourse.id },
    })
    void sessionsQuery.refetch()
  }

  const sessionNavigationProps = selectedCourse
    ? {
        selectedCourse,
        courses: assignedCourses,
        sessions: visibleSessions,
        selectedSessionId: sessionId,
        isPending: sessionsQuery.isPending,
        isError: sessionsQuery.isError && sessions.length === 0,
        isRefreshing:
          sessionsQuery.isFetching &&
          !sessionsQuery.isPending &&
          !sessionsQuery.isFetchingNextPage,
        hasNextPage: sessionsQuery.hasNextPage,
        isFetchingNextPage: sessionsQuery.isFetchingNextPage,
        isFetchNextPageError: sessionsQuery.isFetchNextPageError,
        isCreating: createSession.isPending,
        areSessionMutationsPending:
          renameSession.isPending || deleteSession.isPending,
        renamingSessionId: renameSession.isPending
          ? renameSession.variables.sessionId
          : undefined,
        deletingSessionId: deleteSession.isPending
          ? deleteSession.variables
          : undefined,
        onRetry: () => void sessionsQuery.refetch(),
        onLoadMore: () => void sessionsQuery.fetchNextPage(),
        onCreate: handleCreate,
        onRename: handleRename,
        onDelete: handleDelete,
      }
    : null
  const activeSessionNavigationProps = sessionNavigationProps!

  return (
    <section
      className="flex min-h-0 flex-1 overflow-hidden bg-background text-foreground"
      aria-label="Student AI Tutor"
    >
      {selectedCourse ? (
        <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)] md:grid-cols-[19rem_minmax(0,1fr)] md:overflow-hidden">
          <div className="hidden min-h-0 md:contents">
            <StudentSessionNavigation {...activeSessionNavigationProps} />
          </div>

          <div className="flex min-h-80 min-w-0 flex-col bg-background">
            <header className="glass-paper flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-3 md:px-4">
              <Sheet
                open={mobileSessionsOpen}
                onOpenChange={setMobileSessionsOpen}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <SheetTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-9 text-muted-foreground md:hidden"
                        aria-label="Open sessions"
                      />
                    }
                  >
                    <PanelLeft
                      className="size-5"
                      strokeWidth={1.75}
                      aria-hidden
                    />
                  </SheetTrigger>
                  <span className="truncate text-sm font-medium text-foreground md:hidden">
                    Courses & chats
                  </span>
                  <nav
                    aria-label="Workspace breadcrumb"
                    className="smallcaps-label hidden min-w-0 items-center gap-1.5 md:flex"
                  >
                    <span>Student</span>
                    <span aria-hidden>·</span>
                    <span className="truncate text-foreground">
                      {selectedCourse.code}
                    </span>
                  </nav>
                </div>
                <SheetContent
                  side="left"
                  className="inset-y-2! left-2! h-[calc(100svh-1rem)]! w-[80vw]! max-w-80 gap-0 overflow-hidden overscroll-contain rounded-lg border border-border bg-card p-0 shadow-lg md:hidden"
                >
                  <SheetHeader className="sr-only">
                    <SheetTitle>Course sessions</SheetTitle>
                  </SheetHeader>
                  <StudentSessionNavigation
                    {...activeSessionNavigationProps}
                    onNavigate={() => setMobileSessionsOpen(false)}
                    className="h-full border-0 pt-8"
                  />
                </SheetContent>
              </Sheet>

              <Sheet
                open={mobileSourcesOpen}
                onOpenChange={setMobileSourcesOpen}
              >
                <div className="flex shrink-0 items-center gap-1">
                  <ModeToggle />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Toggle sources and citations"
                    aria-pressed={sourcesOpen}
                    onClick={() => setSourcesOpen((open) => !open)}
                    className="hidden lg:inline-flex"
                  >
                    <BookMarked
                      className="size-4 text-muted-foreground"
                      strokeWidth={1.75}
                      aria-hidden
                    />
                  </Button>
                  <SheetTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="lg:hidden"
                        aria-label="Show sources and citations"
                      />
                    }
                  >
                    <BookMarked
                      className="size-4 text-muted-foreground"
                      strokeWidth={1.75}
                      aria-hidden
                    />
                  </SheetTrigger>
                </div>
                <SheetContent
                  side="right"
                  className="w-[85vw]! max-w-sm gap-0 border-border bg-card p-0 lg:hidden"
                >
                  <SheetHeader className="sr-only">
                    <SheetTitle>Sources and citations</SheetTitle>
                  </SheetHeader>
                  <StudentSourcesPanel
                    course={selectedCourse}
                    messages={messages}
                    className="h-full rounded-none border-0 shadow-none"
                  />
                </SheetContent>
              </Sheet>
            </header>

            <div className="flex min-h-0 flex-1 overflow-hidden">
              <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                {selectedSession ? (
                  <StudentConversationHeader
                    title={selectedSession.title}
                    courseCode={selectedCourse.code}
                    courseTitle={selectedCourse.title}
                  />
                ) : null}
                <div className="scrollbar-themed min-h-0 flex-1 overflow-y-auto px-6 py-8">
                  {selectedSession ? (
                    <div className="mx-auto min-h-full max-w-3xl">
                      <StudentMessageHistory
                        messages={messages}
                        error={messagesQuery.error}
                        isPending={messagesQuery.isPending}
                        isError={messagesQuery.isError}
                        isFetching={messagesQuery.isFetching}
                        hasNextPage={messagesQuery.hasNextPage}
                        isFetchingNextPage={messagesQuery.isFetchingNextPage}
                        isFetchNextPageError={
                          messagesQuery.isFetchNextPageError
                        }
                        onRetry={() => void messagesQuery.refetch()}
                        onLoadMore={() => void messagesQuery.fetchNextPage()}
                        onRecover={() => void handleStaleSession()}
                      />
                    </div>
                  ) : (
                    <div className="flex min-h-full items-center justify-center py-4">
                      <StudentWorkspaceState
                        sessionId={sessionId}
                        sessionsPending={sessionsQuery.isPending}
                        sessionsError={
                          sessionsQuery.isError && sessions.length === 0
                        }
                        hasSessions={sessions.length > 0}
                        sessionPending={
                          routedSessionQuery.isPending &&
                          routedSessionQuery.fetchStatus !== 'idle'
                        }
                        sessionError={routedSessionQuery.error}
                        sessionRetrying={routedSessionQuery.isFetching}
                        onRetrySession={() => void routedSessionQuery.refetch()}
                      />
                    </div>
                  )}
                </div>
                <StudentDisabledComposer
                  hasSelectedSession={selectedSession !== null}
                />
              </div>

              {sourcesOpen ? (
                <StudentSourcesPanel
                  course={selectedCourse}
                  messages={messages}
                  onCollapse={() => setSourcesOpen(false)}
                  className="m-3 ml-0 hidden w-80 shrink-0 lg:flex"
                />
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center px-4 py-12">
          <EmptyState
            icon={<BookOpen className="size-6" aria-hidden />}
            title={
              assignedCourses.length === 0
                ? 'No assigned course'
                : 'Choose a course'
            }
            description={
              assignedCourses.length === 0
                ? 'An active Student course membership is required before you can open a private workspace.'
                : 'Select one of your assigned courses to load its private conversations.'
            }
            className="w-full max-w-md border-0 bg-transparent"
          />
        </div>
      )}
    </section>
  )
}
