import { Injectable } from '@nestjs/common'

import {
  MessageRole,
  Prisma,
  TutorTurnFailureCode,
  TutorTurnStatus,
} from '../../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import type {
  AttachResolvedTopicInput,
  AttachResolvedTopicResult,
  LinkStudentMessageInput,
  LinkStudentMessageResult,
  TutorTurnSessionRecord,
  TutorTurnSnapshot,
} from './turn.types'

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

  abstract linkStudentMessage(
    input: LinkStudentMessageInput,
  ): Promise<LinkStudentMessageResult>

  abstract attachResolvedTopic(
    input: AttachResolvedTopicInput,
  ): Promise<AttachResolvedTopicResult>
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

  linkStudentMessage(
    input: LinkStudentMessageInput,
  ): Promise<LinkStudentMessageResult> {
    return this.prismaService.$transaction(async (tx) => {
      const turn = await tx.tutorTurn.findUnique({
        where: { id: input.turnId },
        select: {
          id: true,
          sessionId: true,
          studentMessageId: true,
        },
      })
      if (turn === null) {
        return { kind: 'turn_not_found' }
      }

      const message = await tx.message.findUnique({
        where: { id: input.studentMessageId },
        select: {
          id: true,
          sessionId: true,
          role: true,
          turnId: true,
        },
      })
      if (message === null) {
        return { kind: 'message_not_found' }
      }
      if (message.role !== MessageRole.STUDENT) {
        return { kind: 'message_role_mismatch' }
      }
      if (message.sessionId !== turn.sessionId) {
        return { kind: 'session_mismatch' }
      }
      if (
        turn.studentMessageId !== null &&
        turn.studentMessageId !== message.id
      ) {
        return { kind: 'linkage_conflict' }
      }
      if (message.turnId !== null && message.turnId !== turn.id) {
        return { kind: 'linkage_conflict' }
      }

      const updatedMessage = await tx.message.updateManyAndReturn({
        where: {
          id: message.id,
          OR: [{ turnId: null }, { turnId: turn.id }],
        },
        data: { turnId: turn.id },
        select: { id: true },
        limit: 1,
      })
      if (updatedMessage.length === 0) {
        return { kind: 'linkage_conflict' }
      }

      const updatedTurn = await tx.tutorTurn.updateManyAndReturn({
        where: {
          id: turn.id,
          OR: [{ studentMessageId: null }, { studentMessageId: message.id }],
        },
        data: { studentMessageId: message.id },
        select: tutorTurnSelect,
        limit: 1,
      })
      const snapshot = updatedTurn.at(0)
      if (snapshot === undefined) {
        return { kind: 'linkage_conflict' }
      }

      return { kind: 'ok', turn: snapshot }
    })
  }

  attachResolvedTopic(
    input: AttachResolvedTopicInput,
  ): Promise<AttachResolvedTopicResult> {
    return this.prismaService.$transaction(async (tx) => {
      const turn = await tx.tutorTurn.findUnique({
        where: { id: input.turnId },
        select: {
          id: true,
          sessionId: true,
          topicId: true,
          studentMessageId: true,
          session: {
            select: {
              courseId: true,
            },
          },
        },
      })
      if (turn === null) {
        return { kind: 'turn_not_found' }
      }

      const message = await tx.message.findUnique({
        where: { id: input.studentMessageId },
        select: {
          id: true,
          sessionId: true,
          role: true,
          turnId: true,
          topicId: true,
        },
      })
      if (message === null) {
        return { kind: 'message_not_found' }
      }
      if (message.role !== MessageRole.STUDENT) {
        return { kind: 'message_role_mismatch' }
      }

      const topic = await tx.topic.findUnique({
        where: { id: input.topicId },
        select: {
          id: true,
          sessionId: true,
          courseId: true,
        },
      })
      if (topic === null) {
        return { kind: 'topic_not_found' }
      }
      if (
        message.sessionId !== turn.sessionId ||
        topic.sessionId !== turn.sessionId
      ) {
        return { kind: 'session_mismatch' }
      }
      if (topic.courseId !== turn.session.courseId) {
        return { kind: 'course_mismatch' }
      }
      if (
        turn.studentMessageId !== null &&
        turn.studentMessageId !== message.id
      ) {
        return { kind: 'linkage_conflict' }
      }
      if (message.turnId !== null && message.turnId !== turn.id) {
        return { kind: 'linkage_conflict' }
      }
      if (turn.topicId !== null && turn.topicId !== topic.id) {
        return { kind: 'linkage_conflict' }
      }
      if (message.topicId !== null && message.topicId !== topic.id) {
        return { kind: 'linkage_conflict' }
      }

      const updatedMessage = await tx.message.updateManyAndReturn({
        where: {
          id: message.id,
          OR: [{ turnId: null }, { turnId: turn.id }],
          AND: [{ OR: [{ topicId: null }, { topicId: topic.id }] }],
        },
        data: {
          turnId: turn.id,
          topicId: topic.id,
        },
        select: { id: true },
        limit: 1,
      })
      if (updatedMessage.length === 0) {
        return { kind: 'linkage_conflict' }
      }

      const updatedTurn = await tx.tutorTurn.updateManyAndReturn({
        where: {
          id: turn.id,
          OR: [{ studentMessageId: null }, { studentMessageId: message.id }],
          AND: [{ OR: [{ topicId: null }, { topicId: topic.id }] }],
        },
        data: {
          studentMessageId: message.id,
          topicId: topic.id,
        },
        select: tutorTurnSelect,
        limit: 1,
      })
      const snapshot = updatedTurn.at(0)
      if (snapshot === undefined) {
        return { kind: 'linkage_conflict' }
      }

      return { kind: 'ok', turn: snapshot }
    })
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
