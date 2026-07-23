import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'

import { useAuthStore } from '@/features/auth/stores/auth.store'
import {
  retryStudentChatMessage,
  sendStudentChatMessage,
} from '@/features/student/data/student-sessions.api'
import { studentSessionKeys } from '@/features/student/data/student-sessions.queries'
import {
  appendOptimisticStudentMessage,
  highestCachedSequence,
  markAssistantPending,
  replaceOptimisticTurn,
  replacePersistedTurn,
} from '@/features/student/hooks/student-chat-history'
import type { MessageHistoryData } from '@/features/student/hooks/student-chat-history'
import type { StudentSessionSelection } from '@/features/student/hooks/student-session.types'
import type {
  ChatMessage,
  SendStudentChatMessageInput,
} from '@/features/student/schemas/student-chat.schema'

interface RequiredChatScope {
  studentId: string
  courseId: string
  sessionId: string
}

interface ChatMutationContext {
  previousMessages: MessageHistoryData | undefined
  queryKey: ReturnType<typeof studentSessionKeys.messageList>
  scope: RequiredChatScope
}

function useStudentId() {
  return useAuthStore((state) => state.user?.id)
}

function requireChatScope(
  studentId: string | undefined,
  courseId: string | undefined,
  sessionId: string | undefined,
): RequiredChatScope {
  if (!studentId || !courseId) {
    throw new Error('Choose an assigned course first.')
  }
  if (!sessionId) {
    throw new Error('Choose a conversation first.')
  }

  return { studentId, courseId, sessionId }
}

async function beginChatMutation(
  queryClient: QueryClient,
  scope: RequiredChatScope,
  updateHistory: (
    previousMessages: MessageHistoryData | undefined,
  ) => MessageHistoryData,
): Promise<ChatMutationContext> {
  const queryKey = studentSessionKeys.messageList(scope)
  await queryClient.cancelQueries({ queryKey })
  const previousMessages =
    queryClient.getQueryData<MessageHistoryData>(queryKey)
  queryClient.setQueryData(queryKey, updateHistory(previousMessages))

  return { previousMessages, queryKey, scope }
}

function rollbackChatMutation(
  queryClient: QueryClient,
  context: ChatMutationContext | undefined,
) {
  if (context) {
    queryClient.setQueryData(context.queryKey, context.previousMessages)
  }
}

function invalidateChatMutation(
  queryClient: QueryClient,
  context: ChatMutationContext | undefined,
  invalidateHistory: boolean,
) {
  if (!context) {
    return
  }
  if (invalidateHistory) {
    void queryClient.invalidateQueries({ queryKey: context.queryKey })
  }
  void queryClient.invalidateQueries({
    queryKey: studentSessionKeys.sessionLists(context.scope),
  })
}

export function useSendStudentChatMessage({
  courseId,
  sessionId,
}: StudentSessionSelection) {
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
      const optimisticMessageId = input.clientMessageId
      const context = await beginChatMutation(
        queryClient,
        scope,
        (previousMessages) => {
          const now = new Date().toISOString()
          const optimisticMessage: ChatMessage = {
            id: optimisticMessageId,
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

          return appendOptimisticStudentMessage(
            previousMessages,
            optimisticMessage,
          )
        },
      )

      return { ...context, optimisticMessageId }
    },
    onError: (_error, _input, context) => {
      rollbackChatMutation(queryClient, context)
    },
    onSuccess: (turn, _input, context) => {
      queryClient.setQueryData<MessageHistoryData>(context.queryKey, (cached) =>
        replaceOptimisticTurn(cached, context.optimisticMessageId, turn),
      )
    },
    onSettled: (_turn, error, _input, context) => {
      invalidateChatMutation(queryClient, context, Boolean(error))
    },
  })
}

export function useRetryStudentChatMessage({
  courseId,
  sessionId,
}: StudentSessionSelection) {
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
    onMutate: (studentMessageId) => {
      const scope = requireChatScope(studentId, courseId, sessionId)
      return beginChatMutation(queryClient, scope, (previousMessages) =>
        markAssistantPending(previousMessages, studentMessageId),
      )
    },
    onError: (_error, _studentMessageId, context) => {
      rollbackChatMutation(queryClient, context)
    },
    onSuccess: (turn, _studentMessageId, context) => {
      queryClient.setQueryData<MessageHistoryData>(context.queryKey, (cached) =>
        replacePersistedTurn(cached, turn),
      )
    },
    onSettled: (_turn, _error, _studentMessageId, context) => {
      invalidateChatMutation(queryClient, context, true)
    },
  })
}
