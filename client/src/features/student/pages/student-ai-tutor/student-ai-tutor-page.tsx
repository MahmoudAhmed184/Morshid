import { useNavigate } from '@tanstack/react-router'
import { BookOpen } from 'lucide-react'

import { EmptyState } from '@/components/ui/custom/empty-state'
import { useStudentCourses } from '@/features/student/hooks/use-student-courses'
import {
  useCreateStudentSession,
  useDeleteStudentSession,
  useRenameStudentSession,
  useStudentSessionMessages,
  useStudentSessions,
} from '@/features/student/hooks/use-student-sessions'
import type { ChatSession } from '@/features/student/schemas/student-chat.schema'

import { StudentConversationHeader } from './student-conversation-header'
import { StudentDisabledComposer } from './student-disabled-composer'
import { StudentMessageHistory } from './student-message-history'
import { StudentSessionNavigation } from './student-session-navigation'
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
  const selectedSession =
    sessions.find((session) => session.id === sessionId) ?? null
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

  return (
    <section
      className="flex min-h-0 flex-1 overflow-hidden bg-card text-card-foreground"
      aria-label="Student AI Tutor"
    >
      {selectedCourse ? (
        <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] md:grid-cols-[18rem_minmax(0,1fr)] md:grid-rows-1 md:overflow-hidden">
          <StudentSessionNavigation
            selectedCourse={selectedCourse}
            courses={assignedCourses}
            sessions={sessions}
            selectedSessionId={sessionId}
            isPending={sessionsQuery.isPending}
            isError={sessionsQuery.isError && sessions.length === 0}
            isRefreshing={
              sessionsQuery.isFetching &&
              !sessionsQuery.isPending &&
              !sessionsQuery.isFetchingNextPage
            }
            hasNextPage={sessionsQuery.hasNextPage}
            isFetchingNextPage={sessionsQuery.isFetchingNextPage}
            isFetchNextPageError={sessionsQuery.isFetchNextPageError}
            isCreating={createSession.isPending}
            renamingSessionId={
              renameSession.isPending
                ? renameSession.variables.sessionId
                : undefined
            }
            deletingSessionId={
              deleteSession.isPending ? deleteSession.variables : undefined
            }
            onRetry={() => void sessionsQuery.refetch()}
            onLoadMore={() => void sessionsQuery.fetchNextPage()}
            onCreate={handleCreate}
            onRename={handleRename}
            onDelete={handleDelete}
          />

          <div className="flex min-h-80 min-w-0 flex-col">
            {selectedSession ? (
              <StudentConversationHeader
                title={selectedSession.title}
                courseCode={selectedCourse.code}
                courseTitle={selectedCourse.title}
              />
            ) : null}
            <div className="scrollbar-themed min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
              {selectedSession ? (
                <div className="mx-auto min-h-full max-w-4xl">
                  <StudentMessageHistory
                    messages={messages}
                    error={messagesQuery.error}
                    isPending={messagesQuery.isPending}
                    isError={messagesQuery.isError}
                    isFetching={messagesQuery.isFetching}
                    hasNextPage={messagesQuery.hasNextPage}
                    isFetchingNextPage={messagesQuery.isFetchingNextPage}
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
                  />
                </div>
              )}
            </div>
            <StudentDisabledComposer
              hasSelectedSession={selectedSession !== null}
            />
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
