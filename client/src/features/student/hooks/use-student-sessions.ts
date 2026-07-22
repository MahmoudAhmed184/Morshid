import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import type { InfiniteData } from '@tanstack/react-query'

import { useAuthStore } from '@/features/auth/stores/auth.store'
import {
  createStudentSession,
  deleteStudentSession,
  renameStudentSession,
  retryStudentChatMessage,
  sendStudentChatMessage,
} from '@/features/student/data/student-sessions.api'
import {
  studentSessionKeys,
  studentSessionMessagesQueryOptions,
  studentSessionQueryOptions,
  studentSessionsQueryOptions,
} from '@/features/student/data/student-sessions.queries'
import type {
  ChatMessage,
  ChatMessageHistoryResponse,
  ChatSessionListResponse,
  CreateChatSessionInput,
  GroundedChatTurnResponse,
  RenameChatSessionInput,
  SendStudentChatMessageInput,
} from '@/features/student/schemas/student-chat.schema'

interface StudentSessionsScope {
  courseId?: string
}

interface StudentSessionMessagesScope {
  courseId?: string
  sessionId?: string
}

interface StudentChatMutationScope {
  courseId?: string
  sessionId?: string
}

interface StudentCourseScope {
  courseId?: string
}

interface RenameStudentSessionVariables {
  sessionId: string
  input: RenameChatSessionInput
}

function useStudentId() {
  return useAuthStore((state) => state.user?.id)
}

function requireScope(
  studentId: string | undefined,
  courseId: string | undefined,
) {
  if (!studentId || !courseId) {
    throw new Error('Choose an assigned course first.')
  }

  return { studentId, courseId }
}

function requireChatScope(
  studentId: string | undefined,
  courseId: string | undefined,
  sessionId: string | undefined,
) {
  const scope = requireScope(studentId, courseId)

  if (!sessionId) {
    throw new Error('Choose a conversation first.')
  }

  return { ...scope, sessionId }
}

type MessageHistoryData = InfiniteData<
  ChatMessageHistoryResponse,
  number | undefined
>

function emptyMessageHistory(): MessageHistoryData {
  return {
    pages: [{ messages: [], nextCursor: null }],
    pageParams: [undefined],
  }
}

function appendMessage(
  cached: MessageHistoryData | undefined,
  message: ChatMessage,
): MessageHistoryData {
  const history = cached ?? emptyMessageHistory()
  const lastPageIndex = history.pages.length - 1

  return {
    ...history,
    pages: history.pages.map((page, index) =>
      index === lastPageIndex
        ? {
            ...page,
            messages: [
              ...page.messages.filter(({ id }) => id !== message.id),
              message,
            ].sort((left, right) => left.sequence - right.sequence),
          }
        : page,
    ),
  }
}

function replaceOptimisticTurn(
  cached: MessageHistoryData | undefined,
  optimisticMessageId: string,
  turn: GroundedChatTurnResponse,
): MessageHistoryData {
  const history = cached ?? emptyMessageHistory()
  const replacementIds = new Set([
    optimisticMessageId,
    turn.studentMessage.id,
    turn.assistantMessage.id,
  ])
  const lastPageIndex = history.pages.length - 1

  return {
    ...history,
    pages: history.pages.map((page, index) => {
      const messages = page.messages.filter(({ id }) => !replacementIds.has(id))

      return index === lastPageIndex
        ? {
            ...page,
            messages: [
              ...messages,
              turn.studentMessage,
              turn.assistantMessage,
            ].sort((left, right) => left.sequence - right.sequence),
          }
        : { ...page, messages }
    }),
  }
}

function replacePersistedTurn(
  cached: MessageHistoryData | undefined,
  turn: GroundedChatTurnResponse,
): MessageHistoryData {
  const history = cached ?? emptyMessageHistory()
  const replacements = new Map([
    [turn.studentMessage.id, turn.studentMessage],
    [turn.assistantMessage.id, turn.assistantMessage],
  ])

  return {
    ...history,
    pages: history.pages.map((page) => ({
      ...page,
      messages: page.messages.map(
        (message) => replacements.get(message.id) ?? message,
      ),
    })),
  }
}

function markAssistantPending(
  cached: MessageHistoryData | undefined,
  studentMessageId: string,
): MessageHistoryData {
  const history = cached ?? emptyMessageHistory()

  return {
    ...history,
    pages: history.pages.map((page) => ({
      ...page,
      messages: page.messages.map((message) =>
        message.role === 'ASSISTANT' &&
        message.responseToMessageId === studentMessageId &&
        message.status === 'FAILED'
          ? {
              ...message,
              status: 'PENDING' as const,
              completedAt: null,
              errorCode: null,
            }
          : message,
      ),
    })),
  }
}

function highestCachedSequence(cached: MessageHistoryData | undefined) {
  let highestSequence = 0

  for (const page of cached?.pages ?? []) {
    for (const message of page.messages) {
      highestSequence = Math.max(highestSequence, message.sequence)
    }
  }

  return highestSequence
}

export function useStudentSessions({ courseId }: StudentSessionsScope) {
  const studentId = useStudentId()

  return useInfiniteQuery({
    ...studentSessionsQueryOptions({
      studentId: studentId ?? 'anonymous',
      courseId: courseId ?? 'unknown',
    }),
    enabled: studentId !== undefined && courseId !== undefined,
  })
}

export function useStudentSessionMessages({
  courseId,
  sessionId,
}: StudentSessionMessagesScope) {
  const studentId = useStudentId()

  return useInfiniteQuery({
    ...studentSessionMessagesQueryOptions({
      studentId: studentId ?? 'anonymous',
      courseId: courseId ?? 'unknown',
      sessionId: sessionId ?? 'unknown',
    }),
    enabled:
      studentId !== undefined &&
      courseId !== undefined &&
      sessionId !== undefined,
  })
}

export function useStudentSession({
  courseId,
  sessionId,
}: StudentSessionMessagesScope) {
  const studentId = useStudentId()

  return useQuery({
    ...studentSessionQueryOptions({
      studentId: studentId ?? 'anonymous',
      courseId: courseId ?? 'unknown',
      sessionId: sessionId ?? 'unknown',
    }),
    enabled:
      studentId !== undefined &&
      courseId !== undefined &&
      sessionId !== undefined,
  })
}

export function useCreateStudentSession({ courseId }: StudentCourseScope) {
  const studentId = useStudentId()
  const queryClient = useQueryClient()

  return useMutation({
    onMutate: () => requireScope(studentId, courseId),
    mutationFn: (input: CreateChatSessionInput) => {
      const scope = requireScope(studentId, courseId)
      return createStudentSession({ courseId: scope.courseId, input })
    },
    onSuccess: (createdSession, _input, scope) => {
      queryClient.setQueryData<
        InfiniteData<ChatSessionListResponse, string | undefined>
      >(studentSessionKeys.sessionList(scope), (cached) => {
        const pages = cached?.pages ?? [{ sessions: [], nextCursor: null }]
        const pageParams = cached?.pageParams ?? [undefined]

        return {
          pages: pages.map((page, index) => ({
            ...page,
            sessions: [
              ...(index === 0 ? [createdSession] : []),
              ...page.sessions.filter(
                (session) => session.id !== createdSession.id,
              ),
            ],
          })),
          pageParams,
        }
      })
      queryClient.setQueryData<
        InfiniteData<ChatMessageHistoryResponse, number | undefined>
      >(
        studentSessionKeys.messageList({
          ...scope,
          sessionId: createdSession.id,
        }),
        {
          pages: [{ messages: [], nextCursor: null }],
          pageParams: [undefined],
        },
      )
      queryClient.setQueryData(
        studentSessionKeys.detail({
          ...scope,
          sessionId: createdSession.id,
        }),
        createdSession,
      )
    },
  })
}

export function useRenameStudentSession({ courseId }: StudentCourseScope) {
  const studentId = useStudentId()
  const queryClient = useQueryClient()

  return useMutation({
    onMutate: () => requireScope(studentId, courseId),
    mutationFn: ({ sessionId, input }: RenameStudentSessionVariables) => {
      const scope = requireScope(studentId, courseId)
      return renameStudentSession({
        courseId: scope.courseId,
        sessionId,
        input,
      })
    },
    onSuccess: (renamedSession, _variables, scope) => {
      queryClient.setQueriesData<
        InfiniteData<ChatSessionListResponse, string | undefined>
      >(
        {
          queryKey: studentSessionKeys.sessionLists(scope),
        },
        (cached) =>
          cached
            ? {
                ...cached,
                pages: cached.pages.map((page) => ({
                  ...page,
                  sessions: page.sessions.map((session) =>
                    session.id === renamedSession.id ? renamedSession : session,
                  ),
                })),
              }
            : cached,
      )
      queryClient.setQueryData(
        studentSessionKeys.detail({
          ...scope,
          sessionId: renamedSession.id,
        }),
        renamedSession,
      )
    },
  })
}

export function useDeleteStudentSession({ courseId }: StudentCourseScope) {
  const studentId = useStudentId()
  const queryClient = useQueryClient()

  return useMutation({
    onMutate: () => requireScope(studentId, courseId),
    mutationFn: (sessionId: string) => {
      const scope = requireScope(studentId, courseId)
      return deleteStudentSession({
        courseId: scope.courseId,
        sessionId,
      })
    },
    onSuccess: (_response, sessionId, scope) => {
      queryClient.setQueriesData<
        InfiniteData<ChatSessionListResponse, string | undefined>
      >(
        {
          queryKey: studentSessionKeys.sessionLists(scope),
        },
        (cached) =>
          cached
            ? {
                ...cached,
                pages: cached.pages.map((page) => ({
                  ...page,
                  sessions: page.sessions.filter(
                    (session) => session.id !== sessionId,
                  ),
                })),
              }
            : cached,
      )
      queryClient.removeQueries({
        queryKey: studentSessionKeys.messages({ ...scope, sessionId }),
        exact: true,
      })
      queryClient.removeQueries({
        queryKey: studentSessionKeys.detail({ ...scope, sessionId }),
        exact: true,
      })
    },
  })
}

export function useSendStudentChatMessage({
  courseId,
  sessionId,
}: StudentChatMutationScope) {
  const studentId = useStudentId()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: SendStudentChatMessageInput) => {
      const scope = requireChatScope(studentId, courseId, sessionId)
      return sendStudentChatMessage({
        courseId: scope.courseId,
        sessionId: scope.sessionId,
        input,
      })
    },
    onMutate: async (input) => {
      const scope = requireChatScope(studentId, courseId, sessionId)
      const queryKey = studentSessionKeys.messageList(scope)
      await queryClient.cancelQueries({ queryKey })
      const previousMessages =
        queryClient.getQueryData<MessageHistoryData>(queryKey)
      const now = new Date().toISOString()
      const optimisticMessage: ChatMessage = {
        id: crypto.randomUUID(),
        sequence: highestCachedSequence(previousMessages) + 1,
        role: 'STUDENT',
        responseToMessageId: null,
        content: input.content.trim(),
        status: 'PENDING',
        requestKind: null,
        guidanceLabel: null,
        hintLevel: null,
        errorCode: null,
        createdAt: now,
        completedAt: null,
        citations: [],
      }

      queryClient.setQueryData<MessageHistoryData>(
        queryKey,
        appendMessage(previousMessages, optimisticMessage),
      )

      return {
        optimisticMessageId: optimisticMessage.id,
        previousMessages,
        queryKey,
        scope,
      }
    },
    onError: (_error, _input, mutationContext) => {
      if (mutationContext) {
        queryClient.setQueryData(
          mutationContext.queryKey,
          mutationContext.previousMessages,
        )
      }
    },
    onSuccess: (turn, _input, mutationContext) => {
      queryClient.setQueryData<MessageHistoryData>(
        mutationContext.queryKey,
        (cached) =>
          replaceOptimisticTurn(
            cached,
            mutationContext.optimisticMessageId,
            turn,
          ),
      )
    },
    onSettled: (_turn, _error, _input, mutationContext) => {
      if (!mutationContext) {
        return
      }

      void queryClient.invalidateQueries({
        queryKey: mutationContext.queryKey,
      })
      void queryClient.invalidateQueries({
        queryKey: studentSessionKeys.sessionLists(mutationContext.scope),
      })
    },
  })
}

export function useRetryStudentChatMessage({
  courseId,
  sessionId,
}: StudentChatMutationScope) {
  const studentId = useStudentId()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (studentMessageId: string) => {
      const scope = requireChatScope(studentId, courseId, sessionId)
      return retryStudentChatMessage({
        courseId: scope.courseId,
        sessionId: scope.sessionId,
        studentMessageId,
      })
    },
    onMutate: async (studentMessageId) => {
      const scope = requireChatScope(studentId, courseId, sessionId)
      const queryKey = studentSessionKeys.messageList(scope)
      await queryClient.cancelQueries({ queryKey })
      const previousMessages =
        queryClient.getQueryData<MessageHistoryData>(queryKey)

      queryClient.setQueryData<MessageHistoryData>(
        queryKey,
        markAssistantPending(previousMessages, studentMessageId),
      )

      return { previousMessages, queryKey, scope }
    },
    onError: (_error, _studentMessageId, mutationContext) => {
      if (mutationContext) {
        queryClient.setQueryData(
          mutationContext.queryKey,
          mutationContext.previousMessages,
        )
      }
    },
    onSuccess: (turn, _studentMessageId, mutationContext) => {
      queryClient.setQueryData<MessageHistoryData>(
        mutationContext.queryKey,
        (cached) => replacePersistedTurn(cached, turn),
      )
    },
    onSettled: (_turn, _error, _studentMessageId, mutationContext) => {
      if (!mutationContext) {
        return
      }

      void queryClient.invalidateQueries({
        queryKey: mutationContext.queryKey,
      })
      void queryClient.invalidateQueries({
        queryKey: studentSessionKeys.sessionLists(mutationContext.scope),
      })
    },
  })
}
