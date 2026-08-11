import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'

import { useAuthStore } from '@/features/auth/session/session.store'
import {
  retryChatMessage,
  sendChatMessage,
} from '@/features/chat/sessions/chat-sessions.api'
import { chatSessionKeys } from '@/features/chat/sessions/chat-sessions.queries'
import {
  appendOptimisticStudentMessage,
  highestCachedSequence,
  markAssistantPending,
  replaceOptimisticTurn,
  replacePersistedTurn,
} from '@/features/chat/messages/chat-message-history'
import type { MessageHistoryData } from '@/features/chat/messages/chat-message-history'
import type { ChatSessionSelection } from '@/features/chat/sessions/chat-scope'
import type {
  ChatMessage,
  SendChatMessageInput,
} from '@/features/chat/messages/chat-message.schema'

interface RequiredChatScope {
  studentId: string
  courseId: string
  sessionId: string
}

interface ChatMutationContext {
  previousMessages: MessageHistoryData | undefined
  queryKey: ReturnType<typeof chatSessionKeys.messageList>
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
  const queryKey = chatSessionKeys.messageList(scope)
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
    queryKey: chatSessionKeys.sessionLists(context.scope),
  })
}

export function useSendChatMessage({
  courseId,
  sessionId,
}: ChatSessionSelection) {
  const studentId = useStudentId()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: SendChatMessageInput) => {
      const scope = requireChatScope(studentId, courseId, sessionId)
      return sendChatMessage({
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
            attemptId: null,
            topicId: null,
            responseToMessageId: null,
            content: input.content.trim(),
            status: 'PENDING',
            requestKind: null,
            guidanceLabel: null,
            hintLevel: null,
            promptVersion: null,
            errorCode: null,
            createdAt: now,
            completedAt: null,
            citations: [],
            reviewSummary: null,
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

export function useRetryChatMessage({
  courseId,
  sessionId,
}: ChatSessionSelection) {
  const studentId = useStudentId()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (studentMessageId: string) => {
      const scope = requireChatScope(studentId, courseId, sessionId)
      return retryChatMessage({
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
