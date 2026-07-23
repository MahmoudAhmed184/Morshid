import type { InfiniteData } from '@tanstack/react-query'

import type {
  ChatMessage,
  ChatMessageHistoryResponse,
  GroundedChatTurnResponse,
} from '@/features/student/schemas/student-chat.schema'

export type MessageHistoryData = InfiniteData<
  ChatMessageHistoryResponse,
  number | undefined
>

export function appendOptimisticStudentMessage(
  cached: MessageHistoryData | undefined,
  message: ChatMessage,
): MessageHistoryData {
  const history = cached ?? emptyMessageHistory()
  return {
    ...history,
    pages: history.pages.map((page, index) =>
      index === 0
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

export function replaceOptimisticTurn(
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
  return {
    ...history,
    pages: history.pages.map((page, index) => {
      const messages = page.messages.filter(({ id }) => !replacementIds.has(id))

      return index === 0
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

export function replacePersistedTurn(
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

export function markAssistantPending(
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

export function highestCachedSequence(cached: MessageHistoryData | undefined) {
  let highestSequence = 0

  for (const page of cached?.pages ?? []) {
    for (const message of page.messages) {
      highestSequence = Math.max(highestSequence, message.sequence)
    }
  }

  return highestSequence
}

export function hasPendingAssistant(cached: MessageHistoryData | undefined) {
  return (cached?.pages ?? []).some((page) =>
    page.messages.some(
      (message) =>
        message.role === 'ASSISTANT' &&
        (message.status === 'PENDING' || message.status === 'STREAMING'),
    ),
  )
}

function emptyMessageHistory(): MessageHistoryData {
  return {
    pages: [{ messages: [], nextCursor: null }],
    pageParams: [undefined],
  }
}
