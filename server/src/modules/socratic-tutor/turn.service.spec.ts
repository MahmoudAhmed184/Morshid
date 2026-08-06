import {
  TutorTurnFailureCode,
  TutorTurnStatus,
} from '../../generated/prisma/client'
import { TURN_ERROR_CODES } from './turn.errors'
import { TurnRepository } from './turn.repository'
import { TurnService } from './turn.service'
import {
  TURN_ACQUISITION_OUTCOME,
  type AttachResolvedTopicInput,
  type AttachResolvedTopicResult,
  type LinkStudentMessageInput,
  type LinkStudentMessageResult,
  type TutorTurnSessionRecord,
  type TutorTurnSnapshot,
} from './turn.types'

const now = new Date('2026-08-03T12:00:00.000Z')

class FakeTurnRepository extends TurnRepository {
  private turnCounter = 1
  readonly sessions = new Map<string, TutorTurnSessionRecord>()
  readonly turns = new Map<string, TutorTurnSnapshot>()

  readonly findAuthoritativeSession = jest.fn((sessionId: string) =>
    Promise.resolve(this.sessions.get(sessionId) ?? null),
  )

  readonly createTurn = jest.fn((sessionId: string, idempotencyKey: string) => {
    if (!this.sessions.has(sessionId)) {
      return Promise.resolve(null)
    }

    if (this.findBySessionAndKey(sessionId, idempotencyKey) !== null) {
      return Promise.resolve(null)
    }

    return Promise.resolve(this.addTurn({ sessionId, idempotencyKey }))
  })

  readonly findBySessionAndIdempotencyKey = jest.fn(
    (sessionId: string, idempotencyKey: string) =>
      Promise.resolve(this.findBySessionAndKey(sessionId, idempotencyKey)),
  )

  readonly findById = jest.fn((turnId: string) =>
    Promise.resolve(this.turns.get(turnId) ?? null),
  )

  readonly completeApprovedResponse = jest.fn(() =>
    Promise.resolve({ kind: 'relationship_mismatch' as const }),
  )

  readonly transitionStatusAtomically = jest.fn(
    (input: {
      turnId: string
      expectedStatus: TutorTurnStatus
      nextStatus: TutorTurnStatus
    }) => {
      const turn = this.turns.get(input.turnId)

      if (turn?.status !== input.expectedStatus) {
        return Promise.resolve(null)
      }

      const updated = this.replaceTurn(turn, { status: input.nextStatus })
      return Promise.resolve(updated)
    },
  )

  readonly markFailedAtomically = jest.fn(
    (input: {
      turnId: string
      expectedStatus: TutorTurnStatus
      failureCode: TutorTurnFailureCode
    }) => {
      const turn = this.turns.get(input.turnId)

      if (turn?.status !== input.expectedStatus) {
        return Promise.resolve(null)
      }

      const updated = this.replaceTurn(turn, {
        status: TutorTurnStatus.FAILED,
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
    session: TutorTurnSessionRecord = { id: 'session-1', deletedAt: null },
  ) {
    this.sessions.set(session.id, session)
  }

  addTurn(input: Partial<TutorTurnSnapshot>) {
    const turn = buildTurn({
      id: `turn-${String(this.turnCounter++)}`,
      ...input,
    })
    this.turns.set(turn.id, turn)
    return turn
  }

  replaceTurn(turn: TutorTurnSnapshot, changes: Partial<TutorTurnSnapshot>) {
    const updated = {
      ...turn,
      ...changes,
    }
    this.turns.set(turn.id, updated)
    return updated
  }

  private findBySessionAndKey(sessionId: string, idempotencyKey: string) {
    return (
      Array.from(this.turns.values()).find(
        (turn) =>
          turn.sessionId === sessionId &&
          turn.idempotencyKey === idempotencyKey,
      ) ?? null
    )
  }
}

function buildService() {
  const repository = new FakeTurnRepository()
  repository.addSession()
  repository.addSession({ id: 'session-2', deletedAt: null })

  return {
    repository,
    service: new TurnService(repository),
  }
}

function buildTurn(input: Partial<TutorTurnSnapshot> = {}): TutorTurnSnapshot {
  return {
    id: 'turn-1',
    sessionId: 'session-1',
    topicId: null,
    studentMessageId: null,
    approvedTutorMessageId: null,
    idempotencyKey: 'key-1',
    status: TutorTurnStatus.RECEIVED,
    failureCode: null,
    safeFallbackUsed: false,
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
        idempotencyKey: 'key-1',
      },
    })
  })

  it('starts a new turn with RECEIVED status', async () => {
    const { service } = buildService()

    const result = await service.getOrCreate('session-1', 'key-1')

    expect(result.turn.status).toBe(TutorTurnStatus.RECEIVED)
  })

  it('preserves the idempotency key identity', async () => {
    const { service } = buildService()

    const result = await service.getOrCreate('session-1', ' Mixed-Key ')

    expect(result.turn.idempotencyKey).toBe(' Mixed-Key ')
  })

  it('returns COMPLETED for an existing completed turn', async () => {
    const { repository, service } = buildService()
    const existing = repository.addTurn({
      status: TutorTurnStatus.COMPLETED,
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
      status: TutorTurnStatus.COMPLETED,
      approvedTutorMessageId: 'message-1',
      completedAt: new Date('2026-08-03T12:02:00.000Z'),
    })

    await service.getOrCreate('session-1', 'key-1')

    expect(repository.turns.get(existing.id)).toEqual(existing)
  })

  it.each([
    TutorTurnStatus.RECEIVED,
    TutorTurnStatus.ANALYZING,
    TutorTurnStatus.RETRIEVING,
    TutorTurnStatus.DECIDING,
    TutorTurnStatus.GENERATING,
    TutorTurnStatus.VALIDATING,
    TutorTurnStatus.REGENERATING,
  ])('returns ALREADY_PROCESSING for existing %s turns', async (status) => {
    const { repository, service } = buildService()
    const existing = repository.addTurn({ status })

    await expect(service.getOrCreate('session-1', 'key-1')).resolves.toEqual({
      outcome: TURN_ACQUISITION_OUTCOME.ALREADY_PROCESSING,
      code: TURN_ERROR_CODES.ALREADY_PROCESSING,
      turn: existing,
    })
  })

  it('maps already-processing acquisition to TURN_ALREADY_PROCESSING', async () => {
    const { repository, service } = buildService()
    repository.addTurn({ status: TutorTurnStatus.ANALYZING })

    const result = await service.getOrCreate('session-1', 'key-1')

    expect(result).toMatchObject({
      outcome: TURN_ACQUISITION_OUTCOME.ALREADY_PROCESSING,
      code: TURN_ERROR_CODES.ALREADY_PROCESSING,
    })
  })

  it('returns FAILED for an existing failed turn', async () => {
    const { repository, service } = buildService()
    const existing = repository.addTurn({
      status: TutorTurnStatus.FAILED,
      failureCode: TutorTurnFailureCode.GENERATION_FAILED,
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
      status: TutorTurnStatus.FAILED,
      failureCode: TutorTurnFailureCode.RETRIEVAL_FAILED,
    })

    const result = await service.getOrCreate('session-1', 'key-1')

    expect(result.turn.failureCode).toBe(TutorTurnFailureCode.RETRIEVAL_FAILED)
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
    const turn = repository.addTurn({ status: TutorTurnStatus.ANALYZING })

    await expect(
      service.transitionStatus(
        turn.id,
        TutorTurnStatus.ANALYZING,
        TutorTurnStatus.RETRIEVING,
      ),
    ).resolves.toMatchObject({
      id: turn.id,
      status: TutorTurnStatus.RETRIEVING,
    })
  })

  it('changes status exactly once on a successful transition', async () => {
    const { repository, service } = buildService()
    const turn = repository.addTurn({ status: TutorTurnStatus.ANALYZING })

    await service.transitionStatus(
      turn.id,
      TutorTurnStatus.ANALYZING,
      TutorTurnStatus.RETRIEVING,
    )

    expect(repository.transitionStatusAtomically).toHaveBeenCalledTimes(1)
    expect(repository.turns.get(turn.id)?.status).toBe(
      TutorTurnStatus.RETRIEVING,
    )
  })

  it('rejects a stale expected status', async () => {
    const { repository, service } = buildService()
    const turn = repository.addTurn({ status: TutorTurnStatus.RETRIEVING })

    await expectRejectCode(
      service.transitionStatus(
        turn.id,
        TutorTurnStatus.ANALYZING,
        TutorTurnStatus.DECIDING,
      ),
      TURN_ERROR_CODES.STALE_STATUS,
    )
  })

  it('does not mutate on stale transition', async () => {
    const { repository, service } = buildService()
    const turn = repository.addTurn({ status: TutorTurnStatus.RETRIEVING })

    await expect(
      service.transitionStatus(
        turn.id,
        TutorTurnStatus.ANALYZING,
        TutorTurnStatus.DECIDING,
      ),
    ).rejects.toBeDefined()

    expect(repository.turns.get(turn.id)).toEqual(turn)
  })

  it.each([TutorTurnStatus.COMPLETED, TutorTurnStatus.FAILED])(
    'rejects transitions from terminal status %s',
    async (status) => {
      const { service } = buildService()

      await expectRejectCode(
        service.transitionStatus('turn-1', status, TutorTurnStatus.ANALYZING),
        TURN_ERROR_CODES.INVALID_LIFECYCLE_TRANSITION,
      )
    },
  )

  it.each([
    TutorTurnStatus.RECEIVED,
    TutorTurnStatus.COMPLETED,
    TutorTurnStatus.FAILED,
  ])('rejects transition target %s', async (nextStatus) => {
    const { service } = buildService()

    await expectRejectCode(
      service.transitionStatus('turn-1', TutorTurnStatus.ANALYZING, nextStatus),
      TURN_ERROR_CODES.INVALID_LIFECYCLE_TRANSITION,
    )
  })

  it('rejects no-op status transitions', async () => {
    const { service } = buildService()

    await expectRejectCode(
      service.transitionStatus(
        'turn-1',
        TutorTurnStatus.ANALYZING,
        TutorTurnStatus.ANALYZING,
      ),
      TURN_ERROR_CODES.INVALID_LIFECYCLE_TRANSITION,
    )
  })

  it('rejects backward transitions while preserving regeneration flow', async () => {
    const { service } = buildService()

    await expectRejectCode(
      service.transitionStatus(
        'turn-1',
        TutorTurnStatus.VALIDATING,
        TutorTurnStatus.GENERATING,
      ),
      TURN_ERROR_CODES.INVALID_LIFECYCLE_TRANSITION,
    )

    await expect(
      service.transitionStatus(
        'missing-turn',
        TutorTurnStatus.REGENERATING,
        TutorTurnStatus.GENERATING,
      ),
    ).rejects.toMatchObject({
      response: { code: TURN_ERROR_CODES.TURN_NOT_FOUND },
    })
  })

  it('stores a valid failure code when marking failed', async () => {
    const { repository, service } = buildService()
    const turn = repository.addTurn({ status: TutorTurnStatus.GENERATING })

    const failed = await service.markFailed(
      turn.id,
      TutorTurnStatus.GENERATING,
      TutorTurnFailureCode.GENERATION_FAILED,
    )

    expect(failed).toMatchObject({
      status: TutorTurnStatus.FAILED,
      failureCode: TutorTurnFailureCode.GENERATION_FAILED,
    })
    expect(failed.completedAt).not.toBeNull()
  })

  it('atomically requires the expected status when marking failed', async () => {
    const { repository, service } = buildService()
    const turn = repository.addTurn({ status: TutorTurnStatus.VALIDATING })

    await expectRejectCode(
      service.markFailed(
        turn.id,
        TutorTurnStatus.GENERATING,
        TutorTurnFailureCode.GENERATION_FAILED,
      ),
      TURN_ERROR_CODES.STALE_STATUS,
    )
  })

  it('does not mutate on stale markFailed', async () => {
    const { repository, service } = buildService()
    const turn = repository.addTurn({
      status: TutorTurnStatus.VALIDATING,
      failureCode: null,
      completedAt: null,
    })

    await expect(
      service.markFailed(
        turn.id,
        TutorTurnStatus.GENERATING,
        TutorTurnFailureCode.GENERATION_FAILED,
      ),
    ).rejects.toBeDefined()

    expect(repository.turns.get(turn.id)).toEqual(turn)
  })

  it.each([TutorTurnStatus.COMPLETED, TutorTurnStatus.FAILED])(
    'rejects failing terminal expected status %s',
    async (status) => {
      const { service } = buildService()

      await expectRejectCode(
        service.markFailed(
          'turn-1',
          status,
          TutorTurnFailureCode.PERSISTENCE_FAILED,
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
        TutorTurnStatus.ANALYZING,
        TutorTurnStatus.RETRIEVING,
      ),
      TURN_ERROR_CODES.TURN_NOT_FOUND,
    )
  })

  it('rejects unsupported failure codes', async () => {
    const { service } = buildService()

    await expectRejectCode(
      service.markFailed(
        'turn-1',
        TutorTurnStatus.GENERATING,
        'BAD_FAILURE_CODE' as TutorTurnFailureCode,
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
      turnId: 'turn-1',
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
