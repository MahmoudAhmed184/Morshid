import { Injectable } from '@nestjs/common'

import { MessageRole } from '../../generated/prisma/client'
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

    if (
      !usesExistingTopicContext(input.acceptedAnalysis.result.topicRelation)
    ) {
      return request(currentMessage, [])
    }

    const projection = new QueryProjection()
    projection.add('Instructional topic', usefulTopicTitle(input))
    projection.add('Maintained topic context', input.topicState?.summary)

    for (const misconception of input.acceptedAnalysis.result.misconceptions.slice(
      0,
      MAX_MISCONCEPTION_DESCRIPTIONS,
    )) {
      projection.add('Relevant misconception', misconception.description)
    }

    const selectedById = new Map(
      input.selectedHistory.map((message) => [message.id, message]),
    )
    const referencedIds = relevantAnalysisMessageIds(input)
    for (const id of referencedIds.slice(0, MAX_REFERENCED_HISTORY_MESSAGES)) {
      const message = selectedById.get(id)
      if (message !== undefined) {
        projection.add(labelForMessage(message), message.content, message.id)
      }
    }

    projection.addReference(
      'Previous student attempt',
      input.previousStudentAttempt,
    )
    projection.addReference(
      'Previous tutor question',
      input.previousTutorQuestion,
    )
    projection.addMessage('Latest tutor context', latestTutorMessage(input))
    return contextualRequest(
      projection.toQuery(),
      currentMessage,
      projection.contextMessageIds,
    )
  }
}

function usesExistingTopicContext(
  topicRelation: RetrievalQueryContext['acceptedAnalysis']['result']['topicRelation'],
): boolean {
  return (
    topicRelation !== TOPIC_RESOLUTION_OUTCOME.CREATE_NEW_TOPIC &&
    topicRelation !== TOPIC_RESOLUTION_OUTCOME.UNRESOLVED
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
    ...result.effortEvidence.evidenceMessageIds,
    ...result.learningEvidence.evidenceMessageIds,
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

function request(
  query: string,
  contextMessageIds: readonly string[],
): RetrievalRequest {
  const boundedQuery = normalizeText(query).slice(0, MAX_RETRIEVAL_QUERY_LENGTH)
  if (boundedQuery.length === 0) {
    throw new Error('Retrieval query builder produced an empty query')
  }

  return Object.freeze({
    query: boundedQuery,
    queryVersion: RETRIEVAL_QUERY_VERSION,
    contextMessageIds: Object.freeze([...contextMessageIds]),
  })
}

function contextualRequest(
  contextQuery: string,
  currentMessage: string,
  contextMessageIds: readonly string[],
): RetrievalRequest {
  const normalizedContext = normalizeText(contextQuery)
  if (normalizedContext.length === 0) {
    return request(currentMessage, [])
  }

  const currentSegment = `Current student message: ${currentMessage}`
  if (currentSegment.length >= MAX_RETRIEVAL_QUERY_LENGTH) {
    return request(currentSegment, contextMessageIds)
  }

  const separator = '. '
  const availableContextLength =
    MAX_RETRIEVAL_QUERY_LENGTH - currentSegment.length - separator.length
  return request(
    `${normalizedContext.slice(0, availableContextLength)}${separator}${currentSegment}`,
    contextMessageIds,
  )
}

class QueryProjection {
  private readonly segments: string[] = []
  private readonly normalizedValues = new Set<string>()
  private readonly messageIds: string[] = []

  get contextMessageIds(): readonly string[] {
    return this.messageIds
  }

  add(
    label: string,
    value: string | null | undefined,
    messageId?: string,
  ): void {
    const normalized = normalizeText(value ?? '')
    if (normalized.length === 0 || this.normalizedValues.has(normalized)) {
      return
    }

    this.normalizedValues.add(normalized)
    this.segments.push(`${label}: ${normalized}`)
    if (messageId !== undefined && !this.messageIds.includes(messageId)) {
      this.messageIds.push(messageId)
    }
  }

  addReference(
    label: string,
    reference: AnalysisContextTextReference | null,
  ): void {
    this.add(label, reference?.content, reference?.messageId ?? undefined)
  }

  addMessage(label: string, message: AnalysisContextMessage | null): void {
    this.add(label, message?.content, message?.id)
  }

  toQuery(): string {
    return this.segments.join('. ')
  }
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
