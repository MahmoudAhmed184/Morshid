import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuthStore } from '@/features/auth/stores/auth.store'
import {
  createStudentSession,
  deleteStudentSession,
  renameStudentSession,
} from '@/features/student/data/student-sessions.api'
import {
  studentSessionKeys,
  studentSessionMessagesQueryOptions,
  studentSessionsQueryOptions,
} from '@/features/student/data/student-sessions.queries'
import type {
  ChatSessionListResponse,
  CreateChatSessionInput,
  ListChatMessagesInput,
  ListChatSessionsInput,
  RenameChatSessionInput,
} from '@/features/student/schemas/student-chat.schema'

interface StudentSessionsScope {
  courseId?: string
  input?: ListChatSessionsInput
}

interface StudentSessionMessagesScope {
  courseId?: string
  sessionId?: string
  input?: ListChatMessagesInput
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

export function useStudentSessions({ courseId, input }: StudentSessionsScope) {
  const studentId = useStudentId()

  return useQuery({
    ...studentSessionsQueryOptions({
      studentId: studentId ?? 'anonymous',
      courseId: courseId ?? 'unknown',
      input,
    }),
    enabled: studentId !== undefined && courseId !== undefined,
  })
}

export function useStudentSessionMessages({
  courseId,
  sessionId,
  input,
}: StudentSessionMessagesScope) {
  const studentId = useStudentId()

  return useQuery({
    ...studentSessionMessagesQueryOptions({
      studentId: studentId ?? 'anonymous',
      courseId: courseId ?? 'unknown',
      sessionId: sessionId ?? 'unknown',
      input,
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
    onSuccess: async (_session, _input, scope) => {
      await queryClient.invalidateQueries({
        queryKey: studentSessionKeys.sessionLists(scope),
      })
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
      queryClient.setQueriesData<ChatSessionListResponse>(
        {
          queryKey: studentSessionKeys.sessionLists(scope),
        },
        (cached) =>
          cached
            ? {
                ...cached,
                sessions: cached.sessions.map((session) =>
                  session.id === renamedSession.id ? renamedSession : session,
                ),
              }
            : cached,
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
      queryClient.setQueriesData<ChatSessionListResponse>(
        {
          queryKey: studentSessionKeys.sessionLists(scope),
        },
        (cached) =>
          cached
            ? {
                ...cached,
                sessions: cached.sessions.filter(
                  (session) => session.id !== sessionId,
                ),
              }
            : cached,
      )
      queryClient.removeQueries({
        queryKey: studentSessionKeys.messages({ ...scope, sessionId }),
      })
    },
  })
}
