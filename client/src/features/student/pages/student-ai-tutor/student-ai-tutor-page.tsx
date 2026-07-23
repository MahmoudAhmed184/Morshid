import { useNavigate } from '@tanstack/react-router'
import { BookOpen } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'

import { EmptyState } from '@/components/ui/custom/empty-state'
import { ErrorState } from '@/components/ui/custom/error-state'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useSidebar } from '@/components/ui/sidebar'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import {
  useRegisterComposerFocus,
  useRegisterSourcesControl,
} from '@/features/student/components/student-chrome-context'
import {
  isStudentChatApiError,
  STUDENT_CHAT_ERROR_CODES,
} from '@/features/student/data/student-chat.errors'
import { useStudentCourses } from '@/features/student/hooks/use-student-courses'
import {
  useCreateStudentSession,
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
import { StudentSuggestionRows } from './student-suggestion-rows'

interface StudentAiTutorPageProps {
  courseId?: string
  sessionId?: string
}

// A first message handed from the draft to the freshly-created session so the
// send runs through the destination composer (T15.2).
interface PendingFirstMessage {
  sessionId: string
  content: string
  clientMessageId: string
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
  const [pendingFirstMessage, setPendingFirstMessage] =
    useState<PendingFirstMessage | null>(null)

  const handleStaleSession = async () => {
    if (!selectedCourse) {
      return
    }

    await navigate({ to: '/chat', search: { courseId: selectedCourse.id } })
    void routedSessionQuery.refetch()
  }

  const handleFirstMessageCreated = useCallback(
    (session: ChatSession, content: string, clientMessageId: string) => {
      if (!selectedCourse) {
        return
      }

      setPendingFirstMessage({
        sessionId: session.id,
        content,
        clientMessageId,
      })
      void navigate({
        to: '/chat',
        search: { courseId: selectedCourse.id, sessionId: session.id },
        replace: true,
      })
    },
    [navigate, selectedCourse],
  )

  const consumePendingFirstMessage = useCallback(
    () => setPendingFirstMessage(null),
    [],
  )

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
          session={selectedSession}
          firstName={firstName}
          onRecover={() => void handleStaleSession()}
          pendingFirstMessage={
            pendingFirstMessage?.sessionId === selectedSession.id
              ? pendingFirstMessage
              : null
          }
          onConsumePendingFirstMessage={consumePendingFirstMessage}
        />
      ) : sessionId !== undefined ? (
        // A specific session was requested but is not yet available — loading,
        // unavailable, or missing. This is not the draft: it offers no composer
        // (the first-message draft lives only at `/chat?courseId` with no
        // sessionId) and resolves into the conversation once the session loads.
        <StudentSessionPlaceholder
          isSessionLoading={isSessionLoading}
          sessionError={routedSessionQuery.error}
          sessionRetrying={routedSessionQuery.isFetching}
          onRetrySession={() => void routedSessionQuery.refetch()}
        />
      ) : (
        <StudentDraftState
          key={`${studentId ?? 'anonymous'}:${selectedCourse.id}:draft`}
          course={selectedCourse}
          firstName={firstName}
          onFirstMessageCreated={handleFirstMessageCreated}
        />
      )}
    </section>
  )
}

// T15.6 — the conversation's sources chrome: the mobile Sources Sheet, the
// inline lg: sources column, and registration of the shell's BookMarked toggle.
// The panel is HIDDEN by default and never auto-opens; it is summoned only via
// the toggle, which itself appears only once the conversation holds ≥1 message
// (nothing to cite before then). The draft has no sources chrome at all.
interface StudentWorkspaceSourcesProps {
  course: StudentCourse
  messages: ChatMessage[]
  children: ReactNode
}

function StudentWorkspaceSources({
  course,
  messages,
  children,
}: StudentWorkspaceSourcesProps) {
  const { state: sidebarState } = useSidebar()
  const [mobileSourcesOpen, setMobileSourcesOpen] = useState(false)
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const toggleSources = useCallback(() => setSourcesOpen((open) => !open), [])
  const openMobileSources = useCallback(() => setMobileSourcesOpen(true), [])
  // The BookMarked toggle renders only when there is something to cite.
  useRegisterSourcesControl(
    sourcesOpen,
    toggleSources,
    openMobileSources,
    messages.length > 0,
  )

  return (
    <Sheet open={mobileSourcesOpen} onOpenChange={setMobileSourcesOpen}>
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
          {children}
        </div>

        <div
          aria-hidden={!sourcesOpen}
          className={cn(
            'hidden shrink-0 overflow-hidden transition-[width,opacity] duration-[250ms] ease-out motion-reduce:transition-none lg:flex',
            sourcesOpen ? 'w-[20.75rem] opacity-100' : 'w-0 opacity-0',
            // T12.6 — when the sidebar is collapsed the shell drops its top band
            // and floats a glass cluster at the top-right; keep the sources
            // column clear of it with an h-12-equivalent top inset.
            sidebarState === 'collapsed' && 'mt-12',
          )}
        >
          <StudentSourcesPanel
            course={course}
            messages={messages}
            onCollapse={() => setSourcesOpen(false)}
            className="m-3 ml-0 flex w-80 shrink-0"
          />
        </div>
      </div>
    </Sheet>
  )
}

interface StudentSessionPlaceholderProps {
  isSessionLoading: boolean
  sessionError: unknown
  sessionRetrying: boolean
  onRetrySession: () => void
}

function StudentSessionPlaceholder({
  isSessionLoading,
  sessionError,
  sessionRetrying,
  onRetrySession,
}: StudentSessionPlaceholderProps) {
  const hasBlockingSessionError =
    sessionError !== null &&
    !isStudentChatApiError(
      sessionError,
      STUDENT_CHAT_ERROR_CODES.SESSION_NOT_FOUND,
    )

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
  } else {
    body = (
      <EmptyState
        title="Conversation unavailable"
        description="This conversation may have been deleted or does not belong to the selected course."
        className="w-full max-w-md border-0 bg-transparent"
      />
    )
  }

  return (
    <div
      aria-label="Conversation messages"
      className="scrollbar-themed min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-8"
      role="region"
    >
      <div className="mx-auto flex min-h-full max-w-3xl items-center justify-center">
        {body}
      </div>
    </div>
  )
}

interface StudentDraftStateProps {
  course: StudentCourse
  firstName?: string
  onFirstMessageCreated: (
    session: ChatSession,
    content: string,
    clientMessageId: string,
  ) => void
}

// T15.1 — the DRAFT state at `/chat?courseId` (no sessionId): greeting +
// suggestions + an ENABLED composer. No session exists until the first message
// is sent, and there is no sources chrome (nothing to cite yet — T15.6).
function StudentDraftState({
  course,
  firstName,
  onFirstMessageCreated,
}: StudentDraftStateProps) {
  const composerRef = useRef<StudentChatComposerHandle>(null)
  const createSession = useCreateStudentSession({ courseId: course.id })

  // T15.7 — publish the draft composer's focus so the sidebar's New chat and the
  // collapsed `+` can focus it on entry, even from a different route subtree.
  useRegisterComposerFocus(() => composerRef.current?.focus())

  // T15.2 first-send chain — create the session, then hand the message to the
  // freshly-created session (the page navigates there and the destination
  // composer performs the send). Create failure keeps the draft and surfaces
  // through the composer's error affordance.
  const handleDraftSend = async (content: string, clientMessageId: string) => {
    try {
      const session = await createSession.mutateAsync({})
      onFirstMessageCreated(session, content, clientMessageId)
      return true
    } catch {
      return false
    }
  }

  return (
    <>
      <div
        aria-label="Conversation messages"
        className="scrollbar-themed min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-8"
        role="region"
      >
        <div className="mx-auto flex min-h-full max-w-3xl items-center justify-center">
          <div className="flex min-h-full w-full flex-col items-center justify-center gap-8">
            <h1 className="display-2 text-center text-foreground">
              {firstName
                ? `How can I help you, ${firstName}?`
                : 'How can I help you?'}
            </h1>
            <StudentSuggestionRows
              onSelect={(text) => composerRef.current?.prefill(text)}
            />
          </div>
        </div>
      </div>
      <StudentChatComposer
        ref={composerRef}
        isGenerating={createSession.isPending}
        sendError={createSession.error}
        onDismissError={createSession.reset}
        onSend={handleDraftSend}
      />
    </>
  )
}

interface StudentConversationProps {
  course: StudentCourse
  session: ChatSession
  firstName?: string
  onRecover: () => void
  pendingFirstMessage: PendingFirstMessage | null
  onConsumePendingFirstMessage: () => void
}

function StudentConversation({
  course,
  session,
  firstName,
  onRecover,
  pendingFirstMessage,
  onConsumePendingFirstMessage,
}: StudentConversationProps) {
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

  // T15.2 — a draft's first message arrives here after its session was created
  // and navigated to. Replay it through the composer once so the normal
  // optimistic send + send-failure contract (message stays in the composer, with
  // the same clientMessageId to retry) both apply.
  const pendingFirstMessageHandledRef = useRef(false)
  useEffect(() => {
    if (!pendingFirstMessage || pendingFirstMessageHandledRef.current) {
      return
    }

    pendingFirstMessageHandledRef.current = true
    composerRef.current?.submitWith(
      pendingFirstMessage.content,
      pendingFirstMessage.clientMessageId,
    )
    onConsumePendingFirstMessage()
  }, [pendingFirstMessage, onConsumePendingFirstMessage])

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
    <StudentWorkspaceSources course={course} messages={messages}>
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
            onSuggestionSelect={(text) => composerRef.current?.prefill(text)}
          />
        </div>
      </div>
      <StudentChatComposer
        ref={composerRef}
        isGenerating={isGenerationActive}
        sendError={sendMessage.error}
        onDismissError={sendMessage.reset}
        onSend={handleSend}
      />
    </StudentWorkspaceSources>
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
