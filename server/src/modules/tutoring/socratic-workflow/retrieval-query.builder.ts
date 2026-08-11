import { Injectable } from '@nestjs/common'

import { MessageRole } from '../../../generated/prisma/client'
import type {
  AnalysisContextMessage,
  AnalysisContextPackage,
  AnalysisContextTextReference,
} from './analysis-context.types'
import {
  MAX_RETRIEVAL_QUERY_LENGTH,
  RETRIEVAL_QUERY_VERSION,
  type RetrievalQueryContext,
  type RetrievalRequest,
} from './retrieval-query.types'
import { TOPIC_RESOLUTION_OUTCOME } from './topic.types'

const MAX_REFERENCED_HISTORY_MESSAGES = 3
const MAX_MISCONCEPTION_DESCRIPTIONS = 2
const MIN_CONTEXT_VALUE_LENGTH = 24
const SEGMENT_SEPARATOR = '. '

const QUERY_SEGMENT_PRIORITY = {
  ACTIVE_TOPIC: 10,
  PREVIOUS_TUTOR_QUESTION: 20,
  UNRESOLVED_HISTORY_ANCHOR: 25,
  PREVIOUS_STUDENT_ATTEMPT: 30,
  MISCONCEPTION: 40,
  ANALYSIS_REFERENCED_HISTORY: 50,
  LATEST_TUTOR_CONTEXT: 60,
  TOPIC_SUMMARY: 70,
} as const

const QUERY_SEGMENT_VALUE_BUDGET = {
  ACTIVE_TOPIC: 240,
  PREVIOUS_TUTOR_QUESTION: 520,
  UNRESOLVED_HISTORY_ANCHOR: 420,
  PREVIOUS_STUDENT_ATTEMPT: 420,
  MISCONCEPTION: 360,
  ANALYSIS_REFERENCED_HISTORY: 320,
  LATEST_TUTOR_CONTEXT: 280,
  TOPIC_SUMMARY: 240,
} as const

interface ContextSegmentCandidate {
  readonly label: string
  readonly value: string
  readonly messageId?: string
  readonly priority: number
  readonly maximumValueLength: number
  readonly ordinal: number
}

/**
 * Produces a stable, compact evidence-search subject from the authoritative
 * context already selected for Educational Analysis. It does not resolve
 * history, choose teaching policy, or own course scope.
 */
@Injectable()
export class RetrievalQueryBuilder {
  build(input: RetrievalQueryContext): RetrievalRequest {
    const currentMessage = normalizeText(input.currentMessage.content)
    if (currentMessage.length === 0) {
      throw new Error('Retrieval query requires a non-empty student message')
    }

    if (!shouldUseExistingTopicContext(input)) {
      return currentOnlyRequest(currentMessage)
    }

    const projection = new PriorityAwareQueryProjection(currentMessage)
    projection.add(
      'Instructional topic',
      usefulTopicTitle(input),
      QUERY_SEGMENT_PRIORITY.ACTIVE_TOPIC,
      QUERY_SEGMENT_VALUE_BUDGET.ACTIVE_TOPIC,
    )
    projection.addReference(
      'Previous tutor question',
      input.previousTutorQuestion,
      QUERY_SEGMENT_PRIORITY.PREVIOUS_TUTOR_QUESTION,
      QUERY_SEGMENT_VALUE_BUDGET.PREVIOUS_TUTOR_QUESTION,
    )
    projection.addMessage(
      'Selected same-topic anchor',
      unresolvedHistoryAnchor(input),
      QUERY_SEGMENT_PRIORITY.UNRESOLVED_HISTORY_ANCHOR,
      QUERY_SEGMENT_VALUE_BUDGET.UNRESOLVED_HISTORY_ANCHOR,
    )
    projection.addReference(
      'Previous student attempt',
      input.previousStudentAttempt,
      QUERY_SEGMENT_PRIORITY.PREVIOUS_STUDENT_ATTEMPT,
      QUERY_SEGMENT_VALUE_BUDGET.PREVIOUS_STUDENT_ATTEMPT,
    )

    for (const misconception of input.acceptedAnalysis.result.misconceptions.slice(
      0,
      MAX_MISCONCEPTION_DESCRIPTIONS,
    )) {
      projection.add(
        'Relevant misconception',
        misconception.description,
        QUERY_SEGMENT_PRIORITY.MISCONCEPTION,
        QUERY_SEGMENT_VALUE_BUDGET.MISCONCEPTION,
      )
    }

    const selectedById = new Map(
      input.selectedHistory.map((message) => [message.id, message]),
    )
    const referencedIds = relevantAnalysisMessageIds(input)
    for (const id of referencedIds.slice(0, MAX_REFERENCED_HISTORY_MESSAGES)) {
      const message = selectedById.get(id)
      if (message !== undefined) {
        projection.add(
          labelForMessage(message),
          message.content,
          QUERY_SEGMENT_PRIORITY.ANALYSIS_REFERENCED_HISTORY,
          QUERY_SEGMENT_VALUE_BUDGET.ANALYSIS_REFERENCED_HISTORY,
          message.id,
        )
      }
    }

    projection.addMessage(
      'Latest tutor context',
      latestTutorMessage(input),
      QUERY_SEGMENT_PRIORITY.LATEST_TUTOR_CONTEXT,
      QUERY_SEGMENT_VALUE_BUDGET.LATEST_TUTOR_CONTEXT,
    )
    projection.add(
      'Maintained topic context',
      input.topicState?.summary,
      QUERY_SEGMENT_PRIORITY.TOPIC_SUMMARY,
      QUERY_SEGMENT_VALUE_BUDGET.TOPIC_SUMMARY,
    )
    return projection.build()
  }
}

function shouldUseExistingTopicContext(input: RetrievalQueryContext): boolean {
  const topicRelation = input.acceptedAnalysis.result.topicRelation
  if (topicRelation === TOPIC_RESOLUTION_OUTCOME.CREATE_NEW_TOPIC) {
    return false
  }

  if (topicRelation !== TOPIC_RESOLUTION_OUTCOME.UNRESOLVED) {
    return true
  }

  return hasTrustworthySameTopicAnchor(input)
}

function hasTrustworthySameTopicAnchor(input: RetrievalQueryContext): boolean {
  return (
    hasText(input.previousTutorQuestion?.content) ||
    hasText(input.previousStudentAttempt?.content) ||
    input.selectedHistory.some((message) => hasText(message.content))
  )
}

function unresolvedHistoryAnchor(
  input: RetrievalQueryContext,
): AnalysisContextMessage | null {
  if (
    input.acceptedAnalysis.result.topicRelation !==
      TOPIC_RESOLUTION_OUTCOME.UNRESOLVED ||
    input.previousTutorQuestion !== null ||
    input.previousStudentAttempt !== null
  ) {
    return null
  }

  return (
    [...input.selectedHistory]
      .reverse()
      .find((message) => hasText(message.content)) ?? null
  )
}

function usefulTopicTitle(input: RetrievalQueryContext): string | null {
  const title = normalizeText(input.activeTopic.title)
  return title === 'General tutoring topic' ? null : title
}

function relevantAnalysisMessageIds(input: RetrievalQueryContext): string[] {
  const result = input.acceptedAnalysis.result
  const ids = [
    ...result.evidenceReferences,
    ...(result.effortEvidence.present
      ? result.effortEvidence.evidenceMessageIds
      : []),
    ...(result.learningEvidence.present
      ? result.learningEvidence.evidenceMessageIds
      : []),
    ...result.misconceptions.map(
      (misconception) => misconception.evidenceMessageId,
    ),
  ]

  return unique(ids).filter((id) => id !== input.currentMessage.id)
}

function latestTutorMessage(
  input: RetrievalQueryContext,
): AnalysisContextMessage | null {
  return (
    [...input.selectedHistory]
      .reverse()
      .find((message) => message.role === MessageRole.ASSISTANT) ?? null
  )
}

function labelForMessage(message: AnalysisContextMessage): string {
  return message.role === MessageRole.ASSISTANT
    ? 'Referenced tutor context'
    : 'Referenced student reasoning'
}

function currentOnlyRequest(currentMessage: string): RetrievalRequest {
  return createRequest(
    truncateText(currentMessage, MAX_RETRIEVAL_QUERY_LENGTH),
    [],
  )
}

function createRequest(
  query: string,
  contextMessageIds: readonly string[],
): RetrievalRequest {
  const normalizedQuery = normalizeText(query)
  if (normalizedQuery.length === 0) {
    throw new Error('Retrieval query builder produced an empty query')
  }
  if (normalizedQuery.length > MAX_RETRIEVAL_QUERY_LENGTH) {
    throw new Error('Retrieval query builder exceeded its length limit')
  }

  return Object.freeze({
    query: normalizedQuery,
    queryVersion: RETRIEVAL_QUERY_VERSION,
    contextMessageIds: Object.freeze([...contextMessageIds]),
  })
}

class PriorityAwareQueryProjection {
  private readonly candidates: ContextSegmentCandidate[] = []
  private nextOrdinal = 0

  constructor(private readonly currentMessage: string) {}

  add(
    label: string,
    value: string | null | undefined,
    priority: number,
    maximumValueLength: number,
    messageId?: string,
  ): void {
    const normalizedValue = normalizeText(value ?? '')
    if (normalizedValue.length === 0) {
      return
    }

    this.candidates.push({
      label,
      value: normalizedValue,
      priority,
      maximumValueLength,
      ordinal: this.nextOrdinal,
      ...(messageId === undefined ? {} : { messageId }),
    })
    this.nextOrdinal += 1
  }

  addReference(
    label: string,
    reference: AnalysisContextTextReference | null,
    priority: number,
    maximumValueLength: number,
  ): void {
    this.add(
      label,
      reference?.content,
      priority,
      maximumValueLength,
      reference?.messageId ?? undefined,
    )
  }

  addMessage(
    label: string,
    message: AnalysisContextMessage | null,
    priority: number,
    maximumValueLength: number,
  ): void {
    this.add(label, message?.content, priority, maximumValueLength, message?.id)
  }

  build(): RetrievalRequest {
    const currentSegment = requiredCurrentSegment(this.currentMessage)
    const contextSegments: string[] = []
    const contextMessageIds: string[] = []
    const usedValues = new Set<string>()
    let remainingLength =
      MAX_RETRIEVAL_QUERY_LENGTH -
      currentSegment.length -
      SEGMENT_SEPARATOR.length

    for (const candidate of this.prioritizedCandidates()) {
      if (usedValues.has(candidate.value)) {
        continue
      }

      const precedingSeparatorLength =
        contextSegments.length === 0 ? 0 : SEGMENT_SEPARATOR.length
      const availableSegmentLength = remainingLength - precedingSeparatorLength
      const segment = boundedContextSegment(candidate, availableSegmentLength)
      if (segment === null) {
        continue
      }

      contextSegments.push(segment)
      usedValues.add(candidate.value)
      remainingLength -= segment.length + precedingSeparatorLength
      if (
        candidate.messageId !== undefined &&
        !contextMessageIds.includes(candidate.messageId)
      ) {
        contextMessageIds.push(candidate.messageId)
      }
    }

    if (contextSegments.length === 0) {
      return createRequest(currentSegment, [])
    }

    return createRequest(
      `${contextSegments.join(SEGMENT_SEPARATOR)}${SEGMENT_SEPARATOR}${currentSegment}`,
      contextMessageIds,
    )
  }

  private prioritizedCandidates(): ContextSegmentCandidate[] {
    return [...this.candidates].sort(
      (first, second) =>
        first.priority - second.priority || first.ordinal - second.ordinal,
    )
  }
}

function requiredCurrentSegment(currentMessage: string): string {
  const label = 'Current student message'
  const prefix = `${label}: `
  return `${prefix}${truncateText(
    currentMessage,
    MAX_RETRIEVAL_QUERY_LENGTH - prefix.length,
  )}`
}

function boundedContextSegment(
  candidate: ContextSegmentCandidate,
  availableLength: number,
): string | null {
  const prefix = `${candidate.label}: `
  const maximumSegmentLength = Math.min(
    availableLength,
    prefix.length + candidate.maximumValueLength,
  )
  const availableValueLength = maximumSegmentLength - prefix.length
  if (availableValueLength < MIN_CONTEXT_VALUE_LENGTH) {
    return null
  }

  return `${prefix}${truncateText(candidate.value, availableValueLength)}`
}

function truncateText(value: string, maximumLength: number): string {
  if (value.length <= maximumLength) {
    return value
  }
  if (maximumLength <= 1) {
    return value.slice(0, Math.max(0, maximumLength))
  }

  return `${value.slice(0, maximumLength - 1)}…`
}

function hasText(value: string | null | undefined): boolean {
  return value !== undefined && value !== null && normalizeText(value) !== ''
}

function normalizeText(value: string): string {
  return Array.from(value, (character) => {
    const codePoint = character.codePointAt(0) ?? 0
    return codePoint <= 31 || codePoint === 127 ? ' ' : character
  })
    .join('')
    .trim()
    .replace(/\s+/gu, ' ')
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)]
}

export function retrievalQueryContextFromAnalysis(
  context: AnalysisContextPackage,
  acceptedAnalysis: RetrievalQueryContext['acceptedAnalysis'],
): RetrievalQueryContext {
  return {
    currentMessage: context.studentMessage,
    activeTopic: context.activeTopic,
    topicState: context.topicState,
    previousTutorQuestion: context.previousTutorQuestion,
    previousStudentAttempt: context.previousStudentAttempt,
    selectedHistory: context.selectedHistory,
    acceptedAnalysis,
  }
}
