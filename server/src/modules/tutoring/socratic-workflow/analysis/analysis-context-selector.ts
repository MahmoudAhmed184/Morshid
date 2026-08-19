import { MessageRole, MessageStatus } from '../../tutoring-values'
import {
  DEFAULT_ANALYSIS_CONTEXT_HISTORY_MESSAGE_LIMIT,
  DEFAULT_ANALYSIS_CONTEXT_HISTORY_TOKEN_BUDGET,
  MAX_ANALYSIS_CONTEXT_HISTORY_MESSAGE_LIMIT,
  MAX_ANALYSIS_CONTEXT_HISTORY_TOKEN_BUDGET,
  type AnalysisContextMessage,
  type AnalysisContextTextReference,
  type AnalysisContextTokenBudget,
  type PreviousTeachingDecisionContext,
} from './analysis-context.types'
import type { TopicStateSnapshot } from '../topic/topic-state.types'

export interface AnalysisHistorySelection {
  selectedHistory: AnalysisContextMessage[]
  previousTutorQuestion: AnalysisContextTextReference | null
  previousStudentAttempt: AnalysisContextTextReference | null
  tokenBudget: AnalysisContextTokenBudget
}

export function boundedHistoryBudget(input: {
  historyTokenBudget?: number
  historyMessageLimit?: number
}): Pick<
  AnalysisContextTokenBudget,
  'maxHistoryTokens' | 'maxHistoryMessages' | 'tokenizer'
> {
  return {
    maxHistoryTokens: boundedPositiveInteger(
      input.historyTokenBudget,
      DEFAULT_ANALYSIS_CONTEXT_HISTORY_TOKEN_BUDGET,
      MAX_ANALYSIS_CONTEXT_HISTORY_TOKEN_BUDGET,
    ),
    maxHistoryMessages: boundedPositiveInteger(
      input.historyMessageLimit,
      DEFAULT_ANALYSIS_CONTEXT_HISTORY_MESSAGE_LIMIT,
      MAX_ANALYSIS_CONTEXT_HISTORY_MESSAGE_LIMIT,
    ),
    tokenizer: 'char_approximation_v1',
  }
}

export function selectAnalysisHistory(input: {
  activeTopicId: string
  studentMessageId: string
  candidates: readonly AnalysisContextMessage[]
  historyTokenBudget?: number
  historyMessageLimit?: number
}): AnalysisHistorySelection {
  const budget = boundedHistoryBudget(input)
  const eligible = uniqueMessages(input.candidates)
    .filter(
      (message) =>
        message.id !== input.studentMessageId &&
        message.topicId === input.activeTopicId &&
        message.status === MessageStatus.COMPLETED &&
        (message.role === MessageRole.STUDENT ||
          message.role === MessageRole.ASSISTANT),
    )
    .sort((first, second) => first.sequence - second.sequence)

  const previousTutorQuestionMessage = findLatestAssistantQuestion(eligible)
  const previousStudentAttemptMessage = findLatestStudentAttempt(eligible)
  const latestTutorMessage = findLatestTutorMessage(eligible)
  const priorityIds = new Set(
    [
      previousTutorQuestionMessage?.id,
      previousStudentAttemptMessage?.id,
      latestTutorMessage?.id,
    ].filter((id): id is string => id !== undefined),
  )

  const selectedById = new Map<string, AnalysisContextMessage>()
  let approximateHistoryTokens = 0

  for (const message of [
    previousStudentAttemptMessage,
    previousTutorQuestionMessage,
    latestTutorMessage,
  ]) {
    if (message === null || !priorityIds.has(message.id)) {
      continue
    }

    const tokens = approximateAnalysisTokens(message.content)
    if (
      selectedById.size < budget.maxHistoryMessages &&
      approximateHistoryTokens + tokens <= budget.maxHistoryTokens
    ) {
      selectedById.set(message.id, message)
      approximateHistoryTokens += tokens
    }
  }

  for (const message of [...eligible].reverse()) {
    if (selectedById.has(message.id)) {
      continue
    }

    const tokens = approximateAnalysisTokens(message.content)
    if (
      selectedById.size >= budget.maxHistoryMessages ||
      approximateHistoryTokens + tokens > budget.maxHistoryTokens
    ) {
      continue
    }

    selectedById.set(message.id, message)
    approximateHistoryTokens += tokens
  }

  const selectedHistory = Array.from(selectedById.values()).sort(
    (first, second) => first.sequence - second.sequence,
  )

  return {
    selectedHistory,
    previousTutorQuestion: textReferenceForMessage(
      previousTutorQuestionMessage,
      selectedById,
    ),
    previousStudentAttempt: textReferenceForMessage(
      previousStudentAttemptMessage,
      selectedById,
    ),
    tokenBudget: {
      ...budget,
      approximateHistoryTokens,
    },
  }
}

export function textReferencesFromTopicState(input: {
  topicState: TopicStateSnapshot | null
  previousTutorQuestion: AnalysisContextTextReference | null
  previousStudentAttempt: AnalysisContextTextReference | null
}): {
  previousTutorQuestion: AnalysisContextTextReference | null
  previousStudentAttempt: AnalysisContextTextReference | null
} {
  return {
    previousTutorQuestion:
      input.previousTutorQuestion ??
      textReferenceFromTopicState(input.topicState?.lastTutorQuestion ?? null),
    previousStudentAttempt:
      input.previousStudentAttempt ??
      textReferenceFromTopicState(input.topicState?.lastStudentAction ?? null),
  }
}

export function previousTeachingDecisionFromTopicState(
  topicState: TopicStateSnapshot | null,
): PreviousTeachingDecisionContext | null {
  if (
    topicState === null ||
    (topicState.activeStrategy === null &&
      topicState.primaryTechnique === null &&
      topicState.supportingTechnique === null)
  ) {
    return null
  }

  return {
    source: 'topic_state',
    activeStrategy: topicState.activeStrategy,
    primaryTechnique: topicState.primaryTechnique,
    supportingTechnique: topicState.supportingTechnique,
    guidanceLevel: topicState.guidanceLevel,
    revealPolicy: topicState.revealPolicy,
    updatedAt: topicState.updatedAt,
  }
}

export function approximateAnalysisTokens(content: string): number {
  const normalizedLength = content.trim().replace(/\s+/g, ' ').length
  return Math.max(1, Math.ceil(normalizedLength / 4))
}

function boundedPositiveInteger(
  value: number | undefined,
  defaultValue: number,
  maxValue: number,
): number {
  if (value === undefined || !Number.isInteger(value) || value < 1) {
    return defaultValue
  }

  return Math.min(value, maxValue)
}

function uniqueMessages(
  messages: readonly AnalysisContextMessage[],
): AnalysisContextMessage[] {
  const byId = new Map<string, AnalysisContextMessage>()

  for (const message of messages) {
    if (!byId.has(message.id)) {
      byId.set(message.id, message)
    }
  }

  return Array.from(byId.values())
}

function findLatestAssistantQuestion(
  messages: readonly AnalysisContextMessage[],
): AnalysisContextMessage | null {
  return (
    [...messages]
      .reverse()
      .find(
        (message) =>
          message.role === MessageRole.ASSISTANT &&
          isLikelyQuestion(message.content),
      ) ?? null
  )
}

function findLatestStudentAttempt(
  messages: readonly AnalysisContextMessage[],
): AnalysisContextMessage | null {
  return (
    [...messages]
      .reverse()
      .find(
        (message) =>
          message.role === MessageRole.STUDENT && message.content.trim() !== '',
      ) ?? null
  )
}

function findLatestTutorMessage(
  messages: readonly AnalysisContextMessage[],
): AnalysisContextMessage | null {
  return (
    [...messages]
      .reverse()
      .find((message) => message.role === MessageRole.ASSISTANT) ?? null
  )
}

function isLikelyQuestion(content: string): boolean {
  const trimmed = content.trim()
  if (/[؟?][^\w\s\u0600-\u06FF]*$/u.test(trimmed)) {
    return true
  }
  const trailingChunk = trimmed.slice(-150)
  return /[؟?]/.test(trailingChunk)
}

function textReferenceForMessage(
  message: AnalysisContextMessage | null,
  selectedById: ReadonlyMap<string, AnalysisContextMessage>,
): AnalysisContextTextReference | null {
  if (message === null || !selectedById.has(message.id)) {
    return null
  }

  return {
    source: 'selected_history',
    content: message.content,
    messageId: message.id,
    sequence: message.sequence,
  }
}

function textReferenceFromTopicState(
  content: string | null,
): AnalysisContextTextReference | null {
  if (content === null || content.trim() === '') {
    return null
  }

  return {
    source: 'topic_state',
    content,
    messageId: null,
    sequence: null,
  }
}
