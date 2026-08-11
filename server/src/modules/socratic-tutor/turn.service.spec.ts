import {
  TutoringAttemptFailureCode,
  TutoringAttemptStatus,
} from '../../generated/prisma/client'
import { TURN_ERROR_CODES } from './turn.errors'
import { TurnRepository } from './turn.repository'
import { TURN_PROCESSING_STALE_AFTER_MS, TurnService } from './turn.service'
import {
  TURN_ACQUISITION_OUTCOME,
  type AttachResolvedTopicInput,
  type AttachResolvedTopicResult,
  type LinkStudentMessageInput,
  type LinkStudentMessageResult,
  type TutoringAttemptSessionRecord,
  type TutoringAttemptSnapshot,
} from './turn.types'

const now = new Date('2026-08-03T12:00:00.000Z')

class FakeTurnRepository extends TurnRepository {
  private turnCounter = 1
  readonly sessions = new Map<string, TutoringAttemptSessionRecord>()
  readonly turns = new Map<string, TutoringAttemptSnapshot>()

  readonly findAuthoritativeSession = jest.fn((sessionId: string) =>
    Promise.resolve(this.sessions.get(sessionId) ?? null),
  )

  readonly createTurn = jest.fn(
    (sessionId: string, clientMessageId: string) => {
      if (!this.sessions.has(sessionId)) {
        return Promise.resolve(null)
      }

      if (this.findBySessionAndKey(sessionId, clientMessageId) !== null) {
        return Promise.resolve(null)
      }

      return Promise.resolve(this.addTurn({ sessionId, clientMessageId }))
    },
  )

  readonly findBySessionAndClientMessageId = jest.fn(
    (sessionId: string, clientMessageId: string) =>
      Promise.resolve(this.findBySessionAndKey(sessionId, clientMessageId)),
  )

  readonly findById = jest.fn((attemptId: string) =>
    Promise.resolve(this.turns.get(attemptId) ?? null),
  )

  readonly completeApprovedResponse = jest.fn(() =>
    Promise.resolve({ kind: 'relationship_mismatch' as const }),
  )

  readonly completeClassifiedResponse = jest.fn(() =>
    Promise.resolve({ kind: 'relationship_mismatch' as const }),
  )

  readonly transitionStatusAtomically = jest.fn(
    (input: {
      attemptId: string
      expectedStatus: TutoringAttemptStatus
      nextStatus: TutoringAttemptStatus
    }) => {
      const turn = this.turns.get(input.attemptId)

      if (turn?.status !== input.expectedStatus) {
        return Promise.resolve(null)
      }

      const updated = this.replaceTurn(turn, { status: input.nextStatus })
      return Promise.resolve(updated)
    },
  )

  readonly markFailedAtomically = jest.fn(
    (input: {
      attemptId: string
      expectedStatus: TutoringAttemptStatus
      failureCode: TutoringAttemptFailureCode
    }) => {
      const turn = this.turns.get(input.attemptId)

      if (turn?.status !== input.expectedStatus) {
        return Promise.resolve(null)
      }

      const updated = this.replaceTurn(turn, {
        status: TutoringAttemptStatus.FAILED,
        failureCode: input.failureCode,
        completedAt: new Date('2026-08-03T12:01:00.000Z'),
      })
      return Promise.resolve(updated)
    },
  )

  readonly linkStudentMessage = jest.fn(
    (_input: LinkStudentMessageInput): Promise<LinkStudentMessageResult> =>
      Promise.resolve({ kind: 'turn_not_found' }),
  )

  readonly attachResolvedTopic = jest.fn(
    (_input: AttachResolvedTopicInput): Promise<AttachResolvedTopicResult> =>
      Promise.resolve({ kind: 'turn_not_found' }),
  )

  addSession(
    session: TutoringAttemptSessionRecord = {
      id: 'session-1',
      deletedAt: null,
    },
  ) {
    this.sessions.set(session.id, session)
  }

  addTurn(input: Partial<TutoringAttemptSnapshot>) {
    const turn = buildTurn({
      id: `turn-${String(this.turnCounter++)}`,
      ...input,
    })
    this.turns.set(turn.id, turn)
    return turn
  }

  replaceTurn(
    turn: TutoringAttemptSnapshot,
    changes: Partial<TutoringAttemptSnapshot>,
  ) {
    const updated = {
      ...turn,
      ...changes,
    }
    this.turns.set(turn.id, updated)
    return updated
  }

  private findBySessionAndKey(sessionId: string, clientMessageId: string) {
    return (
      Array.from(this.turns.values()).find(
        (turn) =>
          turn.sessionId === sessionId &&
          turn.clientMessageId === clientMessageId,
      ) ?? null
    )
  }
}

function buildService(clock: () => number = () => now.getTime()) {
  const repository = new FakeTurnRepository()
  repository.addSession()
  repository.addSession({ id: 'session-2', deletedAt: null })

  return {
    repository,
    service: new TurnService(repository, clock),
  }
}

function buildTurn(
  input: Partial<TutoringAttemptSnapshot> = {},
): TutoringAttemptSnapshot {
  return {
    id: 'turn-1',
    sessionId: 'session-1',
    topicId: null,
    studentMessageId: null,
    assistantMessageId: null,
    retryOfAttemptId: null,
    clientMessageId: 'key-1',
    requestKind: null,
    teachingStrategy: null,
    status: TutoringAttemptStatus.RECEIVED,
    failureCode: null,
    leaseExpiresAt: null,
    claimedAt: null,
    version: 1,
    safeFallbackUsed: false,
    approvalSource: null,
    approvedCandidateAttempt: null,
    safeFallbackReason: null,
    validationPolicyVersion: null,
    reviewRequired: false,
    createdAt: now,
    completedAt: null,
    ...input,
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

describe('TurnService', () => {
  it('returns CREATED for a new request', async () => {
    const { service } = buildService()

    await expect(
      service.getOrCreate('session-1', 'key-1'),
    ).resolves.toMatchObject({
      outcome: TURN_ACQUISITION_OUTCOME.CREATED,
      turn: {
        sessionId: 'session-1',
        clientMessageId: 'key-1',
      },
    })
  })

  it('starts a new turn with RECEIVED status', async () => {
    const { service } = buildService()

    const result = await service.getOrCreate('session-1', 'key-1')

    expect(result.turn.status).toBe(TutoringAttemptStatus.RECEIVED)
  })

  it('preserves the idempotency key identity', async () => {
    const { service } = buildService()

    const result = await service.getOrCreate('session-1', ' Mixed-Key ')

    expect(result.turn.clientMessageId).toBe(' Mixed-Key ')
  })

  it('returns COMPLETED for an existing completed turn', async () => {
    const { repository, service } = buildService()
    const existing = repository.addTurn({
      status: TutoringAttemptStatus.COMPLETED,
      completedAt: new Date('2026-08-03T12:02:00.000Z'),
    })

    await expect(service.getOrCreate('session-1', 'key-1')).resolves.toEqual({
      outcome: TURN_ACQUISITION_OUTCOME.COMPLETED,
      turn: existing,
    })
  })

  it('does not mutate an existing completed turn', async () => {
    const { repository, service } = buildService()
    const existing = repository.addTurn({
      status: TutoringAttemptStatus.COMPLETED,
      assistantMessageId: 'message-1',
      completedAt: new Date('2026-08-03T12:02:00.000Z'),
    })

    await service.getOrCreate('session-1', 'key-1')

    expect(repository.turns.get(existing.id)).toEqual(existing)
  })

  it.each([
    TutoringAttemptStatus.RECEIVED,
    TutoringAttemptStatus.ANALYZING,
    TutoringAttemptStatus.RETRIEVING,
    TutoringAttemptStatus.DECIDING,
    TutoringAttemptStatus.GENERATING,
    TutoringAttemptStatus.VALIDATING,
    TutoringAttemptStatus.REGENERATING,
  ])('returns ALREADY_PROCESSING for existing %s turns', async (status) => {
    const { repository, service } = buildService()
    const existing = repository.addTurn({ status })

    await expect(service.getOrCreate('session-1', 'key-1')).resolves.toEqual({
      outcome: TURN_ACQUISITION_OUTCOME.ALREADY_PROCESSING,
      code: TURN_ERROR_CODES.ALREADY_PROCESSING,
      turn: existing,
    })
  })

  it('reclaims a stale non-terminal turn as failed', async () => {
    const { repository, service } = buildService()
    const stale = repository.addTurn({
      status: TutoringAttemptStatus.GENERATING,
      createdAt: new Date(now.getTime() - TURN_PROCESSING_STALE_AFTER_MS - 1),
    })

    const result = await service.getOrCreate('session-1', 'key-1')

    expect(result.outcome).toBe(TURN_ACQUISITION_OUTCOME.FAILED)
    expect(result.turn).toMatchObject({
      id: stale.id,
      status: TutoringAttemptStatus.FAILED,
      failureCode: TutoringAttemptFailureCode.PERSISTENCE_FAILED,
    })
    expect(repository.markFailedAtomically).toHaveBeenCalledWith({
      attemptId: stale.id,
      expectedStatus: TutoringAttemptStatus.GENERATING,
      failureCode: TutoringAttemptFailureCode.PERSISTENCE_FAILED,
    })
  })

  it('keeps a fresh non-terminal turn processing', async () => {
    const { repository, service } = buildService()
    const fresh = repository.addTurn({
      status: TutoringAttemptStatus.GENERATING,
      createdAt: new Date(now.getTime() - TURN_PROCESSING_STALE_AFTER_MS + 1),
    })

    await expect(service.getOrCreate('session-1', 'key-1')).resolves.toEqual({
      outcome: TURN_ACQUISITION_OUTCOME.ALREADY_PROCESSING,
      code: TURN_ERROR_CODES.ALREADY_PROCESSING,
      turn: fresh,
    })
    expect(repository.markFailedAtomically).not.toHaveBeenCalled()
  })

  it('maps already-processing acquisition to TURN_ALREADY_PROCESSING', async () => {
    const { repository, service } = buildService()
    repository.addTurn({ status: TutoringAttemptStatus.ANALYZING })

    const result = await service.getOrCreate('session-1', 'key-1')

    expect(result).toMatchObject({
      outcome: TURN_ACQUISITION_OUTCOME.ALREADY_PROCESSING,
      code: TURN_ERROR_CODES.ALREADY_PROCESSING,
    })
  })

  it('returns FAILED for an existing failed turn', async () => {
    const { repository, service } = buildService()
    const existing = repository.addTurn({
      status: TutoringAttemptStatus.FAILED,
      failureCode: TutoringAttemptFailureCode.GENERATION_FAILED,
      completedAt: new Date('2026-08-03T12:03:00.000Z'),
    })

    await expect(service.getOrCreate('session-1', 'key-1')).resolves.toEqual({
      outcome: TURN_ACQUISITION_OUTCOME.FAILED,
      turn: existing,
    })
  })

  it('preserves the existing failure code on failed retry', async () => {
    const { repository, service } = buildService()
    repository.addTurn({
      status: TutoringAttemptStatus.FAILED,
      failureCode: TutoringAttemptFailureCode.RETRIEVAL_FAILED,
    })

    const result = await service.getOrCreate('session-1', 'key-1')

    expect(result.turn.failureCode).toBe(
      TutoringAttemptFailureCode.RETRIEVAL_FAILED,
    )
    expect(repository.markFailedAtomically).not.toHaveBeenCalled()
  })

  it('creates separate turns for different idempotency keys in the same session', async () => {
    const { repository, service } = buildService()

    const first = await service.getOrCreate('session-1', 'key-1')
    const second = await service.getOrCreate('session-1', 'key-2')

    expect(first.turn.id).not.toBe(second.turn.id)
    expect(repository.turns.size).toBe(2)
  })

  it('creates separate turns for the same idempotency key in different sessions', async () => {
    const { repository, service } = buildService()

    const first = await service.getOrCreate('session-1', 'key-1')
    const second = await service.getOrCreate('session-2', 'key-1')

    expect(first.turn.id).not.toBe(second.turn.id)
    expect(repository.turns.size).toBe(2)
  })

  it.each(['', '   '])('rejects blank idempotency key %p', async (key) => {
    const { service } = buildService()

    await expectRejectCode(
      service.getOrCreate('session-1', key),
      TURN_ERROR_CODES.INVALID_REQUEST,
    )
  })

  it('rejects oversized idempotency keys', async () => {
    const { service } = buildService()

    await expectRejectCode(
      service.getOrCreate('session-1', 'x'.repeat(161)),
      TURN_ERROR_CODES.INVALID_REQUEST,
    )
  })

  it('allows a valid non-terminal status transition', async () => {
    const { repository, service } = buildService()
    const turn = repository.addTurn({ status: TutoringAttemptStatus.ANALYZING })

    await expect(
      service.transitionStatus(
        turn.id,
        TutoringAttemptStatus.ANALYZING,
        TutoringAttemptStatus.RETRIEVING,
      ),
    ).resolves.toMatchObject({
      id: turn.id,
      status: TutoringAttemptStatus.RETRIEVING,
    })
  })

  it('changes status exactly once on a successful transition', async () => {
    const { repository, service } = buildService()
    const turn = repository.addTurn({ status: TutoringAttemptStatus.ANALYZING })

    await service.transitionStatus(
      turn.id,
      TutoringAttemptStatus.ANALYZING,
      TutoringAttemptStatus.RETRIEVING,
    )

    expect(repository.transitionStatusAtomically).toHaveBeenCalledTimes(1)
    expect(repository.turns.get(turn.id)?.status).toBe(
      TutoringAttemptStatus.RETRIEVING,
    )
  })

  it('rejects a stale expected status', async () => {
    const { repository, service } = buildService()
    const turn = repository.addTurn({
      status: TutoringAttemptStatus.RETRIEVING,
    })

    await expectRejectCode(
      service.transitionStatus(
        turn.id,
        TutoringAttemptStatus.ANALYZING,
        TutoringAttemptStatus.DECIDING,
      ),
      TURN_ERROR_CODES.STALE_STATUS,
    )
  })

  it('does not mutate on stale transition', async () => {
    const { repository, service } = buildService()
    const turn = repository.addTurn({
      status: TutoringAttemptStatus.RETRIEVING,
    })

    await expect(
      service.transitionStatus(
        turn.id,
        TutoringAttemptStatus.ANALYZING,
        TutoringAttemptStatus.DECIDING,
      ),
    ).rejects.toBeDefined()

    expect(repository.turns.get(turn.id)).toEqual(turn)
  })

  it.each([TutoringAttemptStatus.COMPLETED, TutoringAttemptStatus.FAILED])(
    'rejects transitions from terminal status %s',
    async (status) => {
      const { service } = buildService()

      await expectRejectCode(
        service.transitionStatus(
          'turn-1',
          status,
          TutoringAttemptStatus.ANALYZING,
        ),
        TURN_ERROR_CODES.INVALID_LIFECYCLE_TRANSITION,
      )
    },
  )

  it.each([
    TutoringAttemptStatus.RECEIVED,
    TutoringAttemptStatus.COMPLETED,
    TutoringAttemptStatus.FAILED,
  ])('rejects transition target %s', async (nextStatus) => {
    const { service } = buildService()

    await expectRejectCode(
      service.transitionStatus(
        'turn-1',
        TutoringAttemptStatus.ANALYZING,
        nextStatus,
      ),
      TURN_ERROR_CODES.INVALID_LIFECYCLE_TRANSITION,
    )
  })

  it('rejects no-op status transitions', async () => {
    const { service } = buildService()

    await expectRejectCode(
      service.transitionStatus(
        'turn-1',
        TutoringAttemptStatus.ANALYZING,
        TutoringAttemptStatus.ANALYZING,
      ),
      TURN_ERROR_CODES.INVALID_LIFECYCLE_TRANSITION,
    )
  })

  it('rejects backward transitions while preserving regeneration flow', async () => {
    const { service } = buildService()

    await expectRejectCode(
      service.transitionStatus(
        'turn-1',
        TutoringAttemptStatus.VALIDATING,
        TutoringAttemptStatus.GENERATING,
      ),
      TURN_ERROR_CODES.INVALID_LIFECYCLE_TRANSITION,
    )

    await expect(
      service.transitionStatus(
        'missing-turn',
        TutoringAttemptStatus.REGENERATING,
        TutoringAttemptStatus.GENERATING,
      ),
    ).rejects.toMatchObject({
      response: { code: TURN_ERROR_CODES.TURN_NOT_FOUND },
    })
  })

  it('stores a valid failure code when marking failed', async () => {
    const { repository, service } = buildService()
    const turn = repository.addTurn({
      status: TutoringAttemptStatus.GENERATING,
    })

    const failed = await service.markFailed(
      turn.id,
      TutoringAttemptStatus.GENERATING,
      TutoringAttemptFailureCode.GENERATION_FAILED,
    )

    expect(failed).toMatchObject({
      status: TutoringAttemptStatus.FAILED,
      failureCode: TutoringAttemptFailureCode.GENERATION_FAILED,
    })
    expect(failed.completedAt).not.toBeNull()
  })

  it('atomically requires the expected status when marking failed', async () => {
    const { repository, service } = buildService()
    const turn = repository.addTurn({
      status: TutoringAttemptStatus.VALIDATING,
    })

    await expectRejectCode(
      service.markFailed(
        turn.id,
        TutoringAttemptStatus.GENERATING,
        TutoringAttemptFailureCode.GENERATION_FAILED,
      ),
      TURN_ERROR_CODES.STALE_STATUS,
    )
  })

  it('does not mutate on stale markFailed', async () => {
    const { repository, service } = buildService()
    const turn = repository.addTurn({
      status: TutoringAttemptStatus.VALIDATING,
      failureCode: null,
      completedAt: null,
    })

    await expect(
      service.markFailed(
        turn.id,
        TutoringAttemptStatus.GENERATING,
        TutoringAttemptFailureCode.GENERATION_FAILED,
      ),
    ).rejects.toBeDefined()

    expect(repository.turns.get(turn.id)).toEqual(turn)
  })

  it.each([TutoringAttemptStatus.COMPLETED, TutoringAttemptStatus.FAILED])(
    'rejects failing terminal expected status %s',
    async (status) => {
      const { service } = buildService()

      await expectRejectCode(
        service.markFailed(
          'turn-1',
          status,
          TutoringAttemptFailureCode.PERSISTENCE_FAILED,
        ),
        TURN_ERROR_CODES.INVALID_LIFECYCLE_TRANSITION,
      )
    },
  )

  it('rejects missing sessions', async () => {
    const { service } = buildService()

    await expectRejectCode(
      service.getOrCreate('missing-session', 'key-1'),
      TURN_ERROR_CODES.SESSION_NOT_FOUND,
    )
  })

  it('rejects soft-deleted sessions', async () => {
    const { repository, service } = buildService()
    repository.addSession({
      id: 'deleted-session',
      deletedAt: new Date('2026-08-03T12:04:00.000Z'),
    })

    await expectRejectCode(
      service.getOrCreate('deleted-session', 'key-1'),
      TURN_ERROR_CODES.SESSION_NOT_FOUND,
    )
  })

  it('rejects missing turns', async () => {
    const { service } = buildService()

    await expectRejectCode(
      service.transitionStatus(
        'missing-turn',
        TutoringAttemptStatus.ANALYZING,
        TutoringAttemptStatus.RETRIEVING,
      ),
      TURN_ERROR_CODES.TURN_NOT_FOUND,
    )
  })

  it('rejects unsupported failure codes', async () => {
    const { service } = buildService()

    await expectRejectCode(
      service.markFailed(
        'turn-1',
        TutoringAttemptStatus.GENERATING,
        'BAD_FAILURE_CODE' as TutoringAttemptFailureCode,
      ),
      TURN_ERROR_CODES.INVALID_REQUEST,
    )
  })

  it('normalizes identifiers before linking a student message', async () => {
    const { repository, service } = buildService()
    const linked = repository.addTurn({ studentMessageId: 'message-1' })
    repository.linkStudentMessage.mockResolvedValueOnce({
      kind: 'ok',
      turn: linked,
    })

    await expect(
      service.linkStudentMessage(' turn-1 ', ' message-1 '),
    ).resolves.toBe(linked)
    expect(repository.linkStudentMessage).toHaveBeenCalledWith({
      attemptId: 'turn-1',
      studentMessageId: 'message-1',
    })
  })

  it('maps student-message linkage conflicts to structured turn errors', async () => {
    const { repository, service } = buildService()
    repository.linkStudentMessage.mockResolvedValueOnce({
      kind: 'linkage_conflict',
    })

    await expectRejectCode(
      service.linkStudentMessage('turn-1', 'message-1'),
      TURN_ERROR_CODES.LINKAGE_CONFLICT,
    )
  })

  it('maps resolved-topic scope mismatches to structured turn errors', async () => {
    const { repository, service } = buildService()
    repository.attachResolvedTopic.mockResolvedValueOnce({
      kind: 'course_mismatch',
    })

    await expectRejectCode(
      service.attachResolvedTopic('turn-1', 'message-1', 'topic-1'),
      TURN_ERROR_CODES.SCOPE_MISMATCH,
    )
  })
})
