import { TOPIC_ERROR_CODES } from './topic.errors'
import {
  TopicRepository,
  type ActivateTopicInput,
  type CreateTopicRecordInput,
} from './topic.repository'
import { TopicService } from './topic.service'
import {
  MessageRole,
  TopicStatus,
  TopicType,
} from '../../generated/prisma/client'
import {
  TOPIC_RESOLUTION_EVIDENCE_TYPE,
  TOPIC_RESOLUTION_OUTCOME,
  TOPIC_STABLE_IDENTITY_SOURCE,
  type TopicRecord,
  type TopicScope,
  type TopicSessionRecord,
} from './topic.types'

class FakeTopicRepository extends TopicRepository {
  private topicCounter = 1
  readonly sessions = new Map<string, TopicSessionRecord>()
  readonly topics = new Map<string, TopicRecord>()
  readonly messages = new Map<
    string,
    { sessionId: string; role: MessageRole }
  >()

  readonly findAuthoritativeSession = jest.fn((sessionId: string) =>
    Promise.resolve(this.sessions.get(sessionId) ?? null),
  )

  readonly findActiveTopics = jest.fn((scope: TopicScope) =>
    Promise.resolve(
      this.scopedTopics(scope).filter(
        (topic) => topic.status === TopicStatus.ACTIVE,
      ),
    ),
  )

  readonly findTopicsByProblemId = jest.fn(
    (scope: TopicScope, problemId: string) =>
      Promise.resolve(
        this.scopedTopics(scope).filter(
          (topic) => topic.problemId === problemId,
        ),
      ),
  )

  readonly findTopicsByConceptId = jest.fn(
    (scope: TopicScope, conceptId: string) =>
      Promise.resolve(
        this.scopedTopics(scope).filter(
          (topic) => topic.conceptId === conceptId,
        ),
      ),
  )

  readonly findTopicById = jest.fn((scope: TopicScope, topicId: string) =>
    Promise.resolve(
      this.scopedTopics(scope).find((topic) => topic.id === topicId) ?? null,
    ),
  )

  readonly createActiveTopic = jest.fn((input: CreateTopicRecordInput) =>
    Promise.resolve(this.createActiveTopicRecord(input)),
  )

  readonly activateTopic = jest.fn((input: ActivateTopicInput) =>
    Promise.resolve(this.activateTopicRecord(input)),
  )

  readonly pauseTopic = jest.fn((scope: TopicScope, topicId: string) => {
    const topic = this.topics.get(topicId)

    if (!isTopicInScope(topic, scope) || topic.status !== TopicStatus.ACTIVE) {
      return Promise.resolve(null)
    }

    const paused = this.replaceTopic(topic, { status: TopicStatus.PAUSED })
    return Promise.resolve(paused)
  })

  readonly resolveTopic = jest.fn(
    (scope: TopicScope, topicId: string, resolvedAt: Date) => {
      const topic = this.topics.get(topicId)

      if (
        !isTopicInScope(topic, scope) ||
        topic.status !== TopicStatus.ACTIVE
      ) {
        return Promise.resolve(null)
      }

      const resolved = this.replaceTopic(topic, {
        status: TopicStatus.RESOLVED,
        resolvedAt,
      })

      return Promise.resolve(resolved)
    },
  )

  readonly countMessagesByIds = jest.fn(
    (scope: TopicScope, messageIds: string[]) =>
      Promise.resolve(
        messageIds.filter((messageId) => {
          const message = this.messages.get(messageId)
          return (
            message?.sessionId === scope.sessionId &&
            message.role === MessageRole.STUDENT
          )
        }).length,
      ),
  )

  addSession(session: TopicSessionRecord) {
    this.sessions.set(session.id, session)
  }

  addMessage(
    sessionId: string,
    messageId: string,
    role: MessageRole = MessageRole.STUDENT,
  ) {
    this.messages.set(messageId, { sessionId, role })
  }

  addTopic(input: Partial<TopicRecord>) {
    const topic = buildTopic({
      id: `topic-${String(this.topicCounter++)}`,
      ...input,
    })
    this.topics.set(topic.id, topic)
    return topic
  }

  private createActiveTopicRecord(input: CreateTopicRecordInput) {
    const activeTopics = this.scopedTopics(input).filter(
      (topic) => topic.status === TopicStatus.ACTIVE,
    )

    if (activeTopics.length > 1) {
      return null
    }

    const previousTopic = activeTopics.length === 1 ? activeTopics[0] : null
    const previousTopicId = previousTopic ? previousTopic.id : null

    if (previousTopic !== null) {
      this.replaceTopic(previousTopic, { status: TopicStatus.PAUSED })
    }

    const topic = this.addTopic({
      sessionId: input.sessionId,
      courseId: input.courseId,
      problemId: input.problemId ?? null,
      conceptId: input.conceptId ?? null,
      title: input.title,
      topicType: input.topicType,
      status: TopicStatus.ACTIVE,
    })

    return { topic, previousTopicId }
  }

  private activateTopicRecord(input: ActivateTopicInput) {
    const scope = { sessionId: input.sessionId, courseId: input.courseId }
    const topic = this.topics.get(input.topicId)

    if (!isTopicInScope(topic, scope)) {
      return null
    }

    if (topic.status === TopicStatus.ACTIVE) {
      const differentActiveTopics = this.scopedTopics(scope).filter(
        (activeTopic) =>
          activeTopic.status === TopicStatus.ACTIVE &&
          activeTopic.id !== topic.id,
      )

      return differentActiveTopics.length === 0
        ? { topic, previousTopicId: null }
        : null
    }

    if (topic.status !== input.expectedStatus) {
      return null
    }

    const activeTopics = this.scopedTopics(scope).filter(
      (activeTopic) => activeTopic.status === TopicStatus.ACTIVE,
    )

    if (activeTopics.length > 1) {
      return null
    }

    const previousTopic = activeTopics.length === 1 ? activeTopics[0] : null
    const previousTopicId = previousTopic ? previousTopic.id : null

    if (previousTopic !== null) {
      this.replaceTopic(previousTopic, { status: TopicStatus.PAUSED })
    }

    const activated = this.replaceTopic(topic, {
      status: TopicStatus.ACTIVE,
      resolvedAt: input.clearResolvedAt ? null : topic.resolvedAt,
    })

    return { topic: activated, previousTopicId }
  }

  private replaceTopic(topic: TopicRecord, changes: Partial<TopicRecord>) {
    const updated = {
      ...topic,
      ...changes,
      updatedAt: new Date(),
    }
    this.topics.set(topic.id, updated)
    return updated
  }

  private scopedTopics(scope: TopicScope) {
    return Array.from(this.topics.values()).filter((topic) =>
      isTopicInScope(topic, scope),
    )
  }
}

const session = { id: 'session-1', courseId: 'course-1', deletedAt: null }
const otherSession = {
  id: 'session-2',
  courseId: 'course-1',
  deletedAt: null,
}
const otherCourseSession = {
  id: 'session-3',
  courseId: 'course-2',
  deletedAt: null,
}

function buildService() {
  const repository = new FakeTopicRepository()
  repository.addSession(session)
  repository.addSession(otherSession)
  repository.addSession(otherCourseSession)
  repository.addMessage(session.id, 'message-1')
  repository.addMessage(session.id, 'message-2')
  repository.addMessage(otherSession.id, 'other-message')
  repository.addMessage(session.id, 'assistant-message', MessageRole.ASSISTANT)
  repository.addMessage(session.id, 'system-message', MessageRole.SYSTEM)

  return {
    repository,
    service: new TopicService(repository),
  }
}

function buildTopic(input: Partial<TopicRecord> & Pick<TopicRecord, 'id'>) {
  const now = new Date('2026-08-03T12:00:00.000Z')

  return {
    sessionId: session.id,
    courseId: session.courseId,
    problemId: null,
    conceptId: null,
    title: 'Existing topic',
    topicType: TopicType.UNCLASSIFIED,
    status: TopicStatus.ACTIVE,
    resolvedAt: null,
    createdAt: now,
    updatedAt: now,
    ...input,
  } satisfies TopicRecord
}

function isTopicInScope(
  topic: TopicRecord | undefined,
  scope: TopicScope,
): topic is TopicRecord {
  return (
    topic?.sessionId === scope.sessionId && topic.courseId === scope.courseId
  )
}

function sufficientEvidence() {
  return {
    type: TOPIC_RESOLUTION_EVIDENCE_TYPE.VERIFIED_CORRECT_SOLUTION,
    evidenceMessageIds: ['message-1'],
    reason: 'verified by student work',
  }
}

async function expectRejectCode(
  promise: Promise<unknown>,
  code: string,
): Promise<void> {
  await expect(promise).rejects.toMatchObject({
    response: { code },
  })
}

describe('TopicService resolution', () => {
  it('continues an active Topic with a matching problemId', async () => {
    const { service, repository } = buildService()
    const topic = repository.addTopic({ problemId: 'problem-1' })

    await expect(
      service.resolveTopic({ sessionId: session.id, problemId: 'problem-1' }),
    ).resolves.toMatchObject({
      outcome: TOPIC_RESOLUTION_OUTCOME.CONTINUE_CURRENT_TOPIC,
      topicId: topic.id,
      stableIdentitySource: TOPIC_STABLE_IDENTITY_SOURCE.PROBLEM_ID,
    })
  })

  it('continues an active Topic with a matching conceptId', async () => {
    const { service, repository } = buildService()
    const topic = repository.addTopic({ conceptId: 'concept-1' })

    await expect(
      service.resolveTopic({ sessionId: session.id, conceptId: 'concept-1' }),
    ).resolves.toMatchObject({
      outcome: TOPIC_RESOLUTION_OUTCOME.CONTINUE_CURRENT_TOPIC,
      topicId: topic.id,
      stableIdentitySource: TOPIC_STABLE_IDENTITY_SOURCE.CONCEPT_ID,
    })
  })

  it('does not silently reuse a concept-only Topic when problemId is supplied', async () => {
    const { service, repository } = buildService()
    const conceptTopic = repository.addTopic({ conceptId: 'concept-1' })

    const resolution = await service.resolveTopic({
      sessionId: session.id,
      problemId: 'problem-1',
      conceptId: 'concept-1',
    })

    expect(resolution).toMatchObject({
      outcome: TOPIC_RESOLUTION_OUTCOME.CREATE_NEW_TOPIC,
      previousTopicId: conceptTopic.id,
      stableIdentitySource: TOPIC_STABLE_IDENTITY_SOURCE.PROBLEM_ID,
    })
    expect(repository.topics.get(conceptTopic.id)?.status).toBe(
      TopicStatus.PAUSED,
    )
  })

  it('creates a new Topic when no stable identity matches', async () => {
    const { service } = buildService()

    await expect(
      service.resolveTopic({ sessionId: session.id, problemId: 'problem-1' }),
    ).resolves.toMatchObject({
      outcome: TOPIC_RESOLUTION_OUTCOME.CREATE_NEW_TOPIC,
      stableIdentitySource: TOPIC_STABLE_IDENTITY_SOURCE.PROBLEM_ID,
    })
  })

  it('pauses the previous active Topic when creating a new focus', async () => {
    const { service, repository } = buildService()
    const previous = repository.addTopic({})

    const resolution = await service.createTopic({
      sessionId: session.id,
      title: 'New focus',
    })

    expect(resolution.previousTopicId).toBe(previous.id)
    expect(repository.topics.get(previous.id)?.status).toBe(TopicStatus.PAUSED)
  })

  it('resumes a matching paused Topic', async () => {
    const { service, repository } = buildService()
    const active = repository.addTopic({})
    const paused = repository.addTopic({
      problemId: 'problem-1',
      status: TopicStatus.PAUSED,
    })

    const resolution = await service.resolveTopic({
      sessionId: session.id,
      problemId: 'problem-1',
    })

    expect(resolution).toMatchObject({
      outcome: TOPIC_RESOLUTION_OUTCOME.RESUME_PREVIOUS_TOPIC,
      topicId: paused.id,
      previousTopicId: active.id,
    })
    expect(repository.topics.get(active.id)?.status).toBe(TopicStatus.PAUSED)
    expect(repository.topics.get(paused.id)?.status).toBe(TopicStatus.ACTIVE)
  })

  it('reopens a matching resolved Topic', async () => {
    const { service, repository } = buildService()
    const resolved = repository.addTopic({
      conceptId: 'concept-1',
      status: TopicStatus.RESOLVED,
      resolvedAt: new Date(),
    })

    const resolution = await service.resolveTopic({
      sessionId: session.id,
      conceptId: 'concept-1',
    })

    expect(resolution).toMatchObject({
      outcome: TOPIC_RESOLUTION_OUTCOME.REOPEN_EXISTING_TOPIC,
      topicId: resolved.id,
    })
    expect(repository.topics.get(resolved.id)?.resolvedAt).toBeNull()
  })

  it('does not silently reactivate a matching abandoned Topic', async () => {
    const { service, repository } = buildService()
    const abandoned = repository.addTopic({
      problemId: 'problem-1',
      status: TopicStatus.ABANDONED,
    })

    const resolution = await service.resolveTopic({
      sessionId: session.id,
      problemId: 'problem-1',
    })

    expect(resolution.outcome).toBe(TOPIC_RESOLUTION_OUTCOME.CREATE_NEW_TOPIC)
    expect(resolution.topicId).not.toBe(abandoned.id)
    expect(repository.topics.get(abandoned.id)?.status).toBe(
      TopicStatus.ABANDONED,
    )
  })

  it('continues exactly one active Topic when no stable identifier is supplied', async () => {
    const { service, repository } = buildService()
    const active = repository.addTopic({})

    await expect(
      service.resolveTopic({ sessionId: session.id }),
    ).resolves.toMatchObject({
      outcome: TOPIC_RESOLUTION_OUTCOME.CONTINUE_CURRENT_TOPIC,
      topicId: active.id,
      stableIdentitySource: TOPIC_STABLE_IDENTITY_SOURCE.ACTIVE_TOPIC,
    })
  })

  it('creates one deterministic fallback Topic when no active Topic exists', async () => {
    const { service, repository } = buildService()

    const resolution = await service.resolveTopic({ sessionId: session.id })

    expect(resolution).toMatchObject({
      outcome: TOPIC_RESOLUTION_OUTCOME.CREATE_NEW_TOPIC,
      stableIdentitySource: TOPIC_STABLE_IDENTITY_SOURCE.DETERMINISTIC_FALLBACK,
      reason: 'created deterministic fallback topic',
    })
    expect(repository.topics.get(resolution.topicId ?? '')).toMatchObject({
      title: 'General tutoring topic',
      topicType: TopicType.UNCLASSIFIED,
    })
  })

  it('returns UNRESOLVED without mutation for multiple matching Topics', async () => {
    const { service, repository } = buildService()
    const active = repository.addTopic({ problemId: 'problem-1' })
    const paused = repository.addTopic({
      problemId: 'problem-1',
      status: TopicStatus.PAUSED,
    })

    const resolution = await service.resolveTopic({
      sessionId: session.id,
      problemId: 'problem-1',
    })

    expect(resolution.outcome).toBe(TOPIC_RESOLUTION_OUTCOME.UNRESOLVED)
    expect(repository.topics.get(active.id)?.status).toBe(TopicStatus.ACTIVE)
    expect(repository.topics.get(paused.id)?.status).toBe(TopicStatus.PAUSED)
  })

  it('returns UNRESOLVED without mutation for multiple active Topics', async () => {
    const { service, repository } = buildService()
    repository.addTopic({})
    repository.addTopic({})

    await expect(
      service.resolveTopic({ sessionId: session.id }),
    ).resolves.toMatchObject({
      outcome: TOPIC_RESOLUTION_OUTCOME.UNRESOLVED,
      topicId: null,
    })
    expect(repository.createActiveTopic).not.toHaveBeenCalled()
  })
})

describe('TopicService scope validation', () => {
  it('does not continue a Topic from another session', async () => {
    const { service, repository } = buildService()
    repository.addTopic({
      sessionId: otherSession.id,
      courseId: otherSession.courseId,
      problemId: 'problem-1',
    })

    const resolution = await service.resolveTopic({
      sessionId: session.id,
      problemId: 'problem-1',
    })

    expect(resolution.outcome).toBe(TOPIC_RESOLUTION_OUTCOME.CREATE_NEW_TOPIC)
  })

  it('does not pause, resume, reopen, or resolve a Topic from another session', async () => {
    const { service, repository } = buildService()
    const otherTopic = repository.addTopic({
      sessionId: otherSession.id,
      courseId: otherSession.courseId,
    })

    await expectRejectCode(
      service.pauseTopic({ sessionId: session.id, topicId: otherTopic.id }),
      TOPIC_ERROR_CODES.TOPIC_NOT_FOUND,
    )
    await expectRejectCode(
      service.resumeTopic({ sessionId: session.id, topicId: otherTopic.id }),
      TOPIC_ERROR_CODES.TOPIC_NOT_FOUND,
    )
    await expectRejectCode(
      service.reopenTopic({ sessionId: session.id, topicId: otherTopic.id }),
      TOPIC_ERROR_CODES.TOPIC_NOT_FOUND,
    )
    await expectRejectCode(
      service.resolveAsResolved({
        sessionId: session.id,
        topicId: otherTopic.id,
        evidence: sufficientEvidence(),
      }),
      TOPIC_ERROR_CODES.TOPIC_NOT_FOUND,
    )
  })

  it('does not select a Topic from another course with the same stable identity', async () => {
    const { service, repository } = buildService()
    repository.addTopic({
      sessionId: otherCourseSession.id,
      courseId: otherCourseSession.courseId,
      conceptId: 'concept-1',
    })

    const resolution = await service.resolveTopic({
      sessionId: session.id,
      conceptId: 'concept-1',
    })

    expect(resolution.outcome).toBe(TOPIC_RESOLUTION_OUTCOME.CREATE_NEW_TOPIC)
  })

  it('uses the authoritative course from ChatSession', async () => {
    const { service, repository } = buildService()

    await service.resolveTopic({ sessionId: session.id })

    expect(repository.createActiveTopic).toHaveBeenCalledWith(
      expect.objectContaining({
        courseId: session.courseId,
      }),
    )
  })

  it('rejects missing and deleted sessions safely', async () => {
    const { service, repository } = buildService()
    repository.addSession({
      id: 'deleted-session',
      courseId: 'course-1',
      deletedAt: new Date(),
    })

    await expectRejectCode(
      service.resolveTopic({ sessionId: 'missing-session' }),
      TOPIC_ERROR_CODES.SESSION_NOT_FOUND,
    )
    await expectRejectCode(
      service.resolveTopic({ sessionId: 'deleted-session' }),
      TOPIC_ERROR_CODES.SESSION_NOT_FOUND,
    )
  })

  it('does not let caller identifiers bypass scope validation', async () => {
    const { service, repository } = buildService()
    const topic = repository.addTopic({})

    await expectRejectCode(
      service.pauseTopic({
        sessionId: session.id,
        courseId: otherCourseSession.courseId,
        topicId: topic.id,
      }),
      TOPIC_ERROR_CODES.COURSE_SCOPE_MISMATCH,
    )
  })

  it('rejects evidence messages from another session', async () => {
    const { service, repository } = buildService()
    const topic = repository.addTopic({})

    await expectRejectCode(
      service.resolveAsResolved({
        sessionId: session.id,
        topicId: topic.id,
        evidence: {
          ...sufficientEvidence(),
          evidenceMessageIds: ['other-message'],
        },
      }),
      TOPIC_ERROR_CODES.RESOLUTION_EVIDENCE_REQUIRED,
    )
  })

  it.each(['assistant-message', 'system-message'])(
    'rejects non-student evidence message %s',
    async (messageId) => {
      const { service, repository } = buildService()
      const topic = repository.addTopic({})

      await expectRejectCode(
        service.resolveAsResolved({
          sessionId: session.id,
          topicId: topic.id,
          evidence: {
            ...sufficientEvidence(),
            evidenceMessageIds: [messageId],
          },
        }),
        TOPIC_ERROR_CODES.RESOLUTION_EVIDENCE_REQUIRED,
      )
    },
  )
})

describe('TopicService lifecycle', () => {
  it('creates ACTIVE Topics', async () => {
    const { service, repository } = buildService()
    const resolution = await service.createTopic({
      sessionId: session.id,
      title: 'New topic',
    })

    expect(repository.topics.get(resolution.topicId ?? '')?.status).toBe(
      TopicStatus.ACTIVE,
    )
  })

  it('pauses ACTIVE Topics and is idempotent for already PAUSED Topics', async () => {
    const { service, repository } = buildService()
    const topic = repository.addTopic({})

    const paused = await service.pauseTopic({
      sessionId: session.id,
      topicId: topic.id,
    })
    const pausedAgain = await service.pauseTopic({
      sessionId: session.id,
      topicId: topic.id,
    })

    expect(paused.status).toBe(TopicStatus.PAUSED)
    expect(pausedAgain.status).toBe(TopicStatus.PAUSED)
  })

  it('resumes PAUSED Topics', async () => {
    const { service, repository } = buildService()
    const topic = repository.addTopic({ status: TopicStatus.PAUSED })

    await expect(
      service.resumeTopic({ sessionId: session.id, topicId: topic.id }),
    ).resolves.toMatchObject({
      outcome: TOPIC_RESOLUTION_OUTCOME.RESUME_PREVIOUS_TOPIC,
      topicId: topic.id,
    })
  })

  it('reopens RESOLVED Topics and clears resolvedAt', async () => {
    const { service, repository } = buildService()
    const topic = repository.addTopic({
      status: TopicStatus.RESOLVED,
      resolvedAt: new Date(),
    })

    await service.reopenTopic({ sessionId: session.id, topicId: topic.id })

    expect(repository.topics.get(topic.id)).toMatchObject({
      status: TopicStatus.ACTIVE,
      resolvedAt: null,
    })
  })

  it('resolves ACTIVE Topics with structured student evidence', async () => {
    const { service, repository } = buildService()
    const topic = repository.addTopic({})

    const resolved = await service.resolveAsResolved({
      sessionId: session.id,
      topicId: topic.id,
      evidence: sufficientEvidence(),
    })

    expect(resolved.status).toBe(TopicStatus.RESOLVED)
    expect(resolved.resolvedAt).toBeInstanceOf(Date)
  })

  it('rejects illegal transitions without partial mutation', async () => {
    const { service, repository } = buildService()
    const resolved = repository.addTopic({ status: TopicStatus.RESOLVED })
    const abandoned = repository.addTopic({ status: TopicStatus.ABANDONED })

    await expectRejectCode(
      service.pauseTopic({ sessionId: session.id, topicId: resolved.id }),
      TOPIC_ERROR_CODES.INVALID_LIFECYCLE_TRANSITION,
    )
    await expectRejectCode(
      service.resumeTopic({ sessionId: session.id, topicId: abandoned.id }),
      TOPIC_ERROR_CODES.INVALID_LIFECYCLE_TRANSITION,
    )
    await expectRejectCode(
      service.resolveAsResolved({
        sessionId: session.id,
        topicId: abandoned.id,
        evidence: sufficientEvidence(),
      }),
      TOPIC_ERROR_CODES.INVALID_LIFECYCLE_TRANSITION,
    )
    expect(repository.topics.get(resolved.id)?.status).toBe(
      TopicStatus.RESOLVED,
    )
    expect(repository.topics.get(abandoned.id)?.status).toBe(
      TopicStatus.ABANDONED,
    )
  })

  it('replaces active focus atomically when resuming a Topic', async () => {
    const { service, repository } = buildService()
    const active = repository.addTopic({})
    const paused = repository.addTopic({ status: TopicStatus.PAUSED })

    const resolution = await service.resumeTopic({
      sessionId: session.id,
      topicId: paused.id,
    })

    expect(resolution.previousTopicId).toBe(active.id)
    expect(repository.topics.get(active.id)?.status).toBe(TopicStatus.PAUSED)
    expect(repository.topics.get(paused.id)?.status).toBe(TopicStatus.ACTIVE)
  })
})

describe('TopicService resolution evidence', () => {
  it.each([
    TOPIC_RESOLUTION_EVIDENCE_TYPE.VERIFIED_CORRECT_SOLUTION,
    TOPIC_RESOLUTION_EVIDENCE_TYPE.CORRECTED_MISCONCEPTION_WITH_EXPLANATION,
    TOPIC_RESOLUTION_EVIDENCE_TYPE.INDEPENDENT_REASONING_COMPLETION,
    TOPIC_RESOLUTION_EVIDENCE_TYPE.SUCCESSFUL_TRANSFER_OR_VERIFICATION,
  ])('permits resolution for sufficient evidence %s', async (type) => {
    const { service, repository } = buildService()
    const topic = repository.addTopic({})

    await expect(
      service.resolveAsResolved({
        sessionId: session.id,
        topicId: topic.id,
        evidence: {
          type,
          evidenceMessageIds: ['message-1'],
          reason: 'structured student evidence',
        },
      }),
    ).resolves.toMatchObject({
      status: TopicStatus.RESOLVED,
    })
  })

  it.each([
    TOPIC_RESOLUTION_EVIDENCE_TYPE.TUTOR_PROVIDED_ANSWER,
    TOPIC_RESOLUTION_EVIDENCE_TYPE.STUDENT_STOPPED_RESPONDING,
    TOPIC_RESOLUTION_EVIDENCE_TYPE.STUDENT_SAID_THANKS,
    TOPIC_RESOLUTION_EVIDENCE_TYPE.STUDENT_CLAIMED_UNDERSTANDING,
    TOPIC_RESOLUTION_EVIDENCE_TYPE.MAX_GUIDANCE_LEVEL_REACHED,
  ])('rejects insufficient evidence condition %s', async (type) => {
    const { service, repository } = buildService()
    const topic = repository.addTopic({})

    await expectRejectCode(
      service.resolveAsResolved({
        sessionId: session.id,
        topicId: topic.id,
        evidence: {
          type,
          evidenceMessageIds: ['message-1'],
          reason: 'insufficient evidence',
        },
      }),
      TOPIC_ERROR_CODES.RESOLUTION_EVIDENCE_REQUIRED,
    )
    expect(repository.topics.get(topic.id)?.status).toBe(TopicStatus.ACTIVE)
  })

  it('rejects empty evidence-message references', async () => {
    const { service, repository } = buildService()
    const topic = repository.addTopic({})

    await expectRejectCode(
      service.resolveAsResolved({
        sessionId: session.id,
        topicId: topic.id,
        evidence: {
          ...sufficientEvidence(),
          evidenceMessageIds: [],
        },
      }),
      TOPIC_ERROR_CODES.RESOLUTION_EVIDENCE_REQUIRED,
    )
  })
})

describe('TopicService regression boundaries', () => {
  it('does not call model ports or mutate TopicState through its repository boundary', async () => {
    const { service, repository } = buildService()

    await service.resolveTopic({ sessionId: session.id })

    expect(repository.findAuthoritativeSession).toHaveBeenCalledTimes(1)
    expect(repository.createActiveTopic).toHaveBeenCalledTimes(1)
    expect(Object.keys(repository)).not.toContain('topicState')
    expect(Object.keys(repository)).not.toContain('completionProvider')
  })
})
