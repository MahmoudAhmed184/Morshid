import { useNavigate } from '@tanstack/react-router'
import { BookMarked, BookOpen } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/custom/empty-state'
import { ErrorState } from '@/components/ui/custom/error-state'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useSidebar } from '@/components/ui/sidebar'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import {
  isStudentChatApiError,
  STUDENT_CHAT_ERROR_CODES,
} from '@/features/student/data/student-chat.errors'
import { useStudentCourses } from '@/features/student/hooks/use-student-courses'
import {
  useStudentSession,
  useStudentSessionMessages,
} from '@/features/student/hooks/use-student-sessions'
import {
  useRetryStudentChatMessage,
  useSendStudentChatMessage,
} from '@/features/student/hooks/use-student-chat-turns'
import type {
  ChatMessage,
  ChatSession,
} from '@/features/student/schemas/student-chat.schema'
import type { StudentCourse } from '@/features/student/schemas/student-course.schema'
import { firstNameFromDisplayName } from '@/features/student/utils/greeting'
import { cn } from '@/lib/utils'

import { StudentChatComposer } from './student-chat-composer'
import type { StudentChatComposerHandle } from './student-chat-composer'
import { StudentMessageHistory } from './student-message-history'
import { StudentSourcesPanel } from './student-sources-panel'

interface StudentAiTutorPageProps {
  courseId?: string
  sessionId?: string
}

export function StudentAiTutorPage({
  courseId,
  sessionId,
}: StudentAiTutorPageProps) {
  const navigate = useNavigate()
  const studentId = useAuthStore((state) => state.user?.id)
  const displayName = useAuthStore((state) => state.user?.displayName)
  const firstName = firstNameFromDisplayName(displayName)
  const { data: assignedCourses } = useStudentCourses()
  const selectedCourse =
    (courseId
      ? assignedCourses.find((course) => course.id === courseId)
      : assignedCourses.length === 1
        ? assignedCourses[0]
        : undefined) ?? null
  const routedSessionQuery = useStudentSession({
    courseId: selectedCourse?.id,
    sessionId,
  })
  const selectedSession = routedSessionQuery.data ?? null

  const handleStaleSession = async () => {
    if (!selectedCourse) {
      return
    }

    await navigate({ to: '/chat', search: { courseId: selectedCourse.id } })
    void routedSessionQuery.refetch()
  }

  if (!selectedCourse) {
    return (
      <div className="flex h-full flex-1 items-center justify-center px-4 py-12">
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
    )
  }

  const isSessionLoading =
    sessionId !== undefined &&
    routedSessionQuery.isPending &&
    routedSessionQuery.fetchStatus !== 'idle'

  return (
    <section
      className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden overscroll-none bg-background text-foreground"
      aria-label="Student AI Tutor"
    >
      {selectedSession ? (
        <StudentConversation
          key={`${studentId ?? 'anonymous'}:${selectedCourse.id}:${selectedSession.id}`}
          course={selectedCourse}
          courses={assignedCourses}
          session={selectedSession}
          firstName={firstName}
          onRecover={() => void handleStaleSession()}
        />
      ) : (
        <StudentNewChatState
          course={selectedCourse}
          courses={assignedCourses}
          firstName={firstName}
          isSessionLoading={isSessionLoading}
          sessionRequested={sessionId !== undefined}
          sessionError={routedSessionQuery.error}
          sessionRetrying={routedSessionQuery.isFetching}
          onRetrySession={() => void routedSessionQuery.refetch()}
        />
      )}
    </section>
  )
}

function StudentChatTopBar({
  title,
  actions,
}: {
  title?: string
  actions?: ReactNode
}) {
  const { state, isMobile } = useSidebar()
  const clusterPresent = isMobile || state === 'collapsed'

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-3 md:px-4">
      <div
        className={cn('flex min-w-0 items-center', clusterPresent && 'pl-28')}
      >
        {title ? (
          <span className="truncate text-sm font-medium text-foreground">
            {title}
          </span>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">{actions}</div>
    </header>
  )
}

interface StudentNewChatStateProps {
  course: StudentCourse
  courses: StudentCourse[]
  firstName?: string
  isSessionLoading: boolean
  sessionRequested: boolean
  sessionError: unknown
  sessionRetrying: boolean
  onRetrySession: () => void
}

function StudentNewChatState({
  course,
  courses,
  firstName,
  isSessionLoading,
  sessionRequested,
  sessionError,
  sessionRetrying,
  onRetrySession,
}: StudentNewChatStateProps) {
  const hasBlockingSessionError =
    sessionRequested &&
    sessionError !== null &&
    !isStudentChatApiError(
      sessionError,
      STUDENT_CHAT_ERROR_CODES.SESSION_NOT_FOUND,
    )
  const hasMissingSession =
    sessionRequested && !isSessionLoading && !hasBlockingSessionError

  let body: ReactNode

  if (isSessionLoading) {
    body = null
  } else if (hasBlockingSessionError) {
    body = (
      <ErrorState
        title="Conversation unavailable"
        description="The selected conversation could not be loaded."
        onRetry={onRetrySession}
        isRetrying={sessionRetrying}
        className="w-full max-w-md border-0 bg-transparent"
      />
    )
  } else if (hasMissingSession) {
    body = (
      <EmptyState
        title="Conversation unavailable"
        description="This conversation may have been deleted or does not belong to the selected course."
        className="w-full max-w-md border-0 bg-transparent"
      />
    )
  } else {
    body = (
      <h1 className="display-2 text-center text-foreground">
        {firstName
          ? `How can I help you, ${firstName}?`
          : 'How can I help you?'}
      </h1>
    )
  }

  return (
    <>
      <StudentChatTopBar />
      <div
        aria-label="Conversation messages"
        className="scrollbar-themed min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-8"
        role="region"
      >
        <div className="mx-auto flex min-h-full max-w-3xl items-center justify-center">
          {body}
        </div>
      </div>
      <StudentChatComposer
        key={`${course.id}:no-session`}
        hasSelectedSession={false}
        isGenerating={false}
        sendError={null}
        courses={courses}
        selectedCourse={course}
        onDismissError={() => undefined}
        onSend={() => Promise.resolve(false)}
      />
    </>
  )
}

interface StudentConversationProps {
  course: StudentCourse
  courses: StudentCourse[]
  session: ChatSession
  firstName?: string
  onRecover: () => void
}

function StudentConversation({
  course,
  courses,
  session,
  firstName,
  onRecover,
}: StudentConversationProps) {
  const [mobileSourcesOpen, setMobileSourcesOpen] = useState(false)
  const [sourcesOpen, setSourcesOpen] = useState(true)
  const composerRef = useRef<StudentChatComposerHandle>(null)
  const messagesQuery = useStudentSessionMessages({
    courseId: course.id,
    sessionId: session.id,
  })
  const messages = reconcileMessages(
    messagesQuery.data?.pages.flatMap((page) => page.messages) ?? [],
  )
  const sendMessage = useSendStudentChatMessage({
    courseId: course.id,
    sessionId: session.id,
  })
  const retryMessage = useRetryStudentChatMessage({
    courseId: course.id,
    sessionId: session.id,
  })
  const hasPersistedGeneration = messages.some(
    (message) =>
      message.role === 'ASSISTANT' &&
      (message.status === 'PENDING' || message.status === 'STREAMING'),
  )
  const isGenerationActive =
    sendMessage.isPending || retryMessage.isPending || hasPersistedGeneration
  const historyScrollRef = useRef<HTMLDivElement>(null)
  const previousLatestMessageRef = useRef<string | undefined>(undefined)
  const latestMessage = messages.at(-1)
  const latestMessageKey = latestMessage
    ? [
        latestMessage.id,
        latestMessage.status,
        latestMessage.completedAt,
        latestMessage.content.length,
      ].join(':')
    : undefined

  useLayoutEffect(() => {
    if (messagesQuery.isPending) {
      return
    }

    const latestMessageChanged =
      previousLatestMessageRef.current !== latestMessageKey
    previousLatestMessageRef.current = latestMessageKey

    if (latestMessageChanged) {
      const scrollContainer = historyScrollRef.current
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [latestMessageKey, messagesQuery.isPending])

  const handleSend = async (content: string, clientMessageId: string) => {
    retryMessage.reset()

    try {
      await sendMessage.mutateAsync({ clientMessageId, content })
      return true
    } catch {
      return false
    }
  }

  const handleRetryMessage = async (studentMessageId: string) => {
    sendMessage.reset()

    try {
      await retryMessage.mutateAsync(studentMessageId)
    } catch {
      // Mutation state renders the scoped retry failure next to the response.
    }
  }

  return (
    <Sheet open={mobileSourcesOpen} onOpenChange={setMobileSourcesOpen}>
      <StudentChatTopBar
        title={session.title}
        actions={
          <>
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
          </>
        }
      />
      <SheetContent
        side="right"
        className="w-[85vw]! max-w-sm gap-0 border-border bg-card p-0 lg:hidden"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Sources and citations</SheetTitle>
        </SheetHeader>
        <StudentSourcesPanel
          course={course}
          messages={messages}
          className="h-full rounded-none border-0 shadow-none"
        />
      </SheetContent>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div
            ref={historyScrollRef}
            aria-label="Conversation messages"
            className="scrollbar-themed min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-8"
            role="region"
          >
            <div className="mx-auto min-h-full max-w-3xl">
              <StudentMessageHistory
                messages={messages}
                error={messagesQuery.error}
                isPending={messagesQuery.isPending}
                isError={messagesQuery.isError}
                isFetching={messagesQuery.isFetching}
                hasNextPage={messagesQuery.hasNextPage}
                isFetchingNextPage={messagesQuery.isFetchingNextPage}
                isFetchNextPageError={messagesQuery.isFetchNextPageError}
                isGenerationActive={isGenerationActive}
                retryError={retryMessage.error}
                retryMessageId={retryMessage.variables}
                firstName={firstName}
                onRetry={() => void messagesQuery.refetch()}
                onLoadMore={() => void messagesQuery.fetchNextPage()}
                onRecover={onRecover}
                onRetryResponse={(studentMessageId) =>
                  void handleRetryMessage(studentMessageId)
                }
                onSuggestionSelect={(text) =>
                  composerRef.current?.prefill(text)
                }
              />
            </div>
          </div>
          <StudentChatComposer
            ref={composerRef}
            hasSelectedSession
            isGenerating={isGenerationActive}
            sendError={sendMessage.error}
            courses={courses}
            selectedCourse={course}
            onDismissError={sendMessage.reset}
            onSend={handleSend}
          />
        </div>

        {sourcesOpen ? (
          <StudentSourcesPanel
            course={course}
            messages={messages}
            onCollapse={() => setSourcesOpen(false)}
            className="m-3 ml-0 hidden w-80 shrink-0 lg:flex"
          />
        ) : null}
      </div>
    </Sheet>
  )
}

function reconcileMessages(messages: ChatMessage[]) {
  const messagesById = new Map<string, ChatMessage>()

  for (const message of messages) {
    messagesById.set(message.id, message)
  }

  return [...messagesById.values()].sort(
    (left, right) => left.sequence - right.sequence,
  )
}
