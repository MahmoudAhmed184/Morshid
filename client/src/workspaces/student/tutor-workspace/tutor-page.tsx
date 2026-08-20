import { useNavigate, useRouterState } from '@tanstack/react-router'
import { BookOpen } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { z } from 'zod'

import { EmptyState } from '@/components/ui/custom/empty-state'
import { ErrorState } from '@/components/ui/custom/error-state'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useAuthStore } from '@/features/auth/session/interface/session-store'
import {
  useRegisterComposerFocus,
  useRegisterSourcesControl,
} from '@/workspaces/student/navigation/student-chrome-context'
import { useStudentCourseContext } from '@/workspaces/student/navigation/student-course-context'
import {
  isChatApiError,
  CHAT_ERROR_CODES,
} from '@/features/chat/messages/chat.errors'
import {
  useCreateChatSession,
  useRenameChatSession,
  useChatSession,
  useChatMessages,
} from '@/workspaces/student/tutor-workspace/use-chat-sessions'
import {
  useRetryChatMessage,
  useSendChatMessage,
} from '@/workspaces/student/tutor-workspace/use-chat-messages'
import { useStudentReviewRequest } from '@/workspaces/student/tutor-workspace/use-review-request'
import type { ChatMessage } from '@/features/chat/messages/chat-message.schema'
import type { ChatSession } from '@/features/chat/sessions/chat-session.schema'
import type { StudentCourseAccess } from '@/features/courses/course-access/course-access.schema'
import { firstNameFromDisplayName } from '@/workspaces/student/tutor-workspace/greeting'
import { cn } from '@/lib/utils'

import { StudentChatComposer } from './chat-composer'
import type { StudentChatComposerActions } from './chat-composer'
import { StudentMessageHistory } from './message-history'
import { StudentSourcesPanel } from './sources-panel'
import { StudentSuggestionRows } from './suggestion-rows'

interface TutorPageProps {
  sessionId?: string
}

// A first message handed from the draft to the freshly-created session so the
// send runs through the destination composer (T15.2).
interface PendingFirstMessage {
  session: ChatSession
  content: string
  clientMessageId: string
}

export function submitPendingFirstMessage(
  pending: PendingFirstMessage | null,
  actions: StudentChatComposerActions | null,
): boolean {
  if (!pending || !actions) {
    return false
  }
  actions.submitWith(pending.content, pending.clientMessageId)
  return true
}

export function TutorPage({ sessionId }: TutorPageProps) {
  const navigate = useNavigate()
  const studentId = useAuthStore((state) => state.user?.id)
  const displayName = useAuthStore((state) => state.user?.displayName)
  const firstName = firstNameFromDisplayName(displayName)
  // The one active-course model for the whole student shell (it already reads
  // `?courseId`), so the workspace, the sidebar switcher, New chat and the ⌘K
  // palette can never disagree about which notebook is open.
  const {
    courses: assignedCourses,
    activeCourse: selectedCourse,
    unavailableCourseId,
  } = useStudentCourseContext()
  const routedSessionQuery = useChatSession({
    courseId: selectedCourse?.id,
    sessionId,
  })
  const selectedSession = routedSessionQuery.data ?? null
  const [pendingFirstMessage, setPendingFirstMessage] =
    useState<PendingFirstMessage | null>(null)
  const recoveredSessionRef = useRef<string | null>(null)
  const routedSessionMissing = isChatApiError(
    routedSessionQuery.error,
    CHAT_ERROR_CODES.SESSION_NOT_FOUND,
  )

  useEffect(() => {
    if (!selectedCourse || sessionId === undefined || !routedSessionMissing) {
      return
    }

    const recoveryKey = `${selectedCourse.id}:${sessionId}`
    if (recoveredSessionRef.current === recoveryKey) return
    recoveredSessionRef.current = recoveryKey

    void navigate({
      to: '/chat',
      search: { courseId: selectedCourse.id, sessionId: undefined },
      replace: true,
    })
  }, [navigate, routedSessionMissing, selectedCourse, sessionId])

  const handleStaleSession = async () => {
    if (!selectedCourse) {
      return
    }

    await navigate({
      to: '/chat',
      search: { courseId: selectedCourse.id, sessionId: undefined },
      replace: true,
    })
  }

  const handleFirstMessageCreated = useCallback(
    async (
      session: ChatSession,
      content: string,
      clientMessageId: string,
    ): Promise<boolean> => {
      if (!selectedCourse) {
        return false
      }

      setPendingFirstMessage({
        session,
        content,
        clientMessageId,
      })
      try {
        await navigate({
          to: '/chat',
          search: { courseId: selectedCourse.id, sessionId: session.id },
          replace: true,
        })
        return true
      } catch {
        return false
      }
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
            unavailableCourseId !== null
              ? 'Course unavailable'
              : assignedCourses.length === 0
                ? 'No assigned course'
                : 'Choose a course'
          }
          description={
            unavailableCourseId !== null
              ? 'This course is no longer available to your account. Choose one of your assigned courses from the course switcher.'
              : assignedCourses.length === 0
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
          studentId={studentId}
          firstName={firstName}
          onRecover={() => void handleStaleSession()}
          pendingFirstMessage={
            pendingFirstMessage?.session.id === selectedSession.id
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
          studentId={studentId}
          firstName={firstName}
          pendingFirstMessage={pendingFirstMessage}
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
  course: StudentCourseAccess
  messages: ChatMessage[]
  children: ReactNode
}

function StudentWorkspaceSources({
  course,
  messages,
  children,
}: StudentWorkspaceSourcesProps) {
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
          inert={!sourcesOpen}
          className={cn(
            'hidden shrink-0 overflow-hidden transition-[width,opacity] duration-[250ms] ease-out motion-reduce:transition-none lg:flex',
            sourcesOpen ? 'w-[20.75rem] opacity-100' : 'w-0 opacity-0',
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
    !isChatApiError(sessionError, CHAT_ERROR_CODES.SESSION_NOT_FOUND)

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
  course: StudentCourseAccess
  studentId?: string
  firstName?: string
  pendingFirstMessage: PendingFirstMessage | null
  onFirstMessageCreated: (
    session: ChatSession,
    content: string,
    clientMessageId: string,
  ) => Promise<boolean>
}

// T15.1 — the DRAFT state at `/chat?courseId` (no sessionId): greeting +
// suggestions + an ENABLED composer. No session exists until the first message
// is sent, and there is no sources chrome (nothing to cite yet — T15.6).
function StudentDraftState({
  course,
  studentId,
  firstName,
  pendingFirstMessage,
  onFirstMessageCreated,
}: StudentDraftStateProps) {
  const composerActionsRef = useRef<StudentChatComposerActions | null>(null)
  const [handoffError, setHandoffError] = useState<Error | null>(null)
  const registerComposerActions = useCallback(
    (actions: StudentChatComposerActions | null) => {
      composerActionsRef.current = actions
    },
    [],
  )
  const createSession = useCreateChatSession({ courseId: course.id })

  // T15.7 — publish the draft composer's focus so the sidebar's New chat and the
  // collapsed `+` can focus it on entry, even from a different route subtree.
  useRegisterComposerFocus(() => composerActionsRef.current?.focus())

  // T15.2 first-send chain — create the session, then hand the message to the
  // freshly-created session (the page navigates there and the destination
  // composer performs the send). Create failure keeps the draft and surfaces
  // through the composer's error affordance.
  const handleDraftSend = async (content: string, clientMessageId: string) => {
    setHandoffError(null)
    try {
      if (
        pendingFirstMessage?.clientMessageId === clientMessageId &&
        pendingFirstMessage.content === content
      ) {
        const accepted = await onFirstMessageCreated(
          pendingFirstMessage.session,
          content,
          clientMessageId,
        )
        if (!accepted) {
          setHandoffError(new Error('Conversation navigation failed'))
        }
        return accepted
      }
      const generatedTitle =
        content.trim().length > 0 ? content.trim().slice(0, 60) : undefined
      const session = await createSession.mutateAsync({
        title: generatedTitle,
      })
      const accepted = await onFirstMessageCreated(
        session,
        content,
        clientMessageId,
      )
      if (!accepted) {
        setHandoffError(new Error('Conversation navigation failed'))
      }
      return accepted
    } catch {
      return false
    }
  }

  return (
    <>
      <div
        aria-label="Conversation messages"
        className="scrollbar-themed min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-16 pb-8 sm:px-6 sm:py-8"
        role="region"
      >
        <div className="mx-auto flex min-h-full max-w-3xl items-center justify-center">
          <div className="flex min-h-full w-full flex-col items-center justify-center gap-8">
            <h1 className="text-balance text-center font-sans text-[clamp(2rem,4vw,3.5rem)] leading-[1.08] font-semibold tracking-[-0.03em] text-foreground">
              {firstName
                ? `How can I help you, ${firstName}?`
                : 'How can I help you?'}
            </h1>
            <StudentSuggestionRows
              onSelect={(text) => composerActionsRef.current?.prefill(text)}
            />
          </div>
        </div>
      </div>
      <StudentChatComposer
        userId={studentId}
        courseId={course.id}
        sessionId="new"
        isGenerating={createSession.isPending}
        sendError={handoffError ?? createSession.error}
        onDismissError={() => {
          setHandoffError(null)
          createSession.reset()
        }}
        onSend={handleDraftSend}
        onActionsReady={registerComposerActions}
      />
    </>
  )
}

interface StudentConversationProps {
  course: StudentCourseAccess
  session: ChatSession
  studentId?: string
  firstName?: string
  onRecover: () => void
  pendingFirstMessage: PendingFirstMessage | null
  onConsumePendingFirstMessage: () => void
}

function StudentConversation({
  course,
  session,
  studentId,
  firstName,
  onRecover,
  pendingFirstMessage,
  onConsumePendingFirstMessage,
}: StudentConversationProps) {
  const messageHash = useRouterState({
    select: (state) => state.location.hash,
  })
  const deepLinkedMessageId = parseMessageHash(messageHash)
  const composerActionsRef = useRef<StudentChatComposerActions | null>(null)
  const [composerActions, setComposerActions] =
    useState<StudentChatComposerActions | null>(null)
  const registerComposerActions = useCallback(
    (actions: StudentChatComposerActions | null) => {
      composerActionsRef.current = actions
      setComposerActions(actions)
    },
    [],
  )
  const messagesQuery = useChatMessages({
    courseId: course.id,
    sessionId: session.id,
  })
  const messages = reconcileMessages(
    messagesQuery.data?.pages.flatMap((page) => page.messages) ?? [],
  )
  const sendMessage = useSendChatMessage({
    courseId: course.id,
    sessionId: session.id,
  })
  const retryMessage = useRetryChatMessage({
    courseId: course.id,
    sessionId: session.id,
  })
  const requestReview = useStudentReviewRequest({
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
  const followsLatestRef = useRef(true)
  const didInitialScrollRef = useRef(false)
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
    if (pendingFirstMessageHandledRef.current) {
      return
    }

    if (!submitPendingFirstMessage(pendingFirstMessage, composerActions)) {
      return
    }
    pendingFirstMessageHandledRef.current = true
    onConsumePendingFirstMessage()
  }, [composerActions, pendingFirstMessage, onConsumePendingFirstMessage])

  useLayoutEffect(() => {
    if (messagesQuery.isPending) {
      return
    }

    const latestMessageChanged =
      previousLatestMessageRef.current !== latestMessageKey
    previousLatestMessageRef.current = latestMessageKey
    const initialScroll = !didInitialScrollRef.current
    didInitialScrollRef.current = true

    if (latestMessageChanged && (initialScroll || followsLatestRef.current)) {
      const scrollContainer = historyScrollRef.current
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [latestMessageKey, messagesQuery.isPending])

  const handleHistoryScroll = () => {
    const scrollContainer = historyScrollRef.current
    if (!scrollContainer) {
      return
    }
    followsLatestRef.current =
      scrollContainer.scrollHeight -
        scrollContainer.scrollTop -
        scrollContainer.clientHeight <=
      80
  }

  useMessageDeepLink({
    messageId: deepLinkedMessageId,
    messages,
    isPending: messagesQuery.isPending,
    hasNextPage: messagesQuery.hasNextPage,
    isFetchingNextPage: messagesQuery.isFetchingNextPage,
    isFetchNextPageError: messagesQuery.isFetchNextPageError,
    fetchNextPage: messagesQuery.fetchNextPage,
  })

  const renameSession = useRenameChatSession({ courseId: course.id })

  const handleSend = async (content: string, clientMessageId: string) => {
    retryMessage.reset()
    followsLatestRef.current = true

    if (session.title === 'New chat' && content.trim().length > 0) {
      const newTitle = content.trim().slice(0, 60)
      void renameSession
        .mutateAsync({
          sessionId: session.id,
          input: { title: newTitle },
        })
        .catch(() => {})
    }

    try {
      await sendMessage.mutateAsync({ clientMessageId, content })
      return true
    } catch {
      return false
    }
  }

  const handleRetryMessage = async (input: {
    attemptId: string
    studentMessageId: string
  }) => {
    sendMessage.reset()
    followsLatestRef.current = true

    try {
      await retryMessage.mutateAsync(input)
    } catch {
      // Mutation state renders the scoped retry failure next to the response.
    }
  }

  return (
    <StudentWorkspaceSources course={course} messages={messages}>
      <div
        ref={historyScrollRef}
        onScroll={handleHistoryScroll}
        aria-label="Conversation messages"
        className="scrollbar-themed min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-16 pb-8 sm:px-6 sm:py-8"
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
            retryMessageId={retryMessage.variables?.studentMessageId}
            firstName={firstName}
            onRetry={() => void messagesQuery.refetch()}
            onLoadMore={() => void messagesQuery.fetchNextPage()}
            onRecover={onRecover}
            onRetryResponse={(input) => void handleRetryMessage(input)}
            onRequestReview={(input) => requestReview.mutateAsync(input)}
            onSuggestionSelect={(text) =>
              composerActionsRef.current?.prefill(text)
            }
          />
        </div>
      </div>
      <StudentChatComposer
        userId={studentId}
        courseId={course.id}
        sessionId={session.id}
        messages={messages}
        isGenerating={isGenerationActive}
        sendError={sendMessage.error}
        onDismissError={sendMessage.reset}
        onSend={handleSend}
        onActionsReady={registerComposerActions}
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

const messageIdSchema = z.uuid()

function parseMessageHash(hash: string) {
  const normalized = hash.replace(/^#/, '')
  if (!normalized.startsWith('message-')) return null

  const parsedMessageId = messageIdSchema.safeParse(
    normalized.slice('message-'.length),
  )
  return parsedMessageId.success ? parsedMessageId.data : null
}

function useMessageDeepLink({
  messageId,
  messages,
  isPending,
  hasNextPage,
  isFetchingNextPage,
  isFetchNextPageError,
  fetchNextPage,
}: {
  messageId: string | null
  messages: ChatMessage[]
  isPending: boolean
  hasNextPage: boolean
  isFetchingNextPage: boolean
  isFetchNextPageError: boolean
  fetchNextPage: () => Promise<unknown>
}) {
  const completedTargetRef = useRef<string | null>(null)
  const requestedTargetRef = useRef<string | null>(null)
  const [pageAttempt, setPageAttempt] = useState(0)

  useEffect(() => {
    if (messageId === null || completedTargetRef.current === messageId) return

    const target = document.getElementById(`message-${messageId}`)
    if (target) {
      completedTargetRef.current = messageId
      target.focus({ preventScroll: true })
      target.scrollIntoView({ block: 'center' })
      return
    }

    if (
      isPending ||
      !hasNextPage ||
      isFetchingNextPage ||
      isFetchNextPageError ||
      requestedTargetRef.current === messageId
    ) {
      return
    }

    requestedTargetRef.current = messageId
    void fetchNextPage().finally(() => {
      requestedTargetRef.current = null
      setPageAttempt((current) => current + 1)
    })
  }, [
    fetchNextPage,
    hasNextPage,
    isFetchNextPageError,
    isFetchingNextPage,
    isPending,
    messageId,
    messages,
    pageAttempt,
  ])
}
