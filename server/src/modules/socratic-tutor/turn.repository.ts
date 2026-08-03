import { Injectable } from '@nestjs/common'

import {
  Prisma,
  TutorTurnFailureCode,
  TutorTurnStatus,
} from '../../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import type { TutorTurnSessionRecord, TutorTurnSnapshot } from './turn.types'

export abstract class TurnRepository {
  abstract findAuthoritativeSession(
    sessionId: string,
  ): Promise<TutorTurnSessionRecord | null>

  abstract createTurn(
    sessionId: string,
    idempotencyKey: string,
  ): Promise<TutorTurnSnapshot | null>

  abstract findBySessionAndIdempotencyKey(
    sessionId: string,
    idempotencyKey: string,
  ): Promise<TutorTurnSnapshot | null>

  abstract findById(turnId: string): Promise<TutorTurnSnapshot | null>

  abstract transitionStatusAtomically(input: {
    turnId: string
    expectedStatus: TutorTurnStatus
    nextStatus: TutorTurnStatus
  }): Promise<TutorTurnSnapshot | null>

  abstract markFailedAtomically(input: {
    turnId: string
    expectedStatus: TutorTurnStatus
    failureCode: TutorTurnFailureCode
  }): Promise<TutorTurnSnapshot | null>
}

export const tutorTurnSelect = {
  id: true,
  sessionId: true,
  topicId: true,
  studentMessageId: true,
  approvedTutorMessageId: true,
  idempotencyKey: true,
  status: true,
  failureCode: true,
  safeFallbackUsed: true,
  createdAt: true,
  completedAt: true,
} satisfies Prisma.TutorTurnSelect

@Injectable()
export class PrismaTurnRepository extends TurnRepository {
  constructor(private readonly prismaService: PrismaService) {
    super()
  }

  findAuthoritativeSession(
    sessionId: string,
  ): Promise<TutorTurnSessionRecord | null> {
    return this.prismaService.chatSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        deletedAt: true,
      },
    })
  }

  async createTurn(
    sessionId: string,
    idempotencyKey: string,
  ): Promise<TutorTurnSnapshot | null> {
    return this.prismaService.tutorTurn
      .create({
        data: {
          sessionId,
          idempotencyKey,
        },
        select: tutorTurnSelect,
      })
      .catch((error: unknown) => {
        if (
          isUniqueConstraintError(error) ||
          isForeignKeyConstraintError(error)
        ) {
          return null
        }

        throw error
      })
  }

  findBySessionAndIdempotencyKey(
    sessionId: string,
    idempotencyKey: string,
  ): Promise<TutorTurnSnapshot | null> {
    return this.prismaService.tutorTurn.findUnique({
      where: {
        sessionId_idempotencyKey: {
          sessionId,
          idempotencyKey,
        },
      },
      select: tutorTurnSelect,
    })
  }

  findById(turnId: string): Promise<TutorTurnSnapshot | null> {
    return this.prismaService.tutorTurn.findUnique({
      where: { id: turnId },
      select: tutorTurnSelect,
    })
  }

  async transitionStatusAtomically(input: {
    turnId: string
    expectedStatus: TutorTurnStatus
    nextStatus: TutorTurnStatus
  }): Promise<TutorTurnSnapshot | null> {
    const updated = await this.prismaService.$queryRaw<TutorTurnSnapshot[]>`
      UPDATE "tutor_turns"
      SET "status" = ${input.nextStatus}::tutor_turn_status
      WHERE "id" = ${input.turnId}::uuid
        AND "status" = ${input.expectedStatus}::tutor_turn_status
      RETURNING ${tutorTurnReturningSql}
    `

    return updated[0] ?? null
  }

  async markFailedAtomically(input: {
    turnId: string
    expectedStatus: TutorTurnStatus
    failureCode: TutorTurnFailureCode
  }): Promise<TutorTurnSnapshot | null> {
    const updated = await this.prismaService.$queryRaw<TutorTurnSnapshot[]>`
      UPDATE "tutor_turns"
      SET
        "status" = ${TutorTurnStatus.FAILED}::tutor_turn_status,
        "failure_code" = ${input.failureCode}::tutor_turn_failure_code,
        "completed_at" = CURRENT_TIMESTAMP
      WHERE "id" = ${input.turnId}::uuid
        AND "status" = ${input.expectedStatus}::tutor_turn_status
      RETURNING ${tutorTurnReturningSql}
    `

    return updated[0] ?? null
  }
}

const tutorTurnReturningSql = Prisma.sql`
  "id"::text AS "id",
  "session_id"::text AS "sessionId",
  "topic_id"::text AS "topicId",
  "student_message_id"::text AS "studentMessageId",
  "approved_tutor_message_id"::text AS "approvedTutorMessageId",
  "idempotency_key" AS "idempotencyKey",
  "status",
  "failure_code" AS "failureCode",
  "safe_fallback_used" AS "safeFallbackUsed",
  "created_at" AS "createdAt",
  "completed_at" AS "completedAt"
`

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  )
}

function isForeignKeyConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2003'
  )
}
