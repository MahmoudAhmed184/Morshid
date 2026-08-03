import { Injectable } from '@nestjs/common'

import {
  TutorTurnFailureCode,
  TutorTurnStatus,
} from '../../generated/prisma/client'
import {
  invalidTutorTurnLifecycleTransitionException,
  invalidTurnRequestException,
  staleTutorTurnStatusException,
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
import {
  TURN_ACQUISITION_OUTCOME,
  type AttachResolvedTopicResult,
  type LinkStudentMessageResult,
  type TurnAcquisitionResult,
  type TutorTurnSnapshot,
} from './turn.types'

const MAX_IDEMPOTENCY_KEY_LENGTH = 160

const NON_TERMINAL_PROCESSING_STATUSES = new Set<TutorTurnStatus>([
  TutorTurnStatus.RECEIVED,
  TutorTurnStatus.ANALYZING,
  TutorTurnStatus.RETRIEVING,
  TutorTurnStatus.DECIDING,
  TutorTurnStatus.GENERATING,
  TutorTurnStatus.VALIDATING,
  TutorTurnStatus.REGENERATING,
])

const TERMINAL_STATUSES = new Set<TutorTurnStatus>([
  TutorTurnStatus.COMPLETED,
  TutorTurnStatus.FAILED,
])

const STATUS_ORDER = new Map<TutorTurnStatus, number>([
  [TutorTurnStatus.RECEIVED, 0],
  [TutorTurnStatus.ANALYZING, 1],
  [TutorTurnStatus.RETRIEVING, 2],
  [TutorTurnStatus.DECIDING, 3],
  [TutorTurnStatus.GENERATING, 4],
  [TutorTurnStatus.VALIDATING, 5],
  [TutorTurnStatus.REGENERATING, 6],
])

@Injectable()
export class TurnService {
  constructor(private readonly turnRepository: TurnRepository) {}

  async getOrCreate(
    sessionId: string,
    idempotencyKey: string,
  ): Promise<TurnAcquisitionResult> {
    const normalizedSessionId = normalizeRequiredIdentifier(
      sessionId,
      'sessionId',
    )
    validateIdempotencyKey(idempotencyKey)
    await this.assertSessionExists(normalizedSessionId)

    const created = await this.turnRepository.createTurn(
      normalizedSessionId,
      idempotencyKey,
    )

    if (created !== null) {
      return {
        outcome: TURN_ACQUISITION_OUTCOME.CREATED,
        turn: created,
      }
    }

    const existing = await this.turnRepository.findBySessionAndIdempotencyKey(
      normalizedSessionId,
      idempotencyKey,
    )

    if (existing !== null) {
      return acquisitionResultForExistingTurn(existing)
    }

    await this.assertSessionExists(normalizedSessionId)
    throw turnNotFoundException()
  }

  async transitionStatus(
    turnId: string,
    expectedStatus: TutorTurnStatus,
    nextStatus: TutorTurnStatus,
  ): Promise<TutorTurnSnapshot> {
    const normalizedTurnId = normalizeRequiredIdentifier(turnId, 'turnId')
    validateTransition(expectedStatus, nextStatus)

    const updated = await this.turnRepository.transitionStatusAtomically({
      turnId: normalizedTurnId,
      expectedStatus,
      nextStatus,
    })

    if (updated !== null) {
      return updated
    }

    return await this.rejectStaleOrMissingTurn(normalizedTurnId)
  }

  async markFailed(
    turnId: string,
    expectedStatus: TutorTurnStatus,
    failureCode: TutorTurnFailureCode,
  ): Promise<TutorTurnSnapshot> {
    const normalizedTurnId = normalizeRequiredIdentifier(turnId, 'turnId')
    validateFailureCode(failureCode)

    if (TERMINAL_STATUSES.has(expectedStatus)) {
      throw invalidTutorTurnLifecycleTransitionException()
    }

    const updated = await this.turnRepository.markFailedAtomically({
      turnId: normalizedTurnId,
      expectedStatus,
      failureCode,
    })

    if (updated !== null) {
      return updated
    }

    return await this.rejectStaleOrMissingTurn(normalizedTurnId)
  }

  async linkStudentMessage(
    turnId: string,
    studentMessageId: string,
  ): Promise<TutorTurnSnapshot> {
    const input = {
      turnId: normalizeRequiredIdentifier(turnId, 'turnId'),
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
    turnId: string,
    studentMessageId: string,
    topicId: string,
  ): Promise<TutorTurnSnapshot> {
    const input = {
      turnId: normalizeRequiredIdentifier(turnId, 'turnId'),
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

  private async rejectStaleOrMissingTurn(turnId: string): Promise<never> {
    const turn = await this.turnRepository.findById(turnId)

    if (turn === null) {
      throw turnNotFoundException()
    }

    if (TERMINAL_STATUSES.has(turn.status)) {
      throw invalidTutorTurnLifecycleTransitionException()
    }

    throw staleTutorTurnStatusException()
  }
}

function acquisitionResultForExistingTurn(
  turn: TutorTurnSnapshot,
): TurnAcquisitionResult {
  if (turn.status === TutorTurnStatus.COMPLETED) {
    return {
      outcome: TURN_ACQUISITION_OUTCOME.COMPLETED,
      turn,
    }
  }

  if (turn.status === TutorTurnStatus.FAILED) {
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

function validateIdempotencyKey(idempotencyKey: string): void {
  if (
    idempotencyKey.length === 0 ||
    idempotencyKey.trim().length === 0 ||
    idempotencyKey.length > MAX_IDEMPOTENCY_KEY_LENGTH
  ) {
    throw invalidTurnRequestException([
      {
        field: 'idempotencyKey',
        message: `Idempotency key must be between 1 and ${String(
          MAX_IDEMPOTENCY_KEY_LENGTH,
        )} characters`,
      },
    ])
  }
}

function validateTransition(
  expectedStatus: TutorTurnStatus,
  nextStatus: TutorTurnStatus,
): void {
  if (
    TERMINAL_STATUSES.has(expectedStatus) ||
    nextStatus === TutorTurnStatus.RECEIVED ||
    nextStatus === TutorTurnStatus.COMPLETED ||
    nextStatus === TutorTurnStatus.FAILED ||
    expectedStatus === nextStatus
  ) {
    throw invalidTutorTurnLifecycleTransitionException()
  }

  if (expectedStatus === TutorTurnStatus.REGENERATING) {
    if (nextStatus !== TutorTurnStatus.GENERATING) {
      throw invalidTutorTurnLifecycleTransitionException()
    }

    return
  }

  const expectedOrder = STATUS_ORDER.get(expectedStatus)
  const nextOrder = STATUS_ORDER.get(nextStatus)

  if (expectedOrder === undefined || nextOrder === undefined) {
    throw invalidTutorTurnLifecycleTransitionException()
  }

  if (nextOrder <= expectedOrder) {
    throw invalidTutorTurnLifecycleTransitionException()
  }

  if (!NON_TERMINAL_PROCESSING_STATUSES.has(nextStatus)) {
    throw invalidTutorTurnLifecycleTransitionException()
  }
}

function validateFailureCode(failureCode: TutorTurnFailureCode): void {
  if (!Object.values(TutorTurnFailureCode).includes(failureCode)) {
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
): TutorTurnSnapshot {
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
): TutorTurnSnapshot {
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
