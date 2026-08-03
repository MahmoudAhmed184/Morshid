import { TOPIC_STATE_ERROR_CODES } from './topic-state.errors'
import { TopicStateRepository } from './topic-state.repository'
import { TopicStateService } from './topic-state.service'
import type {
  TopicStatePatch,
  TopicStateSnapshot,
} from './topic-state.types'
import {
  LearningStatus,
  MessageRequestKind,
  MisconceptionStatus,
  ResolutionEvidenceStrength,
  RevealPolicy,
  StudentState,
  TeachingStrategy,
  TeachingTechnique,
} from '../../generated/prisma/client'

const now = new Date('2026-08-03T12:00:00.000Z')

class FakeTopicStateRepository extends TopicStateRepository {
  readonly topics = new Set<string>()
  readonly states = new Map<string, TopicStateSnapshot>()

  readonly topicExists = jest.fn((topicId: string) =>
    Promise.resolve(this.topics.has(topicId)),
  )

  readonly findByTopicId = jest.fn((topicId: string) =>
    Promise.resolve(this.states.get(topicId) ?? null),
  )

  readonly createForTopic = jest.fn((topicId: string) => {
    if (this.states.has(topicId)) {
      return Promise.resolve(null)
    }

    const state = defaultState(topicId)
    this.states.set(topicId, state)
    return Promise.resolve(state)
  })

  readonly applyVersionedPatch = jest.fn(
    (input: {
      topicId: string
      expectedVersion: number
      patch: TopicStatePatch
    }) => {
      const state = this.states.get(input.topicId)

      if (state === undefined || state.version !== input.expectedVersion) {
        return Promise.resolve(null)
      }

      const updated = {
        ...state,
        ...input.patch,
        version: state.version + 1,
        updatedAt: new Date('2026-08-03T12:01:00.000Z'),
      }
      this.states.set(input.topicId, updated)

      return Promise.resolve(updated)
    },
  )

  addTopic(topicId: string) {
    this.topics.add(topicId)
  }

  addState(state: TopicStateSnapshot) {
    this.addTopic(state.topicId)
    this.states.set(state.topicId, state)
  }
}

function buildService() {
  const repository = new FakeTopicStateRepository()
  const service = new TopicStateService(repository)

  return { repository, service }
}

function defaultState(
  topicId = 'topic-1',
  input: Partial<TopicStateSnapshot> = {},
): TopicStateSnapshot {
  return {
    id: `state-${topicId}`,
    topicId,
    version: 1,
    requestKind: null,
    studentState: StudentState.UNKNOWN,
    activeStrategy: null,
    primaryTechnique: null,
    supportingTechnique: null,
    guidanceLevel: 1,
    revealPolicy: RevealPolicy.NO_FINAL_ANSWER,
    attemptCount: 0,
    meaningfulAttemptCount: 0,
    misconceptionStatus: null,
    learningStatus: LearningStatus.UNKNOWN,
    resolutionEvidenceStrength: ResolutionEvidenceStrength.NONE,
    summary: null,
    lastTutorQuestion: null,
    lastStudentAction: null,
    resolved: false,
    updatedAt: now,
    ...input,
  }
}

async function expectRejectCode(
  promise: Promise<unknown>,
  code: string,
): Promise<void> {
  await expect(promise).rejects.toMatchObject({
    response: expect.objectContaining({ code }),
  })
}

describe('TopicStateService', () => {
  it('creates a TopicState on first access', async () => {
    const { repository, service } = buildService()
    repository.addTopic('topic-1')

    const state = await service.getOrCreate('topic-1')

    expect(state.topicId).toBe('topic-1')
    expect(repository.createForTopic).toHaveBeenCalledWith('topic-1')
    expect(repository.states.get('topic-1')).toEqual(state)
  })

  it('returns Task 1.1 defaults for a new TopicState', async () => {
    const { repository, service } = buildService()
    repository.addTopic('topic-1')

    await expect(service.getOrCreate('topic-1')).resolves.toMatchObject({
      version: 1,
      guidanceLevel: 1,
      attemptCount: 0,
      meaningfulAttemptCount: 0,
      studentState: StudentState.UNKNOWN,
      learningStatus: LearningStatus.UNKNOWN,
      resolutionEvidenceStrength: ResolutionEvidenceStrength.NONE,
    })
  })

  it('returns existing state without resetting mutable fields', async () => {
    const { repository, service } = buildService()
    const existing = defaultState('topic-1', {
      version: 4,
      requestKind: MessageRequestKind.ATTEMPT_DIAGNOSIS,
      studentState: StudentState.MISCONCEPTION,
      activeStrategy: TeachingStrategy.MISCONCEPTION_REPAIR,
      primaryTechnique: TeachingTechnique.COUNTEREXAMPLE,
      guidanceLevel: 3,
      attemptCount: 5,
      meaningfulAttemptCount: 2,
      misconceptionStatus: MisconceptionStatus.ACTIVE,
      learningStatus: LearningStatus.IN_PROGRESS,
      resolutionEvidenceStrength: ResolutionEvidenceStrength.WEAK,
      summary: 'Student is mixing up loop bounds.',
      lastTutorQuestion: 'What is the final value of i?',
      lastStudentAction: 'Tried an off-by-one trace.',
      resolved: true,
    })
    repository.addState(existing)

    await expect(service.getOrCreate('topic-1')).resolves.toEqual(existing)
    expect(repository.createForTopic).not.toHaveBeenCalled()
  })

  it('applies an allowlisted mutable patch with the expected version', async () => {
    const { repository, service } = buildService()
    repository.addState(defaultState('topic-1'))

    await expect(
      service.applyTransition('topic-1', 1, {
        requestKind: MessageRequestKind.CODE_DIAGNOSIS,
        studentState: StudentState.DEBUGGING_ISSUE,
        activeStrategy: TeachingStrategy.DEBUGGING_GUIDANCE,
        primaryTechnique: TeachingTechnique.TRACE_EXECUTION,
        supportingTechnique: TeachingTechnique.VERIFICATION,
        guidanceLevel: 2,
        revealPolicy: RevealPolicy.PARTIAL_RESULT_ALLOWED,
        attemptCount: 1,
        meaningfulAttemptCount: 1,
        misconceptionStatus: MisconceptionStatus.SUSPECTED,
        learningStatus: LearningStatus.IN_PROGRESS,
        resolutionEvidenceStrength: ResolutionEvidenceStrength.MODERATE,
        summary: 'The student is tracing a branch condition.',
        lastTutorQuestion: 'Which branch runs when n is zero?',
        lastStudentAction: 'Asked for debugging help.',
        resolved: false,
      }),
    ).resolves.toMatchObject({
      version: 2,
      requestKind: MessageRequestKind.CODE_DIAGNOSIS,
      studentState: StudentState.DEBUGGING_ISSUE,
      activeStrategy: TeachingStrategy.DEBUGGING_GUIDANCE,
      primaryTechnique: TeachingTechnique.TRACE_EXECUTION,
      supportingTechnique: TeachingTechnique.VERIFICATION,
      guidanceLevel: 2,
      revealPolicy: RevealPolicy.PARTIAL_RESULT_ALLOWED,
      attemptCount: 1,
      meaningfulAttemptCount: 1,
      misconceptionStatus: MisconceptionStatus.SUSPECTED,
      learningStatus: LearningStatus.IN_PROGRESS,
      resolutionEvidenceStrength: ResolutionEvidenceStrength.MODERATE,
      summary: 'The student is tracing a branch condition.',
      lastTutorQuestion: 'Which branch runs when n is zero?',
      lastStudentAction: 'Asked for debugging help.',
      resolved: false,
    })
  })

  it('increments version exactly once on update', async () => {
    const { repository, service } = buildService()
    repository.addState(defaultState('topic-1', { version: 7 }))

    const updated = await service.applyTransition('topic-1', 7, {
      guidanceLevel: 2,
    })

    expect(updated.version).toBe(8)
    expect(repository.states.get('topic-1')?.version).toBe(8)
  })

  it('rejects a stale version', async () => {
    const { repository, service } = buildService()
    repository.addState(defaultState('topic-1', { version: 3 }))

    await expectRejectCode(
      service.applyTransition('topic-1', 2, { guidanceLevel: 2 }),
      TOPIC_STATE_ERROR_CODES.STALE_VERSION,
    )
  })

  it('does not mutate state when rejecting a stale version', async () => {
    const { repository, service } = buildService()
    const existing = defaultState('topic-1', {
      version: 3,
      guidanceLevel: 1,
      summary: 'Stable summary',
    })
    repository.addState(existing)

    await expectRejectCode(
      service.applyTransition('topic-1', 2, {
        guidanceLevel: 4,
        summary: 'Stale overwrite',
      }),
      TOPIC_STATE_ERROR_CODES.STALE_VERSION,
    )

    expect(repository.states.get('topic-1')).toEqual(existing)
  })

  it('rejects getOrCreate for a missing Topic', async () => {
    const { service } = buildService()

    await expectRejectCode(
      service.getOrCreate('missing-topic'),
      TOPIC_STATE_ERROR_CODES.TOPIC_NOT_FOUND,
    )
  })

  it('rejects transition for an existing Topic without TopicState', async () => {
    const { repository, service } = buildService()
    repository.addTopic('topic-1')

    await expectRejectCode(
      service.applyTransition('topic-1', 1, { guidanceLevel: 2 }),
      TOPIC_STATE_ERROR_CODES.STATE_NOT_FOUND,
    )
  })

  it('keeps TopicStatePatch identity fields unavailable by contract', () => {
    const mutablePatch = {
      summary: 'Allowed',
    } satisfies TopicStatePatch

    // @ts-expect-error id is owned by persistence, not state transitions.
    const idPatch = { id: 'state-1' } satisfies TopicStatePatch

    // @ts-expect-error topicId is selected by the method argument.
    const topicIdPatch = { topicId: 'topic-1' } satisfies TopicStatePatch

    // @ts-expect-error version is incremented by TopicStateService.
    const versionPatch = { version: 2 } satisfies TopicStatePatch

    // @ts-expect-error updatedAt is persistence metadata.
    const updatedAtPatch = { updatedAt: now } satisfies TopicStatePatch

    expect(mutablePatch).toEqual({ summary: 'Allowed' })
    expect(idPatch).toEqual({ id: 'state-1' })
    expect(topicIdPatch).toEqual({ topicId: 'topic-1' })
    expect(versionPatch).toEqual({ version: 2 })
    expect(updatedAtPatch).toEqual({ updatedAt: now })
  })
})
