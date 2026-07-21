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
} from '@/features/student/data/student-sessions.api'
import {
  studentSessionKeys,
  studentSessionMessagesQueryOptions,
  studentSessionQueryOptions,
  studentSessionsQueryOptions,
} from '@/features/student/data/student-sessions.queries'
import type {
  ChatMessageHistoryResponse,
  ChatSessionListResponse,
  CreateChatSessionInput,
  RenameChatSessionInput,
} from '@/features/student/schemas/student-chat.schema'

interface StudentSessionsScope {
  courseId?: string
}

interface StudentSessionMessagesScope {
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
