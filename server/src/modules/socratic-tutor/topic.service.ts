import { Injectable } from '@nestjs/common'

import { TopicStatus, TopicType } from '../../generated/prisma/client'
import {
  ambiguousActiveTopicException,
  invalidTopicLifecycleTransitionException,
  invalidTopicRequestException,
  topicCourseScopeMismatchException,
  topicNotFoundException,
  topicResolutionEvidenceRequiredException,
  topicSessionNotFoundException,
} from './topic.errors'
import { TopicRepository } from './topic.repository'
import {
  SUFFICIENT_TOPIC_RESOLUTION_EVIDENCE_TYPES,
  TOPIC_RESOLUTION_OUTCOME,
  TOPIC_STABLE_IDENTITY_SOURCE,
  type CreateTopicInput,
  type ResolveAsResolvedInput,
  type ResolveTopicInput,
  type TopicByIdInput,
  type TopicRecord,
  type TopicResolution,
  type TopicResolutionEvidenceInput,
  type TopicScope,
  type TopicStableIdentitySource,
} from './topic.types'

const DEFAULT_TOPIC_TITLE = 'General tutoring topic'
const MAX_TITLE_LENGTH = 160
const MAX_REASON_LENGTH = 240

@Injectable()
export class TopicService {
  constructor(private readonly topicRepository: TopicRepository) {}

  async resolveTopic(input: ResolveTopicInput): Promise<TopicResolution> {
    const sessionId = normalizeRequiredIdentifier(input.sessionId, 'sessionId')
    const problemId = normalizeOptionalIdentifier(input.problemId)
    const conceptId = normalizeOptionalIdentifier(input.conceptId)
    const scope = await this.resolveAuthoritativeScope({
      sessionId,
      callerCourseId: normalizeOptionalIdentifier(input.courseId),
    })

    if (problemId !== null) {
      return this.resolveByStableIdentity({
        scope,
        stableIdentitySource: TOPIC_STABLE_IDENTITY_SOURCE.PROBLEM_ID,
        title: boundedTopicTitle(input.title, 'Problem tutoring topic'),
        findMatches: () =>
          this.topicRepository.findTopicsByProblemId(scope, problemId),
        createRelatedTopic: () =>
          this.createTopicInScope(scope, {
            problemId,
            conceptId,
            title: boundedTopicTitle(input.title, 'Problem tutoring topic'),
            topicType: TopicType.PROBLEM,
          }),
      })
    }

    if (conceptId !== null) {
      return this.resolveByStableIdentity({
        scope,
        stableIdentitySource: TOPIC_STABLE_IDENTITY_SOURCE.CONCEPT_ID,
        title: boundedTopicTitle(input.title, 'Concept tutoring topic'),
        findMatches: () =>
          this.topicRepository.findTopicsByConceptId(scope, conceptId),
        createRelatedTopic: () =>
          this.createTopicInScope(scope, {
            conceptId,
            title: boundedTopicTitle(input.title, 'Concept tutoring topic'),
            topicType: TopicType.CONCEPT,
          }),
      })
    }

    const activeTopics = await this.topicRepository.findActiveTopics(scope)

    if (activeTopics.length === 1) {
      return topicResolution({
        outcome: TOPIC_RESOLUTION_OUTCOME.CONTINUE_CURRENT_TOPIC,
        topicId: activeTopics[0].id,
        previousTopicId: null,
        confidence: 0.72,
        stableIdentitySource: TOPIC_STABLE_IDENTITY_SOURCE.ACTIVE_TOPIC,
        reason: 'continued the only active topic for the session',
      })
    }

    if (activeTopics.length > 1) {
      return unresolvedTopicResolution(
        TOPIC_STABLE_IDENTITY_SOURCE.NONE,
        'multiple active topics require explicit resolution',
      )
    }

    return this.createTopicInScope(scope, {
      title: DEFAULT_TOPIC_TITLE,
      topicType: TopicType.UNCLASSIFIED,
    }).then((resolution) => ({
      ...resolution,
      stableIdentitySource: TOPIC_STABLE_IDENTITY_SOURCE.DETERMINISTIC_FALLBACK,
      reason: 'created deterministic fallback topic',
    }))
  }

  async createTopic(input: CreateTopicInput): Promise<TopicResolution> {
    const sessionId = normalizeRequiredIdentifier(input.sessionId, 'sessionId')
    const scope = await this.resolveAuthoritativeScope({
      sessionId,
      callerCourseId: normalizeOptionalIdentifier(input.courseId),
    })
    const title = boundedTopicTitle(input.title)
    const problemId = normalizeOptionalIdentifier(input.problemId)
    const conceptId = normalizeOptionalIdentifier(input.conceptId)
    return this.createTopicInScope(scope, {
      title,
      problemId,
      conceptId,
      topicType: input.topicType,
    })
  }

  async pauseTopic(input: TopicByIdInput): Promise<TopicRecord> {
    const { scope, topic } = await this.loadScopedTopic(input)

    if (topic.status === TopicStatus.PAUSED) {
      return topic
    }

    if (topic.status !== TopicStatus.ACTIVE) {
      throw invalidTopicLifecycleTransitionException()
    }

    const paused = await this.topicRepository.pauseTopic(scope, topic.id)

    if (paused === null) {
      throw invalidTopicLifecycleTransitionException()
    }

    return paused
  }

  async resumeTopic(input: TopicByIdInput): Promise<TopicResolution> {
    const { scope, topic } = await this.loadScopedTopic(input)

    if (topic.status === TopicStatus.ACTIVE) {
      await this.assertOnlyActiveTopicIs(scope, topic.id)

      return topicResolution({
        outcome: TOPIC_RESOLUTION_OUTCOME.CONTINUE_CURRENT_TOPIC,
        topicId: topic.id,
        previousTopicId: null,
        confidence: 1,
        stableIdentitySource: TOPIC_STABLE_IDENTITY_SOURCE.ACTIVE_TOPIC,
        reason: 'topic is already the active focus',
      })
    }

    if (topic.status !== TopicStatus.PAUSED) {
      throw invalidTopicLifecycleTransitionException()
    }

    const result = await this.topicRepository.activateTopic({
      sessionId: scope.sessionId,
      courseId: scope.courseId,
      topicId: topic.id,
      expectedStatus: TopicStatus.PAUSED,
      clearResolvedAt: false,
    })

    if (result === null) {
      throw invalidTopicLifecycleTransitionException()
    }

    return topicResolution({
      outcome: TOPIC_RESOLUTION_OUTCOME.RESUME_PREVIOUS_TOPIC,
      topicId: result.topic.id,
      previousTopicId: result.previousTopicId,
      confidence: 0.95,
      stableIdentitySource: identitySourceForTopic(result.topic),
      reason: 'resumed paused topic',
    })
  }

  async reopenTopic(input: TopicByIdInput): Promise<TopicResolution> {
    const { scope, topic } = await this.loadScopedTopic(input)

    if (topic.status === TopicStatus.ACTIVE) {
      await this.assertOnlyActiveTopicIs(scope, topic.id)

      return topicResolution({
        outcome: TOPIC_RESOLUTION_OUTCOME.CONTINUE_CURRENT_TOPIC,
        topicId: topic.id,
        previousTopicId: null,
        confidence: 1,
        stableIdentitySource: TOPIC_STABLE_IDENTITY_SOURCE.ACTIVE_TOPIC,
        reason: 'topic is already the active focus',
      })
    }

    if (topic.status !== TopicStatus.RESOLVED) {
      throw invalidTopicLifecycleTransitionException()
    }

    const result = await this.topicRepository.activateTopic({
      sessionId: scope.sessionId,
      courseId: scope.courseId,
      topicId: topic.id,
      expectedStatus: TopicStatus.RESOLVED,
      clearResolvedAt: true,
    })

    if (result === null) {
      throw invalidTopicLifecycleTransitionException()
    }

    return topicResolution({
      outcome: TOPIC_RESOLUTION_OUTCOME.REOPEN_EXISTING_TOPIC,
      topicId: result.topic.id,
      previousTopicId: result.previousTopicId,
      confidence: 0.95,
      stableIdentitySource: identitySourceForTopic(result.topic),
      reason: 'reopened resolved topic',
    })
  }

  async resolveAsResolved(input: ResolveAsResolvedInput): Promise<TopicRecord> {
    const { scope, topic } = await this.loadScopedTopic(input)

    if (topic.status === TopicStatus.RESOLVED) {
      await this.validateResolutionEvidence(scope, input.evidence)
      return topic
    }

    if (topic.status !== TopicStatus.ACTIVE) {
      throw invalidTopicLifecycleTransitionException()
    }

    await this.validateResolutionEvidence(scope, input.evidence)

    const resolved = await this.topicRepository.resolveTopic(
      scope,
      topic.id,
      new Date(),
    )

    if (resolved === null) {
      throw invalidTopicLifecycleTransitionException()
    }

    return resolved
  }

  private async resolveByStableIdentity(input: {
    scope: TopicScope
    stableIdentitySource: TopicStableIdentitySource
    title: string
    findMatches: () => Promise<TopicRecord[]>
    createRelatedTopic: () => Promise<TopicResolution>
  }): Promise<TopicResolution> {
    void input.title
    const matches = await input.findMatches()
    const selectableMatches = matches.filter(
      (topic) => topic.status !== TopicStatus.ABANDONED,
    )

    if (selectableMatches.length > 1) {
      return unresolvedTopicResolution(
        input.stableIdentitySource,
        'multiple matching topics require explicit resolution',
      )
    }

    if (selectableMatches.length === 0) {
      return input.createRelatedTopic()
    }

    const selected = selectableMatches[0]

    if (selected.status === TopicStatus.ACTIVE) {
      return topicResolution({
        outcome: TOPIC_RESOLUTION_OUTCOME.CONTINUE_CURRENT_TOPIC,
        topicId: selected.id,
        previousTopicId: null,
        confidence: 1,
        stableIdentitySource: input.stableIdentitySource,
        reason: 'continued topic matched by stable identity',
      })
    }

    if (selected.status === TopicStatus.PAUSED) {
      return this.resumeTopic({
        sessionId: input.scope.sessionId,
        courseId: input.scope.courseId,
        topicId: selected.id,
      }).then((resolution) => ({
        ...resolution,
        stableIdentitySource: input.stableIdentitySource,
        reason: 'resumed topic matched by stable identity',
      }))
    }

    if (selected.status === TopicStatus.RESOLVED) {
      return this.reopenTopic({
        sessionId: input.scope.sessionId,
        courseId: input.scope.courseId,
        topicId: selected.id,
      }).then((resolution) => ({
        ...resolution,
        stableIdentitySource: input.stableIdentitySource,
        reason: 'reopened topic matched by stable identity',
      }))
    }

    return unresolvedTopicResolution(
      input.stableIdentitySource,
      'matching topic cannot be safely selected',
    )
  }

  private async createTopicInScope(
    scope: TopicScope,
    input: {
      title: string
      problemId?: string | null
      conceptId?: string | null
      topicType?: TopicType
    },
  ): Promise<TopicResolution> {
    const result = await this.topicRepository.createActiveTopic({
      sessionId: scope.sessionId,
      courseId: scope.courseId,
      title: input.title,
      problemId: input.problemId ?? null,
      conceptId: input.conceptId ?? null,
      topicType: input.topicType ?? TopicType.UNCLASSIFIED,
    })

    if (result === null) {
      throw ambiguousActiveTopicException()
    }

    return topicResolution({
      outcome: TOPIC_RESOLUTION_OUTCOME.CREATE_NEW_TOPIC,
      topicId: result.topic.id,
      previousTopicId: result.previousTopicId,
      confidence: 0.9,
      stableIdentitySource: identitySourceForTopic(result.topic),
      reason: 'created active topic focus',
    })
  }

  private async loadScopedTopic(input: TopicByIdInput): Promise<{
    scope: TopicScope
    topic: TopicRecord
  }> {
    const sessionId = normalizeRequiredIdentifier(input.sessionId, 'sessionId')
    const topicId = normalizeRequiredIdentifier(input.topicId, 'topicId')
    const scope = await this.resolveAuthoritativeScope({
      sessionId,
      callerCourseId: normalizeOptionalIdentifier(input.courseId),
    })
    const topic = await this.topicRepository.findTopicById(scope, topicId)

    if (topic === null) {
      throw topicNotFoundException()
    }

    return { scope, topic }
  }

  private async resolveAuthoritativeScope(input: {
    sessionId: string
    callerCourseId: string | null
  }): Promise<TopicScope> {
    const session = await this.topicRepository.findAuthoritativeSession(
      input.sessionId,
    )

    if (session?.deletedAt !== null) {
      throw topicSessionNotFoundException()
    }

    if (
      input.callerCourseId !== null &&
      input.callerCourseId !== session.courseId
    ) {
      throw topicCourseScopeMismatchException()
    }

    return {
      sessionId: session.id,
      courseId: session.courseId,
    }
  }

  private async assertOnlyActiveTopicIs(
    scope: TopicScope,
    topicId: string,
  ): Promise<void> {
    const activeTopics = await this.topicRepository.findActiveTopics(scope)
    const differentActiveTopic = activeTopics.find(
      (topic) => topic.id !== topicId,
    )

    if (differentActiveTopic !== undefined) {
      throw ambiguousActiveTopicException()
    }
  }

  private async validateResolutionEvidence(
    scope: TopicScope,
    evidence: TopicResolutionEvidenceInput,
  ): Promise<void> {
    if (!SUFFICIENT_TOPIC_RESOLUTION_EVIDENCE_TYPES.has(evidence.type)) {
      throw topicResolutionEvidenceRequiredException()
    }

    const uniqueMessageIds = Array.from(new Set(evidence.evidenceMessageIds))

    if (uniqueMessageIds.length === 0) {
      throw topicResolutionEvidenceRequiredException()
    }

    boundedReason(evidence.reason)

    const matchingMessages = await this.topicRepository.countMessagesByIds(
      scope,
      uniqueMessageIds,
    )

    if (matchingMessages !== uniqueMessageIds.length) {
      throw topicResolutionEvidenceRequiredException()
    }
  }
}

function normalizeRequiredIdentifier(value: string, field: string): string {
  const normalized = value.trim()

  if (normalized.length === 0) {
    throw invalidTopicRequestException([
      {
        field,
        message: 'Identifier is required',
      },
    ])
  }

  return normalized
}

function normalizeOptionalIdentifier(
  value: string | null | undefined,
): string | null {
  if (value === undefined || value === null) {
    return null
  }

  const normalized = value.trim()
  return normalized.length === 0 ? null : normalized
}

function boundedTopicTitle(
  value: string | null | undefined,
  fallback?: string,
): string {
  const title = (value ?? fallback ?? '').trim()

  if (title.length === 0 || title.length > MAX_TITLE_LENGTH) {
    throw invalidTopicRequestException([
      {
        field: 'title',
        message: `Title must be between 1 and ${String(MAX_TITLE_LENGTH)} characters`,
      },
    ])
  }

  return title
}

function boundedReason(value: string): string {
  const reason = value.trim()

  if (reason.length === 0 || reason.length > MAX_REASON_LENGTH) {
    throw topicResolutionEvidenceRequiredException()
  }

  return reason
}

function identitySourceForTopic(topic: TopicRecord): TopicStableIdentitySource {
  if (topic.problemId !== null) {
    return TOPIC_STABLE_IDENTITY_SOURCE.PROBLEM_ID
  }

  if (topic.conceptId !== null) {
    return TOPIC_STABLE_IDENTITY_SOURCE.CONCEPT_ID
  }

  return TOPIC_STABLE_IDENTITY_SOURCE.DETERMINISTIC_FALLBACK
}

function topicResolution(input: TopicResolution): TopicResolution {
  return {
    ...input,
    confidence: clampConfidence(input.confidence),
    reason: boundDiagnosticReason(input.reason),
  }
}

function unresolvedTopicResolution(
  stableIdentitySource: TopicStableIdentitySource,
  reason: string,
): TopicResolution {
  return topicResolution({
    outcome: TOPIC_RESOLUTION_OUTCOME.UNRESOLVED,
    topicId: null,
    previousTopicId: null,
    confidence: 0,
    stableIdentitySource,
    reason,
  })
}

function clampConfidence(value: number): number {
  if (Number.isNaN(value)) {
    return 0
  }

  return Math.max(0, Math.min(1, value))
}

function boundDiagnosticReason(value: string): string {
  return value.trim().slice(0, MAX_REASON_LENGTH)
}
