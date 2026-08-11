import { Injectable } from '@nestjs/common'

import {
  MaterialStatus,
  MessageGuidanceLabel,
  MessageRequestKind,
  MessageRole,
  MessageStatus,
  Prisma,
  TutoringAttemptFailureCode,
  TutoringAttemptStatus,
  TutoringApprovalSource,
  TutoringSafeFallbackReason,
} from '../../generated/prisma/client'
import { lockAuthorizedStudentChat } from '../../common/authorization/locked-student-chat-session'
import { PrismaService } from '../prisma/prisma.service'
import type { CourseEvidenceChunk } from '../materials/materials.public'
import { CLASSIFIED_RESPONSE_POLICY_VERSION } from './classified-response'
import type { ApprovedResponse } from './response-validation.types'
import type { ResponseAuditGraph } from './response-audit.types'
import type { SafeFallbackReason } from './safe-fallback.service'
import { topicStatePatchAssignments } from './topic-state.repository'
import {
  validateTopicStateTransition,
  type TopicStateTransition,
} from './topic-state-transition'
import type {
  AttachResolvedTopicInput,
  AttachResolvedTopicResult,
  LinkStudentMessageInput,
  LinkStudentMessageResult,
  TutoringAttemptSessionRecord,
  TutoringAttemptSnapshot,
} from './turn.types'

export abstract class TurnRepository {
  abstract findAuthoritativeSession(
    sessionId: string,
  ): Promise<TutoringAttemptSessionRecord | null>

  abstract createTurn(
    sessionId: string,
    clientMessageId: string,
  ): Promise<TutoringAttemptSnapshot | null>

  abstract findBySessionAndClientMessageId(
    sessionId: string,
    clientMessageId: string,
  ): Promise<TutoringAttemptSnapshot | null>

  abstract findById(attemptId: string): Promise<TutoringAttemptSnapshot | null>

  abstract transitionStatusAtomically(input: {
    attemptId: string
    expectedStatus: TutoringAttemptStatus
    nextStatus: TutoringAttemptStatus
  }): Promise<TutoringAttemptSnapshot | null>

  abstract markFailedAtomically(input: {
    attemptId: string
    expectedStatus: TutoringAttemptStatus
    failureCode: TutoringAttemptFailureCode
  }): Promise<TutoringAttemptSnapshot | null>

  abstract linkStudentMessage(
    input: LinkStudentMessageInput,
  ): Promise<LinkStudentMessageResult>

  abstract attachResolvedTopic(
    input: AttachResolvedTopicInput,
  ): Promise<AttachResolvedTopicResult>

  abstract completeApprovedResponse(
    input: CompleteApprovedTutorResponseInput,
  ): Promise<CompleteApprovedTutorResponseResult>

  abstract completeClassifiedResponse(
    input: CompleteClassifiedTutorResponseInput,
  ): Promise<CompleteClassifiedTutorResponseResult>
}

export interface CompleteApprovedTutorResponseInput {
  readonly courseId: string
  readonly sessionId: string
  readonly studentId: string
  readonly attemptId: string
  readonly topicId: string
  readonly studentMessageId: string
  readonly assistantMessageId: string
  readonly requestKind: MessageRequestKind
  readonly approvedResponse: ApprovedResponse
  readonly guidanceLevel: number
  readonly retrievalResult: readonly CourseEvidenceChunk[]
  readonly auditGraph: ResponseAuditGraph
  readonly safeFallbackReason: SafeFallbackReason | null
  readonly expectedTurnStatus: TutoringAttemptStatus
  readonly topicStateTransition: TopicStateTransition
}

export interface CompleteClassifiedTutorResponseInput {
  readonly courseId: string
  readonly sessionId: string
  readonly studentId: string
  readonly attemptId: string
  readonly topicId: string
  readonly studentMessageId: string
  readonly assistantMessageId: string
  readonly requestKind: MessageRequestKind
  readonly content: string
  readonly guidanceLabel: MessageGuidanceLabel
  readonly errorCode: string
  readonly expectedTurnStatus: TutoringAttemptStatus
  readonly topicStateTransition: TopicStateTransition
}

export type CompleteApprovedTutorResponseResult =
  | { readonly kind: 'ok'; readonly turn: TutoringAttemptSnapshot }
  | { readonly kind: 'turn_not_found' }
  | { readonly kind: 'message_not_found' }
  | { readonly kind: 'message_not_pending' }
  | { readonly kind: 'topic_state_conflict' }
  | { readonly kind: 'relationship_mismatch' }

export type CompleteClassifiedTutorResponseResult =
  | { readonly kind: 'ok'; readonly turn: TutoringAttemptSnapshot }
  | { readonly kind: 'turn_not_found' }
  | { readonly kind: 'message_not_found' }
  | { readonly kind: 'message_not_pending' }
  | { readonly kind: 'topic_state_conflict' }
  | { readonly kind: 'relationship_mismatch' }

export const tutoringAttemptSelect = {
  id: true,
  sessionId: true,
  topicId: true,
  studentMessageId: true,
  assistantMessageId: true,
  retryOfAttemptId: true,
  clientMessageId: true,
  requestKind: true,
  teachingStrategy: true,
  status: true,
  failureCode: true,
  leaseExpiresAt: true,
  claimedAt: true,
  version: true,
  safeFallbackUsed: true,
  approvalSource: true,
  approvedCandidateAttempt: true,
  safeFallbackReason: true,
  validationPolicyVersion: true,
  reviewRequired: true,
  createdAt: true,
  completedAt: true,
} satisfies Prisma.TutoringAttemptSelect

@Injectable()
export class PrismaTurnRepository extends TurnRepository {
  constructor(private readonly prismaService: PrismaService) {
    super()
  }

  findAuthoritativeSession(
    sessionId: string,
  ): Promise<TutoringAttemptSessionRecord | null> {
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
    clientMessageId: string,
  ): Promise<TutoringAttemptSnapshot | null> {
    return this.prismaService.tutoringAttempt
      .create({
        data: {
          sessionId,
          clientMessageId,
        },
        select: tutoringAttemptSelect,
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

  findBySessionAndClientMessageId(
    sessionId: string,
    clientMessageId: string,
  ): Promise<TutoringAttemptSnapshot | null> {
    return this.prismaService.tutoringAttempt.findUnique({
      where: {
        sessionId_clientMessageId: {
          sessionId,
          clientMessageId,
        },
      },
      select: tutoringAttemptSelect,
    })
  }

  findById(attemptId: string): Promise<TutoringAttemptSnapshot | null> {
    return this.prismaService.tutoringAttempt.findUnique({
      where: { id: attemptId },
      select: tutoringAttemptSelect,
    })
  }

  async transitionStatusAtomically(input: {
    attemptId: string
    expectedStatus: TutoringAttemptStatus
    nextStatus: TutoringAttemptStatus
  }): Promise<TutoringAttemptSnapshot | null> {
    const updated = await this.prismaService.$queryRaw<
      TutoringAttemptSnapshot[]
    >`
      UPDATE "tutoring_attempts"
      SET "status" = ${input.nextStatus}::tutoring_attempt_status
      WHERE "id" = ${input.attemptId}::uuid
        AND "status" = ${input.expectedStatus}::tutoring_attempt_status
      RETURNING ${tutoringAttemptReturningSql}
    `

    return updated[0] ?? null
  }

  async markFailedAtomically(input: {
    attemptId: string
    expectedStatus: TutoringAttemptStatus
    failureCode: TutoringAttemptFailureCode
  }): Promise<TutoringAttemptSnapshot | null> {
    const updated = await this.prismaService.$queryRaw<
      TutoringAttemptSnapshot[]
    >`
      UPDATE "tutoring_attempts"
      SET
        "status" = ${TutoringAttemptStatus.FAILED}::tutoring_attempt_status,
        "failure_code" = ${input.failureCode}::tutoring_attempt_failure_code,
        "completed_at" = CURRENT_TIMESTAMP
      WHERE "id" = ${input.attemptId}::uuid
        AND "status" = ${input.expectedStatus}::tutoring_attempt_status
      RETURNING ${tutoringAttemptReturningSql}
    `

    return updated[0] ?? null
  }

  linkStudentMessage(
    input: LinkStudentMessageInput,
  ): Promise<LinkStudentMessageResult> {
    return this.prismaService.$transaction(async (tx) => {
      const turn = await tx.tutoringAttempt.findUnique({
        where: { id: input.attemptId },
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
          attemptId: true,
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
      if (message.attemptId !== null && message.attemptId !== turn.id) {
        const existingTurn = await tx.tutoringAttempt.findUnique({
          where: { id: message.attemptId },
          select: { status: true },
        })
        if (existingTurn?.status !== TutoringAttemptStatus.FAILED) {
          return { kind: 'linkage_conflict' }
        }
      }

      const updatedMessage = await tx.message.updateManyAndReturn({
        where: {
          id: message.id,
        },
        data: { attemptId: turn.id },
        select: { id: true },
        limit: 1,
      })
      if (updatedMessage.length === 0) {
        return { kind: 'linkage_conflict' }
      }

      const updatedTurn = await tx.tutoringAttempt.updateManyAndReturn({
        where: {
          id: turn.id,
          OR: [{ studentMessageId: null }, { studentMessageId: message.id }],
        },
        data: { studentMessageId: message.id },
        select: tutoringAttemptSelect,
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
      const turn = await tx.tutoringAttempt.findUnique({
        where: { id: input.attemptId },
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
          attemptId: true,
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
      if (message.attemptId !== null && message.attemptId !== turn.id) {
        const existingTurn = await tx.tutoringAttempt.findUnique({
          where: { id: message.attemptId },
          select: { status: true },
        })
        if (existingTurn?.status !== TutoringAttemptStatus.FAILED) {
          return { kind: 'linkage_conflict' }
        }
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
          AND: [{ OR: [{ topicId: null }, { topicId: topic.id }] }],
        },
        data: {
          attemptId: turn.id,
          topicId: topic.id,
        },
        select: { id: true },
        limit: 1,
      })
      if (updatedMessage.length === 0) {
        return { kind: 'linkage_conflict' }
      }

      const updatedTurn = await tx.tutoringAttempt.updateManyAndReturn({
        where: {
          id: turn.id,
          OR: [{ studentMessageId: null }, { studentMessageId: message.id }],
          AND: [{ OR: [{ topicId: null }, { topicId: topic.id }] }],
        },
        data: {
          studentMessageId: message.id,
          topicId: topic.id,
        },
        select: tutoringAttemptSelect,
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
      const turn = await tx.tutoringAttempt.findUnique({
        where: { id: input.attemptId },
        select: {
          id: true,
          sessionId: true,
          topicId: true,
          studentMessageId: true,
          assistantMessageId: true,
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

      const authorization = await lockAuthorizedStudentChat(tx, input)
      if (authorization.kind !== 'ok') {
        return { kind: 'relationship_mismatch' }
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
        turn.assistantMessageId !== null &&
        turn.assistantMessageId !== input.assistantMessageId
      ) {
        return { kind: 'relationship_mismatch' }
      }

      if (turn.status === TutoringAttemptStatus.COMPLETED) {
        const existing = await tx.message.findUnique({
          where: { id: input.assistantMessageId },
          select: { id: true, status: true },
        })
        if (
          existing?.id === turn.assistantMessageId &&
          existing.status === MessageStatus.COMPLETED
        ) {
          const snapshot = await tx.tutoringAttempt.findUniqueOrThrow({
            where: { id: turn.id },
            select: tutoringAttemptSelect,
          })
          return { kind: 'ok', turn: snapshot }
        }
        return { kind: 'relationship_mismatch' }
      }

      if (turn.status !== input.expectedTurnStatus) {
        return { kind: 'relationship_mismatch' }
      }

      if (!auditGraphMatchesApproval(input)) {
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

      const pendingAssistantMessage = await tx.message.findUnique({
        where: { id: input.assistantMessageId },
        select: {
          id: true,
          sessionId: true,
          role: true,
          status: true,
          responseToMessageId: true,
          attemptId: true,
          topicId: true,
        },
      })
      if (pendingAssistantMessage === null) {
        return { kind: 'message_not_found' }
      }
      if (
        pendingAssistantMessage.sessionId !== input.sessionId ||
        pendingAssistantMessage.role !== MessageRole.ASSISTANT ||
        pendingAssistantMessage.status !== MessageStatus.PENDING ||
        pendingAssistantMessage.responseToMessageId !==
          input.studentMessageId ||
        (pendingAssistantMessage.attemptId !== null &&
          pendingAssistantMessage.attemptId !== input.attemptId) ||
        (pendingAssistantMessage.topicId !== null &&
          pendingAssistantMessage.topicId !== input.topicId)
      ) {
        return { kind: 'message_not_pending' }
      }

      const topicStateApplied = await applyTopicStateTransition(
        tx,
        input.topicId,
        input.topicStateTransition,
      )
      if (!topicStateApplied) {
        return { kind: 'topic_state_conflict' }
      }

      const updatedStudentMessage = await tx.message.updateManyAndReturn({
        where: {
          id: input.studentMessageId,
          sessionId: input.sessionId,
          role: MessageRole.STUDENT,
          attemptId: input.attemptId,
          topicId: input.topicId,
        },
        data: { requestKind: input.requestKind },
        select: { id: true },
        limit: 1,
      })
      if (updatedStudentMessage.length === 0) {
        throw new Error('Student message changed during response finalization')
      }

      const now = await currentDatabaseTime(tx)
      const messages = await tx.message.updateManyAndReturn({
        where: {
          id: input.assistantMessageId,
          sessionId: input.sessionId,
          role: MessageRole.ASSISTANT,
          status: MessageStatus.PENDING,
          responseToMessageId: input.studentMessageId,
          OR: [{ attemptId: null }, { attemptId: input.attemptId }],
          AND: [{ OR: [{ topicId: null }, { topicId: input.topicId }] }],
        },
        data: {
          status: MessageStatus.COMPLETED,
          content: input.approvedResponse.message,
          attemptId: input.attemptId,
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
        throw new Error(
          'Assistant message changed during response finalization',
        )
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

      await tx.tutoringCandidateAttempt.createMany({
        data: input.auditGraph.candidateAttempts.map((attempt) => ({
          attemptId: input.attemptId,
          candidateAttempt: attempt.candidateAttempt,
          generationOutcome: attempt.generationOutcome,
          generationFailureCode: attempt.generationFailureCode,
          contentHash: attempt.contentHash,
          provider: attempt.provider,
          model: attempt.model,
          promptVersion: attempt.promptVersion,
          inputTokens: attempt.inputTokens,
          outputTokens: attempt.outputTokens,
          infrastructureRetryCount: attempt.infrastructureRetryCount,
          startedAt: attempt.startedAt,
          completedAt: attempt.completedAt,
        })),
      })
      if (input.auditGraph.guardResults.length > 0) {
        await tx.guardResult.createMany({
          data: input.auditGraph.guardResults.map((guard) => ({
            attemptId: input.attemptId,
            candidateAttempt: guard.candidateAttempt,
            validationStage: guard.result.stage,
            approved: guard.result.approved,
            violations: guard.result
              .violations as unknown as Prisma.InputJsonValue,
            maximumSeverity: guard.result.maximumSeverity,
            recommendedAction: guard.result.recommendedAction,
            provider: guard.result.provider,
            model: guard.result.model,
            promptVersion: guard.result.promptVersion,
            validationPolicyVersion: guard.result.policyVersion,
            teachingPolicyVersion: guard.teachingPolicyVersion,
            disclosurePolicyVersion: guard.disclosurePolicyVersion,
          })),
        })
      }

      const updated = await tx.tutoringAttempt.updateManyAndReturn({
        where: {
          id: input.attemptId,
          status: input.expectedTurnStatus,
          assistantMessageId: input.assistantMessageId,
        },
        data: {
          status: TutoringAttemptStatus.COMPLETED,
          assistantMessageId: input.assistantMessageId,
          safeFallbackUsed: input.approvedResponse.safeFallbackUsed,
          approvalSource:
            input.approvedResponse.source === 'SAFE_FALLBACK'
              ? TutoringApprovalSource.SAFE_FALLBACK
              : TutoringApprovalSource.VALIDATED_CANDIDATE,
          approvedCandidateAttempt:
            input.approvedResponse.approvedCandidateAttempt,
          safeFallbackReason:
            input.safeFallbackReason === null
              ? null
              : TutoringSafeFallbackReason[input.safeFallbackReason],
          validationPolicyVersion:
            input.approvedResponse.approvalMetadata.validationPolicyVersion,
          completedAt: now,
        },
        select: tutoringAttemptSelect,
        limit: 1,
      })
      const snapshot = updated.at(0)
      if (snapshot === undefined) {
        throw new Error(
          'TutoringAttempt changed during approved response finalization',
        )
      }

      return { kind: 'ok', turn: snapshot }
    })
  }

  completeClassifiedResponse(
    input: CompleteClassifiedTutorResponseInput,
  ): Promise<CompleteClassifiedTutorResponseResult> {
    return this.prismaService.$transaction(async (tx) => {
      const turn = await tx.tutoringAttempt.findUnique({
        where: { id: input.attemptId },
        select: {
          id: true,
          sessionId: true,
          topicId: true,
          studentMessageId: true,
          assistantMessageId: true,
          status: true,
          session: {
            select: {
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

      const authorization = await lockAuthorizedStudentChat(tx, input)
      if (authorization.kind !== 'ok') {
        return { kind: 'relationship_mismatch' }
      }

      if (
        turn.sessionId !== input.sessionId ||
        turn.session.courseId !== input.courseId ||
        turn.session.studentId !== input.studentId ||
        turn.session.deletedAt !== null ||
        turn.topicId !== input.topicId ||
        turn.studentMessageId !== input.studentMessageId ||
        turn.assistantMessageId !== input.assistantMessageId
      ) {
        return { kind: 'relationship_mismatch' }
      }
      if (turn.status !== input.expectedTurnStatus) {
        return { kind: 'relationship_mismatch' }
      }

      const studentMessage = await tx.message.findUnique({
        where: { id: input.studentMessageId },
        select: {
          id: true,
          sessionId: true,
          role: true,
          attemptId: true,
          topicId: true,
        },
      })
      if (studentMessage === null) {
        return { kind: 'relationship_mismatch' }
      }
      if (
        studentMessage.role !== MessageRole.STUDENT ||
        studentMessage.sessionId !== input.sessionId ||
        studentMessage.attemptId !== input.attemptId ||
        studentMessage.topicId !== input.topicId
      ) {
        return { kind: 'relationship_mismatch' }
      }

      const pendingAssistantMessage = await tx.message.findUnique({
        where: { id: input.assistantMessageId },
        select: {
          id: true,
          sessionId: true,
          role: true,
          status: true,
          responseToMessageId: true,
          attemptId: true,
          topicId: true,
        },
      })
      if (pendingAssistantMessage === null) {
        return { kind: 'message_not_found' }
      }
      if (
        pendingAssistantMessage.sessionId !== input.sessionId ||
        pendingAssistantMessage.role !== MessageRole.ASSISTANT ||
        pendingAssistantMessage.status !== MessageStatus.PENDING ||
        pendingAssistantMessage.responseToMessageId !==
          input.studentMessageId ||
        pendingAssistantMessage.attemptId !== input.attemptId ||
        pendingAssistantMessage.topicId !== input.topicId
      ) {
        return { kind: 'message_not_pending' }
      }

      const topicStateApplied = await applyTopicStateTransition(
        tx,
        input.topicId,
        input.topicStateTransition,
      )
      if (!topicStateApplied) {
        return { kind: 'topic_state_conflict' }
      }

      const updatedStudentMessage = await tx.message.updateManyAndReturn({
        where: {
          id: input.studentMessageId,
          sessionId: input.sessionId,
          role: MessageRole.STUDENT,
          attemptId: input.attemptId,
          topicId: input.topicId,
        },
        data: { requestKind: input.requestKind },
        select: { id: true },
        limit: 1,
      })
      if (updatedStudentMessage.length === 0) {
        throw new Error(
          'Student message changed during classified response finalization',
        )
      }

      const now = await currentDatabaseTime(tx)
      const updatedMessages = await tx.message.updateManyAndReturn({
        where: {
          id: input.assistantMessageId,
          sessionId: input.sessionId,
          role: MessageRole.ASSISTANT,
          status: MessageStatus.PENDING,
          responseToMessageId: input.studentMessageId,
          attemptId: input.attemptId,
          topicId: input.topicId,
        },
        data: {
          status: MessageStatus.COMPLETED,
          content: input.content,
          requestKind: input.requestKind,
          guidanceLabel: input.guidanceLabel,
          hintLevel: null,
          provider: null,
          model: null,
          promptVersion: CLASSIFIED_RESPONSE_POLICY_VERSION,
          inputTokens: null,
          outputTokens: null,
          errorCode: input.errorCode,
          errorMessage: null,
          completedAt: now,
        },
        select: { id: true },
        limit: 1,
      })
      if (updatedMessages.length === 0) {
        throw new Error(
          'Assistant message changed during classified response finalization',
        )
      }

      const updatedTurns = await tx.tutoringAttempt.updateManyAndReturn({
        where: {
          id: input.attemptId,
          status: input.expectedTurnStatus,
          assistantMessageId: input.assistantMessageId,
        },
        data: {
          status: TutoringAttemptStatus.COMPLETED,
          assistantMessageId: input.assistantMessageId,
          safeFallbackUsed: false,
          approvalSource: TutoringApprovalSource.CLASSIFIED_RESPONSE,
          approvedCandidateAttempt: null,
          safeFallbackReason: null,
          validationPolicyVersion: CLASSIFIED_RESPONSE_POLICY_VERSION,
          completedAt: now,
        },
        select: tutoringAttemptSelect,
        limit: 1,
      })
      const snapshot = updatedTurns.at(0)
      if (snapshot === undefined) {
        throw new Error(
          'TutoringAttempt changed during classified response finalization',
        )
      }

      return { kind: 'ok', turn: snapshot }
    })
  }
}

const tutoringAttemptReturningSql = Prisma.sql`
  "id"::text AS "id",
  "session_id"::text AS "sessionId",
  "topic_id"::text AS "topicId",
  "student_message_id"::text AS "studentMessageId",
  "assistant_message_id"::text AS "assistantMessageId",
  "retry_of_attempt_id"::text AS "retryOfAttemptId",
  "client_message_id" AS "clientMessageId",
  "request_kind" AS "requestKind",
  "teaching_strategy" AS "teachingStrategy",
  "status",
  "failure_code" AS "failureCode",
  "lease_expires_at" AS "leaseExpiresAt",
  "claimed_at" AS "claimedAt",
  "version",
  "safe_fallback_used" AS "safeFallbackUsed",
  "approval_source" AS "approvalSource",
  "approved_candidate_attempt" AS "approvedCandidateAttempt",
  "safe_fallback_reason" AS "safeFallbackReason",
  "validation_policy_version" AS "validationPolicyVersion",
  "review_required" AS "reviewRequired",
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

async function applyTopicStateTransition(
  tx: Prisma.TransactionClient,
  topicId: string,
  transition: TopicStateTransition,
): Promise<boolean> {
  validateTopicStateTransition(transition)

  const updated = await tx.$queryRaw<{ topicId: string }[]>(Prisma.sql`
    UPDATE "topic_states"
    SET ${Prisma.join(topicStatePatchAssignments(transition.patch), ', ')}
    WHERE "topic_id" = ${topicId}::uuid
      AND "version" = ${transition.expectedVersion}
    RETURNING "topic_id"::text AS "topicId"
  `)

  return updated.length === 1
}

async function selectedEvidenceIsCourseScoped(
  tx: Prisma.TransactionClient,
  courseId: string,
  evidence: readonly CourseEvidenceChunk[],
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

function auditGraphMatchesApproval(
  input: CompleteApprovedTutorResponseInput,
): boolean {
  const attempts = input.auditGraph.candidateAttempts
  if (attempts.length === 0 || attempts.length > 3) {
    return false
  }

  const attemptNumbers = new Set<number>()
  for (const attempt of attempts) {
    if (
      attempt.candidateAttempt < 1 ||
      attempt.candidateAttempt > 3 ||
      attemptNumbers.has(attempt.candidateAttempt)
    ) {
      return false
    }
    attemptNumbers.add(attempt.candidateAttempt)
  }

  const stageKeys = new Set<string>()
  for (const guard of input.auditGraph.guardResults) {
    const key = `${String(guard.candidateAttempt)}:${guard.result.stage}`
    if (!attemptNumbers.has(guard.candidateAttempt) || stageKeys.has(key)) {
      return false
    }
    stageKeys.add(key)
  }

  if (input.approvedResponse.source === 'SAFE_FALLBACK') {
    return (
      input.approvedResponse.approvedCandidateAttempt === null &&
      input.safeFallbackReason !== null
    )
  }

  const approvedAttempt = input.approvedResponse.approvedCandidateAttempt
  return (
    approvedAttempt !== null &&
    input.safeFallbackReason === null &&
    attempts.some(
      (attempt) =>
        attempt.candidateAttempt === approvedAttempt &&
        attempt.generationOutcome === 'GENERATED',
    )
  )
}

function orderedCitationMaterialIds(
  usedCitationIds: readonly string[],
  evidence: readonly CourseEvidenceChunk[],
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
