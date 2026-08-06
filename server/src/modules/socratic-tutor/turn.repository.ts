import { Injectable } from '@nestjs/common'

import {
  MaterialStatus,
  MessageGuidanceLabel,
  MessageRole,
  MessageStatus,
  Prisma,
  TutorTurnFailureCode,
  TutorTurnStatus,
} from '../../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import type { RetrievedChunk } from '../retrieval/retrieval.service'
import type { ApprovedResponse } from './response-validation.types'
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

  abstract completeApprovedResponse(
    input: CompleteApprovedTutorResponseInput,
  ): Promise<CompleteApprovedTutorResponseResult>
}

export interface CompleteApprovedTutorResponseInput {
  readonly courseId: string
  readonly sessionId: string
  readonly studentId: string
  readonly turnId: string
  readonly topicId: string
  readonly studentMessageId: string
  readonly assistantMessageId: string
  readonly approvedResponse: ApprovedResponse
  readonly guidanceLevel: number
  readonly retrievalResult: readonly RetrievedChunk[]
}

export type CompleteApprovedTutorResponseResult =
  | { readonly kind: 'ok'; readonly turn: TutorTurnSnapshot }
  | { readonly kind: 'turn_not_found' }
  | { readonly kind: 'message_not_found' }
  | { readonly kind: 'message_not_pending' }
  | { readonly kind: 'relationship_mismatch' }

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

  completeApprovedResponse(
    input: CompleteApprovedTutorResponseInput,
  ): Promise<CompleteApprovedTutorResponseResult> {
    return this.prismaService.$transaction(async (tx) => {
      const turn = await tx.tutorTurn.findUnique({
        where: { id: input.turnId },
        select: {
          id: true,
          sessionId: true,
          topicId: true,
          studentMessageId: true,
          approvedTutorMessageId: true,
          status: true,
          session: {
            select: {
              id: true,
              courseId: true,
              studentId: true,
              deletedAt: true,
            },
          },
        },
      })
      if (turn === null) {
        return { kind: 'turn_not_found' }
      }
      if (
        turn.sessionId !== input.sessionId ||
        turn.session.courseId !== input.courseId ||
        turn.session.studentId !== input.studentId ||
        turn.session.deletedAt !== null ||
        turn.topicId !== input.topicId ||
        turn.studentMessageId !== input.studentMessageId
      ) {
        return { kind: 'relationship_mismatch' }
      }

      if (
        turn.approvedTutorMessageId !== null &&
        turn.approvedTutorMessageId !== input.assistantMessageId
      ) {
        return { kind: 'relationship_mismatch' }
      }

      if (turn.status === TutorTurnStatus.COMPLETED) {
        const existing = await tx.message.findUnique({
          where: { id: input.assistantMessageId },
          select: { id: true, status: true },
        })
        if (
          existing?.id === turn.approvedTutorMessageId &&
          existing.status === MessageStatus.COMPLETED
        ) {
          const snapshot = await tx.tutorTurn.findUniqueOrThrow({
            where: { id: turn.id },
            select: tutorTurnSelect,
          })
          return { kind: 'ok', turn: snapshot }
        }
        return { kind: 'relationship_mismatch' }
      }

      const evidenceOk = await selectedEvidenceIsCourseScoped(
        tx,
        input.courseId,
        input.retrievalResult,
      )
      if (!evidenceOk) {
        return { kind: 'relationship_mismatch' }
      }

      const now = await currentDatabaseTime(tx)
      const messages = await tx.message.updateManyAndReturn({
        where: {
          id: input.assistantMessageId,
          sessionId: input.sessionId,
          role: MessageRole.ASSISTANT,
          status: MessageStatus.PENDING,
          responseToMessageId: input.studentMessageId,
          OR: [{ turnId: null }, { turnId: input.turnId }],
          AND: [{ OR: [{ topicId: null }, { topicId: input.topicId }] }],
        },
        data: {
          status: MessageStatus.COMPLETED,
          content: input.approvedResponse.message,
          turnId: input.turnId,
          topicId: input.topicId,
          guidanceLabel: MessageGuidanceLabel.COURSE_GROUNDED,
          hintLevel:
            input.approvedResponse.source === 'SAFE_FALLBACK'
              ? null
              : input.guidanceLevel,
          provider: input.approvedResponse.approvalMetadata.provider,
          model: input.approvedResponse.approvalMetadata.model,
          promptVersion: input.approvedResponse.approvalMetadata.promptVersion,
          inputTokens: input.approvedResponse.approvalMetadata.inputTokens,
          outputTokens: input.approvedResponse.approvalMetadata.outputTokens,
          errorCode: null,
          errorMessage: null,
          completedAt: now,
        },
        select: { id: true },
        limit: 1,
      })
      if (messages.length === 0) {
        const existing = await tx.message.findUnique({
          where: { id: input.assistantMessageId },
          select: { id: true, status: true },
        })
        return existing === null
          ? { kind: 'message_not_found' }
          : { kind: 'message_not_pending' }
      }

      await tx.messageRetrieval.deleteMany({
        where: { messageId: input.assistantMessageId },
      })
      await tx.messageCitation.deleteMany({
        where: { messageId: input.assistantMessageId },
      })
      if (input.retrievalResult.length > 0) {
        await tx.messageRetrieval.createMany({
          data: input.retrievalResult.map((entry) => ({
            messageId: input.assistantMessageId,
            chunkId: entry.chunkId,
            rank: entry.rank,
            similarityScore: entry.similarityScore,
          })),
        })
      }
      const citedMaterialIds = orderedCitationMaterialIds(
        input.approvedResponse.usedCitationIds,
        input.retrievalResult,
      )
      if (citedMaterialIds.length > 0) {
        await tx.messageCitation.createMany({
          data: citedMaterialIds.map((materialId, index) => ({
            messageId: input.assistantMessageId,
            materialId,
            citationOrder: index + 1,
          })),
        })
      }

      const updated = await tx.tutorTurn.updateManyAndReturn({
        where: {
          id: input.turnId,
          status: {
            notIn: [TutorTurnStatus.COMPLETED, TutorTurnStatus.FAILED],
          },
          approvedTutorMessageId: null,
        },
        data: {
          status: TutorTurnStatus.COMPLETED,
          approvedTutorMessageId: input.assistantMessageId,
          safeFallbackUsed: input.approvedResponse.safeFallbackUsed,
          completedAt: now,
        },
        select: tutorTurnSelect,
        limit: 1,
      })
      const snapshot = updated.at(0)
      if (snapshot === undefined) {
        return { kind: 'relationship_mismatch' }
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

function currentDatabaseTime(tx: Prisma.TransactionClient): Promise<Date> {
  return tx
    .$queryRaw<{ now: Date }[]>(Prisma.sql`SELECT CURRENT_TIMESTAMP AS now`)
    .then((rows) => rows[0]?.now ?? new Date())
}

async function selectedEvidenceIsCourseScoped(
  tx: Prisma.TransactionClient,
  courseId: string,
  evidence: readonly RetrievedChunk[],
): Promise<boolean> {
  if (evidence.length === 0) {
    return true
  }

  const chunks = await tx.materialChunk.findMany({
    where: {
      id: { in: evidence.map((entry) => entry.chunkId) },
      material: {
        courseId,
        status: { in: [MaterialStatus.READY, MaterialStatus.WARNING] },
        deletedAt: null,
      },
    },
    select: {
      id: true,
      materialId: true,
    },
  })
  const materialByChunk = new Map(
    chunks.map((chunk) => [chunk.id, chunk.materialId]),
  )
  return evidence.every(
    (entry) => materialByChunk.get(entry.chunkId) === entry.materialId,
  )
}

function orderedCitationMaterialIds(
  usedCitationIds: readonly string[],
  evidence: readonly RetrievedChunk[],
): readonly string[] {
  const chunkByCitationId = new Map(
    evidence.map((chunk) => [`retrieval.rank.${String(chunk.rank)}`, chunk]),
  )
  const materialIds: string[] = []
  const seen = new Set<string>()
  for (const citationId of usedCitationIds) {
    const materialId = chunkByCitationId.get(citationId)?.materialId
    if (materialId !== undefined && !seen.has(materialId)) {
      seen.add(materialId)
      materialIds.push(materialId)
    }
  }
  return materialIds
}
