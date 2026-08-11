import { Inject, Injectable, Optional } from '@nestjs/common'

import {
  TutoringAttemptFailureCode,
  TutoringAttemptStatus,
} from '../../generated/prisma/client'
import {
  invalidTutoringAttemptLifecycleTransitionException,
  invalidTurnRequestException,
  staleTutoringAttemptStatusException,
  turnLinkageConflictException,
  turnMessageNotFoundException,
  turnMessageRoleMismatchException,
  turnNotFoundException,
  turnScopeMismatchException,
  turnSessionNotFoundException,
  turnTopicNotFoundException,
  TURN_ERROR_CODES,
} from './turn.errors'
import { TurnRepository } from './turn.repository'
import type {
  CompleteClassifiedTutorResponseInput,
  CompleteClassifiedTutorResponseResult,
} from './turn.repository'
import {
  TURN_ACQUISITION_OUTCOME,
  type AttachResolvedTopicResult,
  type LinkStudentMessageResult,
  type TurnAcquisitionResult,
  type TutoringAttemptSnapshot,
} from './turn.types'

const MAX_IDEMPOTENCY_KEY_LENGTH = 160

export const TURN_PROCESSING_STALE_AFTER_MS = 5 * 60 * 1000
export const TURN_CLOCK = Symbol('TurnClock')

const NON_TERMINAL_PROCESSING_STATUSES = new Set<TutoringAttemptStatus>([
  TutoringAttemptStatus.RECEIVED,
  TutoringAttemptStatus.ANALYZING,
  TutoringAttemptStatus.RETRIEVING,
  TutoringAttemptStatus.DECIDING,
  TutoringAttemptStatus.GENERATING,
  TutoringAttemptStatus.VALIDATING,
  TutoringAttemptStatus.REGENERATING,
])

const TERMINAL_STATUSES = new Set<TutoringAttemptStatus>([
  TutoringAttemptStatus.COMPLETED,
  TutoringAttemptStatus.FAILED,
])

const STATUS_ORDER = new Map<TutoringAttemptStatus, number>([
  [TutoringAttemptStatus.RECEIVED, 0],
  [TutoringAttemptStatus.ANALYZING, 1],
  [TutoringAttemptStatus.DECIDING, 2],
  [TutoringAttemptStatus.RETRIEVING, 3],
  [TutoringAttemptStatus.GENERATING, 4],
  [TutoringAttemptStatus.VALIDATING, 5],
  [TutoringAttemptStatus.REGENERATING, 6],
])

@Injectable()
export class TurnService {
  constructor(
    private readonly turnRepository: TurnRepository,
    @Optional()
    @Inject(TURN_CLOCK)
    private readonly clock: () => number = () => Date.now(),
  ) {}

  async getOrCreate(
    sessionId: string,
    clientMessageId: string,
  ): Promise<TurnAcquisitionResult> {
    const normalizedSessionId = normalizeRequiredIdentifier(
      sessionId,
      'sessionId',
    )
    validateIdempotencyKey(clientMessageId)
    await this.assertSessionExists(normalizedSessionId)

    const created = await this.turnRepository.createTurn(
      normalizedSessionId,
      clientMessageId,
    )

    if (created !== null) {
      return {
        outcome: TURN_ACQUISITION_OUTCOME.CREATED,
        turn: created,
      }
    }

    const existing = await this.turnRepository.findBySessionAndClientMessageId(
      normalizedSessionId,
      clientMessageId,
    )

    if (existing !== null) {
      const recovered = await this.recoverStaleTurn(existing)
      return acquisitionResultForExistingTurn(recovered ?? existing)
    }

    await this.assertSessionExists(normalizedSessionId)
    throw turnNotFoundException()
  }

  async transitionStatus(
    attemptId: string,
    expectedStatus: TutoringAttemptStatus,
    nextStatus: TutoringAttemptStatus,
  ): Promise<TutoringAttemptSnapshot> {
    const normalizedTurnId = normalizeRequiredIdentifier(attemptId, 'attemptId')
    validateTransition(expectedStatus, nextStatus)

    const updated = await this.turnRepository.transitionStatusAtomically({
      attemptId: normalizedTurnId,
      expectedStatus,
      nextStatus,
    })

    if (updated !== null) {
      return updated
    }

    return await this.rejectStaleOrMissingTurn(normalizedTurnId)
  }

  async markFailed(
    attemptId: string,
    expectedStatus: TutoringAttemptStatus,
    failureCode: TutoringAttemptFailureCode,
  ): Promise<TutoringAttemptSnapshot> {
    const normalizedTurnId = normalizeRequiredIdentifier(attemptId, 'attemptId')
    validateFailureCode(failureCode)

    if (TERMINAL_STATUSES.has(expectedStatus)) {
      throw invalidTutoringAttemptLifecycleTransitionException()
    }

    const updated = await this.turnRepository.markFailedAtomically({
      attemptId: normalizedTurnId,
      expectedStatus,
      failureCode,
    })

    if (updated !== null) {
      return updated
    }

    return await this.rejectStaleOrMissingTurn(normalizedTurnId)
  }

  completeClassifiedResponse(
    input: CompleteClassifiedTutorResponseInput,
  ): Promise<CompleteClassifiedTutorResponseResult> {
    return this.turnRepository.completeClassifiedResponse(input)
  }

  async linkStudentMessage(
    attemptId: string,
    studentMessageId: string,
  ): Promise<TutoringAttemptSnapshot> {
    const input = {
      attemptId: normalizeRequiredIdentifier(attemptId, 'attemptId'),
      studentMessageId: normalizeRequiredIdentifier(
        studentMessageId,
        'studentMessageId',
      ),
    }

    return mapLinkStudentMessageResult(
      await this.turnRepository.linkStudentMessage(input),
    )
  }

  async attachResolvedTopic(
    attemptId: string,
    studentMessageId: string,
    topicId: string,
  ): Promise<TutoringAttemptSnapshot> {
    const input = {
      attemptId: normalizeRequiredIdentifier(attemptId, 'attemptId'),
      studentMessageId: normalizeRequiredIdentifier(
        studentMessageId,
        'studentMessageId',
      ),
      topicId: normalizeRequiredIdentifier(topicId, 'topicId'),
    }

    return mapAttachResolvedTopicResult(
      await this.turnRepository.attachResolvedTopic(input),
    )
  }

  private async assertSessionExists(sessionId: string): Promise<void> {
    const session =
      await this.turnRepository.findAuthoritativeSession(sessionId)

    if (session?.deletedAt !== null) {
      throw turnSessionNotFoundException()
    }
  }

  private async recoverStaleTurn(
    turn: TutoringAttemptSnapshot,
  ): Promise<TutoringAttemptSnapshot | null> {
    if (
      !NON_TERMINAL_PROCESSING_STATUSES.has(turn.status) ||
      this.clock() - turn.createdAt.getTime() < TURN_PROCESSING_STALE_AFTER_MS
    ) {
      return null
    }

    return this.turnRepository.markFailedAtomically({
      attemptId: turn.id,
      expectedStatus: turn.status,
      failureCode: TutoringAttemptFailureCode.PERSISTENCE_FAILED,
    })
  }

  private async rejectStaleOrMissingTurn(attemptId: string): Promise<never> {
    const turn = await this.turnRepository.findById(attemptId)

    if (turn === null) {
      throw turnNotFoundException()
    }

    if (TERMINAL_STATUSES.has(turn.status)) {
      throw invalidTutoringAttemptLifecycleTransitionException()
    }

    throw staleTutoringAttemptStatusException()
  }
}

function acquisitionResultForExistingTurn(
  turn: TutoringAttemptSnapshot,
): TurnAcquisitionResult {
  if (turn.status === TutoringAttemptStatus.COMPLETED) {
    return {
      outcome: TURN_ACQUISITION_OUTCOME.COMPLETED,
      turn,
    }
  }

  if (turn.status === TutoringAttemptStatus.FAILED) {
    return {
      outcome: TURN_ACQUISITION_OUTCOME.FAILED,
      turn,
    }
  }

  return {
    outcome: TURN_ACQUISITION_OUTCOME.ALREADY_PROCESSING,
    code: TURN_ERROR_CODES.ALREADY_PROCESSING,
    turn,
  }
}

function normalizeRequiredIdentifier(value: string, field: string): string {
  const normalized = value.trim()

  if (normalized.length === 0) {
    throw invalidTurnRequestException([
      {
        field,
        message: 'Identifier is required',
      },
    ])
  }

  return normalized
}

function validateIdempotencyKey(clientMessageId: string): void {
  if (
    clientMessageId.length === 0 ||
    clientMessageId.trim().length === 0 ||
    clientMessageId.length > MAX_IDEMPOTENCY_KEY_LENGTH
  ) {
    throw invalidTurnRequestException([
      {
        field: 'clientMessageId',
        message: `Idempotency key must be between 1 and ${String(
          MAX_IDEMPOTENCY_KEY_LENGTH,
        )} characters`,
      },
    ])
  }
}

function validateTransition(
  expectedStatus: TutoringAttemptStatus,
  nextStatus: TutoringAttemptStatus,
): void {
  if (
    TERMINAL_STATUSES.has(expectedStatus) ||
    nextStatus === TutoringAttemptStatus.RECEIVED ||
    nextStatus === TutoringAttemptStatus.COMPLETED ||
    nextStatus === TutoringAttemptStatus.FAILED ||
    expectedStatus === nextStatus
  ) {
    throw invalidTutoringAttemptLifecycleTransitionException()
  }

  if (expectedStatus === TutoringAttemptStatus.REGENERATING) {
    if (nextStatus !== TutoringAttemptStatus.GENERATING) {
      throw invalidTutoringAttemptLifecycleTransitionException()
    }

    return
  }

  const expectedOrder = STATUS_ORDER.get(expectedStatus)
  const nextOrder = STATUS_ORDER.get(nextStatus)

  if (expectedOrder === undefined || nextOrder === undefined) {
    throw invalidTutoringAttemptLifecycleTransitionException()
  }

  if (nextOrder <= expectedOrder) {
    throw invalidTutoringAttemptLifecycleTransitionException()
  }

  if (!NON_TERMINAL_PROCESSING_STATUSES.has(nextStatus)) {
    throw invalidTutoringAttemptLifecycleTransitionException()
  }
}

function validateFailureCode(failureCode: TutoringAttemptFailureCode): void {
  if (!Object.values(TutoringAttemptFailureCode).includes(failureCode)) {
    throw invalidTurnRequestException([
      {
        field: 'failureCode',
        message: 'Failure code is not supported',
      },
    ])
  }
}

function mapLinkStudentMessageResult(
  result: LinkStudentMessageResult,
): TutoringAttemptSnapshot {
  switch (result.kind) {
    case 'ok':
      return result.turn
    case 'turn_not_found':
      throw turnNotFoundException()
    case 'message_not_found':
      throw turnMessageNotFoundException()
    case 'message_role_mismatch':
      throw turnMessageRoleMismatchException()
    case 'session_mismatch':
      throw turnScopeMismatchException()
    case 'linkage_conflict':
      throw turnLinkageConflictException()
  }
}

function mapAttachResolvedTopicResult(
  result: AttachResolvedTopicResult,
): TutoringAttemptSnapshot {
  switch (result.kind) {
    case 'ok':
      return result.turn
    case 'turn_not_found':
      throw turnNotFoundException()
    case 'message_not_found':
      throw turnMessageNotFoundException()
    case 'topic_not_found':
      throw turnTopicNotFoundException()
    case 'message_role_mismatch':
      throw turnMessageRoleMismatchException()
    case 'session_mismatch':
    case 'course_mismatch':
      throw turnScopeMismatchException()
    case 'linkage_conflict':
      throw turnLinkageConflictException()
  }
}
