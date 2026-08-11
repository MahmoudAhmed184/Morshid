import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import type { InfiniteData } from '@tanstack/react-query'

import { useAuthStore } from '@/features/auth/session/session.store'
import {
  createChatSession,
  deleteChatSession,
  renameChatSession,
} from '@/features/chat/sessions/chat-sessions.api'
import {
  chatSessionKeys,
  chatMessagesQueryOptions,
  chatSessionQueryOptions,
  chatSessionsQueryOptions,
} from '@/features/chat/sessions/chat-sessions.queries'
import {
  hasActiveReview,
  hasPendingAssistant,
} from '@/features/chat/messages/chat-message-history'
import type {
  ChatCourseSelection,
  ChatSessionSelection,
} from '@/features/chat/sessions/chat-scope'
import type { ChatMessageHistoryResponse } from '@/features/chat/messages/chat-message.schema'
import type {
  ChatSessionListResponse,
  CreateChatSessionInput,
  RenameChatSessionInput,
} from '@/features/chat/sessions/chat-session.schema'
import { visibilityAwarePollingInterval } from '@/lib/query/polling'

interface RenameChatSessionVariables {
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

export function useChatSessions({ courseId }: ChatCourseSelection) {
  const studentId = useStudentId()

  return useInfiniteQuery({
    ...chatSessionsQueryOptions({
      studentId: studentId ?? 'anonymous',
      courseId: courseId ?? 'unknown',
    }),
    enabled: studentId !== undefined && courseId !== undefined,
  })
}

export function useChatMessages({ courseId, sessionId }: ChatSessionSelection) {
  const studentId = useStudentId()

  return useInfiniteQuery({
    ...chatMessagesQueryOptions({
      studentId: studentId ?? 'anonymous',
      courseId: courseId ?? 'unknown',
      sessionId: sessionId ?? 'unknown',
    }),
    enabled:
      studentId !== undefined &&
      courseId !== undefined &&
      sessionId !== undefined,
    refetchInterval: (query) => {
      if (hasPendingAssistant(query.state.data)) return 1_500
      return hasActiveReview(query.state.data)
        ? visibilityAwarePollingInterval()
        : false
    },
    refetchIntervalInBackground: true,
  })
}

export function useChatSession({ courseId, sessionId }: ChatSessionSelection) {
  const studentId = useStudentId()

  return useQuery({
    ...chatSessionQueryOptions({
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

export function useCreateChatSession({ courseId }: ChatCourseSelection) {
  const studentId = useStudentId()
  const queryClient = useQueryClient()

  return useMutation({
    onMutate: () => requireScope(studentId, courseId),
    mutationFn: (input: CreateChatSessionInput) => {
      const scope = requireScope(studentId, courseId)
      return createChatSession({ courseId: scope.courseId, input })
    },
    onSuccess: (createdSession, _input, scope) => {
      queryClient.setQueryData<
        InfiniteData<ChatSessionListResponse, string | undefined>
      >(chatSessionKeys.sessionList(scope), (cached) => {
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
        chatSessionKeys.messageList({
          ...scope,
          sessionId: createdSession.id,
        }),
        {
          pages: [{ messages: [], nextCursor: null }],
          pageParams: [undefined],
        },
      )
      queryClient.setQueryData(
        chatSessionKeys.detail({
          ...scope,
          sessionId: createdSession.id,
        }),
        createdSession,
      )
    },
  })
}

export function useRenameChatSession({ courseId }: ChatCourseSelection) {
  const studentId = useStudentId()
  const queryClient = useQueryClient()

  return useMutation({
    onMutate: () => requireScope(studentId, courseId),
    mutationFn: ({ sessionId, input }: RenameChatSessionVariables) => {
      const scope = requireScope(studentId, courseId)
      return renameChatSession({
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
          queryKey: chatSessionKeys.sessionLists(scope),
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
        chatSessionKeys.detail({
          ...scope,
          sessionId: renamedSession.id,
        }),
        renamedSession,
      )
    },
  })
}

export function useDeleteChatSession({ courseId }: ChatCourseSelection) {
  const studentId = useStudentId()
  const queryClient = useQueryClient()

  return useMutation({
    onMutate: () => requireScope(studentId, courseId),
    mutationFn: (sessionId: string) => {
      const scope = requireScope(studentId, courseId)
      return deleteChatSession({
        courseId: scope.courseId,
        sessionId,
      })
    },
    onSuccess: (_response, sessionId, scope) => {
      queryClient.setQueriesData<
        InfiniteData<ChatSessionListResponse, string | undefined>
      >(
        {
          queryKey: chatSessionKeys.sessionLists(scope),
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
        queryKey: chatSessionKeys.messages({ ...scope, sessionId }),
        exact: true,
      })
      queryClient.removeQueries({
        queryKey: chatSessionKeys.detail({ ...scope, sessionId }),
        exact: true,
      })
    },
  })
}
