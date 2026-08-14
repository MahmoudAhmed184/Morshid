import { randomUUID } from 'node:crypto'

import { Injectable } from '@nestjs/common'

import { Prisma } from '../../../generated/prisma/client'
import { MaterialStatus } from '../../materials/interface/material-status'
import {
  MessageGuidanceLabel,
  MessageRequestKind,
  MessageRole,
  MessageStatus,
  TutoringApprovalSource,
  TutoringAttemptFailureCode,
  TutoringAttemptStatus,
  TutoringSafeFallbackReason,
} from '../tutoring-values'
import { ConversationTurns } from '../../conversations/interface/conversation-turns'
import {
  ConversationMessageReader,
  type ConversationMessageLookup,
} from '../../conversations/interface/conversation-message-reader'
import {
  ConversationAuthorization,
  type ConversationAuthorizationResult,
} from '../../conversations/interface/conversation-authorization'
import {
  AUDIT_EVENT_ACTIONS,
  AUDIT_TARGET_TYPES,
  AuditService,
} from '../../audit/audit.public'
import { asDatabaseTransaction } from '../../../platform/database/database-transaction'
import { PrismaService } from '../../../platform/database/prisma.service'
import {
  ReviewCaseIntake,
  type AutomaticReviewIntakeInput,
} from '../../reviews/interface/review-case-intake'
import { currentDatabaseTime } from '../../../platform/database/database-clock'
import type { ChatMessageRecord } from '../../conversations/interface/conversation-records'
import {
  validateTopicStateTransition,
  type TopicStateTransition,
} from '../socratic-workflow/topic/topic-state-transition'
import { topicStatePatchAssignments } from '../socratic-workflow/topic/topic-state.repository'
import type { ResponseAuditGraph } from '../socratic-workflow/response-approval/response-audit.types'
import {
  GROUNDING_ATTEMPT_EXPIRED,
  GROUNDING_ATTEMPT_LEASE_MS,
  GROUNDING_FAILED_CONTENT,
} from './tutoring.constants'

const MAX_TRANSACTION_ATTEMPTS = 3

interface AuthorizedTurnInput {
  courseId: string
  sessionId: string
  studentId: string
}

export interface BeginTutoringTurnInput extends AuthorizedTurnInput {
  clientMessageId: string
  content: string
  requestKind?: MessageRequestKind
}

export interface RetryTutoringTurnInput extends AuthorizedTurnInput {
  attemptId: string
}

export interface RepairTutoringReviewInput extends AuthorizedTurnInput {
  attemptId: string
  studentMessageId: string
  assistantMessageId: string
  automaticReview: Omit<AutomaticReviewIntakeInput, 'messageId'>
}

export interface TutoringEvidenceInput {
  chunkId: string
  materialId: string
  materialTitle: string
  chunkIndex: number
  content: string
  rank: number
  similarityScore: number
}

export interface TransitionTutoringAttemptInput extends AuthorizedTurnInput {
  attemptId: string
  expectedStatus: TutoringAttemptStatus
  nextStatus: TutoringAttemptStatus
  topicId?: string | null
  requestKind?: MessageRequestKind | null
}

export interface CompleteTutoringTurnInput extends AuthorizedTurnInput {
  attemptId: string
  studentMessageId: string
  assistantMessageId: string
  content: string
  provider: string | null
  model: string | null
  promptVersion: string
  inputTokens?: number
  outputTokens?: number
  requestKind?: MessageRequestKind | null
  evidence: readonly TutoringEvidenceInput[]
  citationContextIndexes?: readonly number[]
  topicId?: string | null
  topicStateTransition?: TopicStateTransition
  auditGraph?: ResponseAuditGraph
  approvalSource?: TutoringApprovalSource | null
  approvedCandidateAttempt?: number | null
  safeFallbackUsed?: boolean
  safeFallbackReason?: TutoringSafeFallbackReason | null
  validationPolicyVersion?: string | null
  guidanceLabel?: MessageGuidanceLabel
  hintLevel?: number | null
  errorCode?: string
  automaticReview?: Omit<AutomaticReviewIntakeInput, 'messageId'>
}

export interface CompletePolicyTutoringTurnInput extends AuthorizedTurnInput {
  attemptId: string
  studentMessageId: string
  assistantMessageId: string
  content: string
  evidence: readonly TutoringEvidenceInput[]
  topicId?: string | null
  topicStateTransition?: TopicStateTransition
  promptVersion?: string | null
  approvalSource?: TutoringApprovalSource | null
  requestKind?: MessageRequestKind | null
  hintLevel?: number | null
  guidanceLabel: MessageGuidanceLabel
  errorCode: string
  automaticReview?: Omit<AutomaticReviewIntakeInput, 'messageId'>
}

export interface FinalizeTutoringTurnInput extends AuthorizedTurnInput {
  attemptId: string
  studentMessageId: string
  assistantMessageId: string
  content: string
  errorCode: string
  topicId?: string | null
  requestKind?: MessageRequestKind | null
  guidanceLabel?: MessageGuidanceLabel
  automaticReview?: Omit<AutomaticReviewIntakeInput, 'messageId'>
}

export interface CompleteSafetyTutoringTurnInput extends FinalizeTutoringTurnInput {
  guidanceLabel: MessageGuidanceLabel
}

export interface ReadTutoringTurnInput extends AuthorizedTurnInput {
  studentMessageId: string
  assistantMessageId: string
}

export type BeginTutoringTurnResult =
  | {
      kind: 'ok'
      courseId: string
      attemptId: string
      studentMessage: ChatMessageRecord
      assistantMessage: ChatMessageRecord
    }
  | {
      kind: 'replayed'
      studentMessage: ChatMessageRecord
      assistantMessage: ChatMessageRecord
    }
  | { kind: 'membership_missing' }
  | { kind: 'session_not_found' }
  | { kind: 'idempotency_conflict' }
  | { kind: 'turn_in_progress' }

export type RetryTutoringTurnResult =
  | {
      kind: 'ok'
      courseId: string
      attemptId: string
      studentMessage: ChatMessageRecord
      assistantMessage: ChatMessageRecord
    }
  | { kind: 'membership_missing' }
  | { kind: 'session_not_found' }
  | { kind: 'attempt_not_found'; attemptId: string }
  | { kind: 'retry_not_allowed'; attemptId: string }
  | { kind: 'turn_in_progress' }

export type RepairTutoringReviewResult =
  | { kind: 'ok' }
  | { kind: 'membership_missing' }
  | { kind: 'session_not_found' }
  | { kind: 'message_not_found' }

export type FinalizeTutoringTurnResult =
  | { kind: 'ok'; message: ChatMessageRecord }
  | { kind: 'membership_missing' }
  | { kind: 'session_not_found' }
  | { kind: 'message_not_found'; messageId: string }
  | { kind: 'message_not_pending'; messageId: string }

export type ReadTutoringTurnResult =
  | {
      kind: 'ok'
      studentMessage: ChatMessageRecord
      assistantMessage: ChatMessageRecord
    }
  | { kind: 'membership_missing' }
  | { kind: 'session_not_found' }
  | { kind: 'message_not_found'; messageId: string }

type AuthorizationResult = ConversationAuthorizationResult

export class TutoringEvidenceUnavailableError extends Error {
  constructor() {
    super('Course evidence is no longer available')
    this.name = 'TutoringEvidenceUnavailableError'
  }
}

export abstract class TutoringTurnRepository {
  abstract transitionAttempt(
    input: TransitionTutoringAttemptInput,
  ): Promise<boolean>

  abstract beginTurn(
    input: BeginTutoringTurnInput,
  ): Promise<BeginTutoringTurnResult>

  abstract retryTurn(
    input: RetryTutoringTurnInput,
  ): Promise<RetryTutoringTurnResult>

  abstract repairAutomaticReview(
    input: RepairTutoringReviewInput,
  ): Promise<RepairTutoringReviewResult>

  abstract completeTurn(
    input: CompleteTutoringTurnInput,
  ): Promise<FinalizeTutoringTurnResult>

  abstract completePolicyTurn(
    input: CompletePolicyTutoringTurnInput,
  ): Promise<FinalizeTutoringTurnResult>

  abstract failTurn(
    input: FinalizeTutoringTurnInput,
  ): Promise<FinalizeTutoringTurnResult>

  abstract blockTurn(
    input: FinalizeTutoringTurnInput,
  ): Promise<FinalizeTutoringTurnResult>

  abstract completeUnsupportedTurn(
    input: FinalizeTutoringTurnInput,
  ): Promise<FinalizeTutoringTurnResult>

  abstract completeSafetyTurn(
    input: CompleteSafetyTutoringTurnInput,
  ): Promise<FinalizeTutoringTurnResult>

  abstract readTurnForStudent(
    input: ReadTutoringTurnInput,
  ): Promise<ReadTutoringTurnResult>
}

@Injectable()
export class PrismaTutoringTurnRepository extends TutoringTurnRepository {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly conversationTurns: ConversationTurns,
    private readonly conversationAuthorization: ConversationAuthorization,
    private readonly conversationMessages: ConversationMessageReader,
    private readonly reviewCaseIntake: ReviewCaseIntake,
    private readonly auditService: AuditService,
  ) {
    super()
  }

  async beginTurn(
    input: BeginTutoringTurnInput,
  ): Promise<BeginTutoringTurnResult> {
    const identity = {
      studentMessageId: input.clientMessageId,
      assistantMessageId: randomUUID(),
      attemptId: randomUUID(),
    }

    try {
      return await this.runTransaction(async (tx) => {
        const authorization =
          await this.conversationAuthorization.authorizeStudent(
            input,
            asDatabaseTransaction(tx),
          )
        if (authorization.kind !== 'ok') {
          return authorization
        }
        const { session } = authorization
        const now = await currentDatabaseTime(tx)
        await this.failExpiredActiveTurns(
          tx,
          {
            courseId: session.courseId,
            sessionId: session.id,
            studentId: input.studentId,
          },
          now,
        )

        const replayedAttempt = await tx.tutoringAttempt.findUnique({
          where: {
            sessionId_clientMessageId: {
              sessionId: session.id,
              clientMessageId: input.clientMessageId,
            },
          },
          select: {
            studentMessageId: true,
            assistantMessageId: true,
          },
        })
        if (replayedAttempt !== null) {
          const replayedStudent =
            replayedAttempt.studentMessageId === null
              ? null
              : await this.findMessage(
                  { id: replayedAttempt.studentMessageId },
                  tx,
                )
          const replayedAssistant =
            replayedAttempt.assistantMessageId === null
              ? null
              : await this.findMessage(
                  { id: replayedAttempt.assistantMessageId },
                  tx,
                )
          if (
            replayedStudent !== null &&
            replayedStudent.content === input.content &&
            replayedAssistant !== null &&
            replayedAssistant.role === MessageRole.ASSISTANT &&
            isTerminalMessageStatus(replayedAssistant.status)
          ) {
            return {
              kind: 'replayed' as const,
              studentMessage: replayedStudent,
              assistantMessage: replayedAssistant,
            }
          }

          return replayedStudent !== null &&
            replayedStudent.content !== input.content
            ? { kind: 'idempotency_conflict' as const }
            : { kind: 'turn_in_progress' as const }
        }

        await tx.tutoringAttempt.create({
          data: {
            id: identity.attemptId,
            sessionId: session.id,
            clientMessageId: input.clientMessageId,
            requestKind: input.requestKind ?? null,
            status: TutoringAttemptStatus.RECEIVED,
            leaseExpiresAt: leaseExpiry(now),
          },
        })
        const admitted = await this.conversationTurns.admit(
          {
            kind: 'new',
            courseId: session.courseId,
            sessionId: session.id,
            studentId: input.studentId,
            attemptId: identity.attemptId,
            studentMessageId: identity.studentMessageId,
            assistantMessageId: identity.assistantMessageId,
            content: input.content,
            requestKind: input.requestKind ?? null,
            now,
          },
          asDatabaseTransaction(tx),
        )
        if (admitted.kind !== 'admitted') {
          return admitted
        }
        const studentMessage = await this.findMessageOrThrow(
          { id: admitted.studentMessage.id },
          tx,
        )
        const assistantMessage = await this.findMessageOrThrow(
          { id: admitted.assistantMessage.id },
          tx,
        )
        await tx.tutoringAttempt.update({
          where: { id: identity.attemptId },
          data: {
            studentMessageId: studentMessage.id,
            assistantMessageId: assistantMessage.id,
          },
        })
        return {
          kind: 'ok',
          courseId: session.courseId,
          attemptId: identity.attemptId,
          studentMessage,
          assistantMessage,
        }
      })
    } catch (error) {
      return this.reconcileStartedTurn(input, identity, error)
    }
  }

  async retryTurn(
    input: RetryTutoringTurnInput,
  ): Promise<RetryTutoringTurnResult> {
    const attemptId = randomUUID()

    try {
      return await this.runTransaction(async (tx) => {
        const authorization =
          await this.conversationAuthorization.authorizeStudent(
            input,
            asDatabaseTransaction(tx),
          )
        if (authorization.kind !== 'ok') {
          return authorization
        }
        const { session } = authorization
        const now = await currentDatabaseTime(tx)
        await this.failExpiredActiveTurns(
          tx,
          {
            courseId: session.courseId,
            sessionId: session.id,
            studentId: input.studentId,
          },
          now,
        )
        const previousAttempt = await tx.tutoringAttempt.findFirst({
          where: { id: input.attemptId, sessionId: session.id },
          select: {
            id: true,
            studentMessageId: true,
            assistantMessageId: true,
            leaseExpiresAt: true,
            status: true,
          },
        })
        if (
          previousAttempt?.studentMessageId === null ||
          previousAttempt?.studentMessageId === undefined ||
          previousAttempt.assistantMessageId === null
        ) {
          return {
            kind: 'attempt_not_found',
            attemptId: input.attemptId,
          }
        }

        const studentMessage = await this.findMessage(
          {
            id: previousAttempt.studentMessageId,
            sessionId: session.id,
            role: MessageRole.STUDENT,
            authorUserId: input.studentId,
            attemptId: previousAttempt.id,
          },
          tx,
        )
        const assistantMessage = await this.findMessage(
          {
            id: previousAttempt.assistantMessageId,
            responseToMessageId: previousAttempt.studentMessageId,
            attemptId: previousAttempt.id,
          },
          tx,
        )
        if (
          studentMessage === null ||
          assistantMessage?.role !== MessageRole.ASSISTANT
        ) {
          return {
            kind: 'retry_not_allowed',
            attemptId: input.attemptId,
          }
        }
        if (!isRetryableAttempt(previousAttempt, now)) {
          return {
            kind: 'retry_not_allowed',
            attemptId: input.attemptId,
          }
        }

        const otherActiveAssistant = await this.findMessage(
          {
            sessionId: session.id,
            role: MessageRole.ASSISTANT,
            statuses: [MessageStatus.PENDING, MessageStatus.STREAMING],
            excludeId: assistantMessage.id,
          },
          tx,
        )
        if (otherActiveAssistant !== null) {
          return { kind: 'turn_in_progress' }
        }

        await tx.tutoringAttempt.create({
          data: {
            id: attemptId,
            sessionId: session.id,
            studentMessageId: studentMessage.id,
            assistantMessageId: assistantMessage.id,
            retryOfAttemptId: previousAttempt.id,
            clientMessageId: `${studentMessage.id}:${attemptId}`,
            requestKind:
              studentMessage.requestKind ?? MessageRequestKind.CONCEPTUAL,
            status: TutoringAttemptStatus.RECEIVED,
            leaseExpiresAt: leaseExpiry(now),
          },
        })

        const admitted = await this.conversationTurns.admit(
          {
            kind: 'retry',
            courseId: session.courseId,
            sessionId: session.id,
            studentId: input.studentId,
            attemptId,
            studentMessageId: studentMessage.id,
            assistantMessageId: assistantMessage.id,
            previousAttemptId: previousAttempt.id,
            now,
          },
          asDatabaseTransaction(tx),
        )
        if (admitted.kind !== 'admitted') {
          return admitted.kind === 'turn_in_progress'
            ? admitted
            : { kind: 'attempt_not_found', attemptId: input.attemptId }
        }
        const resetAssistant = await this.findMessageOrThrow(
          { id: admitted.assistantMessage.id },
          tx,
        )
        const resetStudent = await this.findMessageOrThrow(
          { id: admitted.studentMessage.id },
          tx,
        )

        return {
          kind: 'ok',
          courseId: session.courseId,
          attemptId,
          studentMessage: resetStudent,
          assistantMessage: resetAssistant,
        }
      })
    } catch (error) {
      return this.reconcileStartedTurn(
        input,
        {
          attemptId,
        },
        error,
      )
    }
  }

  async transitionAttempt(
    input: TransitionTutoringAttemptInput,
  ): Promise<boolean> {
    const updated = await this.prismaService.tutoringAttempt.updateMany({
      where: {
        id: input.attemptId,
        status: input.expectedStatus,
        sessionId: input.sessionId,
      },
      data: {
        status: input.nextStatus,
        topicId: input.topicId ?? undefined,
        requestKind: input.requestKind ?? undefined,
      },
    })
    return updated.count === 1
  }

  async repairAutomaticReview(
    input: RepairTutoringReviewInput,
  ): Promise<RepairTutoringReviewResult> {
    return this.runTransaction(async (tx) => {
      const authorization =
        await this.conversationAuthorization.authorizeStudent(
          input,
          asDatabaseTransaction(tx),
        )
      if (authorization.kind !== 'ok') {
        return authorization
      }

      const assistant = await this.findMessage(
        {
          id: input.assistantMessageId,
          sessionId: input.sessionId,
          role: MessageRole.ASSISTANT,
          status: MessageStatus.COMPLETED,
          responseToMessageId: input.studentMessageId,
          attemptId: input.attemptId,
        },
        tx,
      )
      if (assistant === null) {
        return { kind: 'message_not_found' }
      }

      await this.reviewCaseIntake.openAutomatic(
        {
          messageId: input.assistantMessageId,
          ...input.automaticReview,
        },
        asDatabaseTransaction(tx),
      )
      return { kind: 'ok' }
    })
  }

  async completeTurn(
    input: CompleteTutoringTurnInput,
  ): Promise<FinalizeTutoringTurnResult> {
    return this.completeWithEvidence(
      input,
      {
        guidanceLabel:
          input.guidanceLabel ?? MessageGuidanceLabel.COURSE_GROUNDED,
        provider: input.provider,
        model: input.model,
        promptVersion: input.promptVersion,
        inputTokens: input.inputTokens ?? null,
        outputTokens: input.outputTokens ?? null,
        errorCode: input.errorCode ?? null,
      },
      true,
    )
  }

  completePolicyTurn(
    input: CompletePolicyTutoringTurnInput,
  ): Promise<FinalizeTutoringTurnResult> {
    return this.completeWithEvidence(
      input,
      {
        guidanceLabel: input.guidanceLabel,
        provider: null,
        model: null,
        promptVersion: input.promptVersion ?? null,
        inputTokens: null,
        outputTokens: null,
        errorCode: input.errorCode,
      },
      false,
    )
  }

  private async completeWithEvidence(
    input: CompleteTutoringTurnInput | CompletePolicyTutoringTurnInput,
    terminal: {
      guidanceLabel: MessageGuidanceLabel
      provider: string | null
      model: string | null
      promptVersion: string | null
      inputTokens: number | null
      outputTokens: number | null
      errorCode: string | null
    },
    requireEvidence: boolean,
  ): Promise<FinalizeTutoringTurnResult> {
    try {
      return await this.runTransaction(async (tx) => {
        const authorization =
          await this.conversationAuthorization.authorizeStudent(
            input,
            asDatabaseTransaction(tx),
          )
        if (authorization.kind !== 'ok') {
          return authorization
        }
        const { session } = authorization
        if (requireEvidence) {
          await this.requireEligibleEvidence(
            tx,
            session.courseId,
            input.evidence,
          )
        }

        const now = await currentDatabaseTime(tx)
        const updated = await this.transitionPendingAssistant(
          tx,
          { ...input, automaticReview: undefined },
          {
            status: MessageStatus.COMPLETED,
            content: input.content,
            ...terminal,
            requestKind: input.requestKind,
            topicId: input.topicId,
            hintLevel: input.hintLevel,
            approvalSource: input.approvalSource ?? null,
            ...('approvedCandidateAttempt' in input
              ? {
                  approvedCandidateAttempt: input.approvedCandidateAttempt,
                  safeFallbackUsed: input.safeFallbackUsed,
                  safeFallbackReason: input.safeFallbackReason,
                  validationPolicyVersion: input.validationPolicyVersion,
                }
              : {}),
            authorization: 'active_membership',
            completedAt: now,
            clearEvidence: true,
          },
        )
        if (updated.kind !== 'ok') {
          return updated
        }

        if (input.topicStateTransition !== undefined) {
          const topicId = input.topicId
          if (topicId === undefined || topicId === null) {
            throw new Error('Topic state transition requires a topic')
          }
          validateTopicStateTransition(input.topicStateTransition)
          const updatedTopicState = await tx.$queryRaw<{ topicId: string }[]>(
            Prisma.sql`
              UPDATE "topic_states"
              SET ${Prisma.join(
                topicStatePatchAssignments(input.topicStateTransition.patch),
                ', ',
              )}
              WHERE "topic_id" = ${topicId}::uuid
                AND "version" = ${input.topicStateTransition.expectedVersion}
              RETURNING "topic_id"::text AS "topicId"
            `,
          )
          if (updatedTopicState.length !== 1) {
            throw new Error(
              'Topic state changed during tutoring turn finalization',
            )
          }
        }

        if (input.evidence.length > 0) {
          await tx.messageRetrieval.createMany({
            data: input.evidence.map((entry) => ({
              messageId: input.assistantMessageId,
              chunkId: entry.chunkId,
              rank: entry.rank,
              similarityScore: entry.similarityScore,
            })),
          })
          const citations = citationRows(input)
          if (citations.length > 0) {
            await tx.messageCitation.createMany({
              data: citations.map(({ materialId, citationOrder }) => ({
                messageId: input.assistantMessageId,
                materialId,
                citationOrder,
              })),
            })
          }
        }

        if ('auditGraph' in input && input.auditGraph !== undefined) {
          await this.persistAuditGraph(tx, input.attemptId, input.auditGraph)
        }

        if (input.automaticReview !== undefined) {
          await this.reviewCaseIntake.openAutomatic(
            {
              messageId: input.assistantMessageId,
              ...input.automaticReview,
            },
            asDatabaseTransaction(tx),
          )
        }

        const message = await this.findMessageOrThrow(
          { id: input.assistantMessageId },
          tx,
        )
        return { kind: 'ok', message }
      })
    } catch (error) {
      return this.reconcileTerminalTurn(input, MessageStatus.COMPLETED, error)
    }
  }

  failTurn(
    input: FinalizeTutoringTurnInput,
  ): Promise<FinalizeTutoringTurnResult> {
    return this.persistTerminalWithoutEvidence(input, {
      status: MessageStatus.FAILED,
      content: input.content,
      guidanceLabel: null,
      errorCode: input.errorCode,
    })
  }

  blockTurn(
    input: FinalizeTutoringTurnInput,
  ): Promise<FinalizeTutoringTurnResult> {
    return this.persistTerminalWithoutEvidence(input, {
      status: MessageStatus.BLOCKED,
      content: input.content,
      guidanceLabel:
        input.guidanceLabel ?? MessageGuidanceLabel.GENERAL_NOT_FOUND,
      errorCode: input.errorCode,
    })
  }

  completeUnsupportedTurn(
    input: FinalizeTutoringTurnInput,
  ): Promise<FinalizeTutoringTurnResult> {
    return this.persistTerminalWithoutEvidence(input, {
      status: MessageStatus.COMPLETED,
      content: input.content,
      guidanceLabel: MessageGuidanceLabel.UNCERTAIN_AWAITING_REVIEW,
      errorCode: input.errorCode,
    })
  }

  completeSafetyTurn(
    input: CompleteSafetyTutoringTurnInput,
  ): Promise<FinalizeTutoringTurnResult> {
    return this.persistTerminalWithoutEvidence(input, {
      status: MessageStatus.COMPLETED,
      content: input.content,
      guidanceLabel: input.guidanceLabel,
      errorCode: input.errorCode,
    })
  }

  readTurnForStudent(
    input: ReadTutoringTurnInput,
  ): Promise<ReadTutoringTurnResult> {
    return this.runTransaction(async (tx) => {
      const authorization =
        await this.conversationAuthorization.authorizeStudent(
          input,
          asDatabaseTransaction(tx),
        )
      if (authorization.kind !== 'ok') {
        return authorization
      }

      const studentMessage = await this.findMessage(
        {
          id: input.studentMessageId,
          sessionId: input.sessionId,
          role: MessageRole.STUDENT,
          authorUserId: input.studentId,
          studentId: input.studentId,
        },
        tx,
      )
      if (studentMessage === null) {
        return { kind: 'message_not_found', messageId: input.studentMessageId }
      }

      const assistantMessage = await this.findMessage(
        {
          id: input.assistantMessageId,
          sessionId: input.sessionId,
          role: MessageRole.ASSISTANT,
          responseToMessageId: input.studentMessageId,
          studentId: input.studentId,
        },
        tx,
      )
      if (assistantMessage === null) {
        return {
          kind: 'message_not_found',
          messageId: input.assistantMessageId,
        }
      }

      return { kind: 'ok', studentMessage, assistantMessage }
    })
  }

  private async persistTerminalWithoutEvidence(
    input: FinalizeTutoringTurnInput,
    terminal: {
      status:
        | typeof MessageStatus.COMPLETED
        | typeof MessageStatus.FAILED
        | typeof MessageStatus.BLOCKED
      content: string
      guidanceLabel: MessageGuidanceLabel | null
      errorCode: string
    },
  ): Promise<FinalizeTutoringTurnResult> {
    try {
      return await this.runTransaction(async (tx) => {
        const authorization =
          terminal.status === MessageStatus.FAILED ||
          terminal.status === MessageStatus.BLOCKED
            ? await this.lockExactTurnSession(tx, input)
            : await this.conversationAuthorization.authorizeStudent(
                input,
                asDatabaseTransaction(tx),
              )
        if (authorization.kind !== 'ok') {
          return authorization
        }
        const now = await currentDatabaseTime(tx)
        const requestKind =
          input.requestKind !== undefined
            ? input.requestKind
            : (
                await tx.tutoringAttempt.findUnique({
                  where: { id: input.attemptId },
                  select: { requestKind: true },
                })
              )?.requestKind
        const updated = await this.transitionPendingAssistant(tx, input, {
          ...terminal,
          requestKind,
          authorization:
            terminal.status === MessageStatus.FAILED ||
            terminal.status === MessageStatus.BLOCKED
              ? 'session_owner'
              : 'active_membership',
          provider: null,
          model: null,
          promptVersion: null,
          inputTokens: null,
          outputTokens: null,
          completedAt: now,
          clearEvidence: true,
        })
        if (updated.kind !== 'ok') {
          return updated
        }

        return updated
      })
    } catch (error) {
      return this.reconcileTerminalTurn(input, terminal.status, error)
    }
  }

  private async transitionPendingAssistant(
    tx: Prisma.TransactionClient,
    input: {
      courseId: string
      sessionId: string
      studentId: string
      studentMessageId: string
      assistantMessageId: string
      attemptId: string
      automaticReview?: Omit<AutomaticReviewIntakeInput, 'messageId'>
      topicId?: string | null
      requestKind?: MessageRequestKind | null
      approvalSource?: TutoringApprovalSource | null
      hintLevel?: number | null
      approvedCandidateAttempt?: number | null
      safeFallbackUsed?: boolean
      safeFallbackReason?: TutoringSafeFallbackReason | null
      validationPolicyVersion?: string | null
    },
    data: TerminalConversationMessageData,
  ): Promise<FinalizeTutoringTurnResult> {
    const finalized = await this.conversationTurns.finalize(
      {
        courseId: input.courseId,
        sessionId: input.sessionId,
        studentId: input.studentId,
        attemptId: input.attemptId,
        studentMessageId: input.studentMessageId,
        assistantMessageId: input.assistantMessageId,
        topicId: data.topicId,
        status: data.status,
        content: data.content,
        errorCode: data.errorCode,
        requestKind: data.requestKind,
        hintLevel: data.hintLevel,
        guidanceLabel: data.guidanceLabel,
        provider: data.provider,
        model: data.model,
        promptVersion: data.promptVersion,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        clearEvidence: data.clearEvidence,
        authorization: data.authorization,
        completedAt: data.completedAt,
      },
      asDatabaseTransaction(tx),
    )
    if (finalized.kind === 'finalized') {
      const attemptStatus =
        data.status === MessageStatus.COMPLETED
          ? TutoringAttemptStatus.COMPLETED
          : TutoringAttemptStatus.FAILED
      const updatedAttempts = await tx.tutoringAttempt.updateMany({
        where: {
          id: input.attemptId,
          assistantMessageId: input.assistantMessageId,
        },
        data: {
          status: attemptStatus,
          topicId: data.topicId ?? undefined,
          failureCode:
            attemptStatus === TutoringAttemptStatus.FAILED
              ? TutoringAttemptFailureCode.PERSISTENCE_FAILED
              : null,
          approvalSource:
            data.approvalSource ??
            (attemptStatus === TutoringAttemptStatus.COMPLETED
              ? TutoringApprovalSource.CLASSIFIED_RESPONSE
              : null),
          approvedCandidateAttempt: data.approvedCandidateAttempt ?? null,
          safeFallbackUsed: data.safeFallbackUsed ?? false,
          safeFallbackReason: data.safeFallbackReason ?? null,
          validationPolicyVersion:
            data.validationPolicyVersion ??
            (attemptStatus === TutoringAttemptStatus.COMPLETED
              ? 'tutoring-attempt-admission-v1'
              : null),
          leaseExpiresAt: null,
          completedAt: new Date(),
        },
      })
      if (updatedAttempts.count !== 1) {
        throw new Error('Tutoring Attempt changed during message finalization')
      }
      if (input.automaticReview !== undefined) {
        await this.reviewCaseIntake.openAutomatic(
          {
            messageId: input.assistantMessageId,
            ...input.automaticReview,
          },
          asDatabaseTransaction(tx),
        )
      }
      await this.auditService.recordEvent(
        {
          actorUserId: input.studentId,
          action:
            data.status === MessageStatus.COMPLETED
              ? AUDIT_EVENT_ACTIONS.CHAT_TURN_COMPLETED
              : AUDIT_EVENT_ACTIONS.CHAT_TURN_FAILED,
          target: {
            type: AUDIT_TARGET_TYPES.MESSAGE,
            id: input.assistantMessageId,
          },
          courseId: input.courseId,
          metadata: {
            attemptId: input.attemptId,
            status: data.status,
          },
        },
        asDatabaseTransaction(tx),
      )
      const message = await this.findMessageOrThrow(
        { id: input.assistantMessageId },
        tx,
      )
      return { kind: 'ok', message }
    }

    if (
      finalized.kind !== 'message_not_found' &&
      finalized.kind !== 'message_not_pending'
    ) {
      return finalized
    }

    // The previous terminal write may have committed even when its caller lost
    // both the acknowledgement and the first reconciliation read. An exact
    // terminal state for this attempt is authoritative and must not be replaced
    // with a generic failure or surfaced as an untrustworthy 503.
    const existing = await this.findMessage(
      {
        id: input.assistantMessageId,
        sessionId: input.sessionId,
        role: MessageRole.ASSISTANT,
        responseToMessageId: input.studentMessageId,
      },
      tx,
    )
    if (existing === null) {
      return {
        kind: 'message_not_found',
        messageId: input.assistantMessageId,
      }
    }
    if (
      existing.attemptId === input.attemptId &&
      isTerminalMessageStatus(existing.status)
    ) {
      return { kind: 'ok', message: existing }
    }

    return {
      kind: 'message_not_pending',
      messageId: input.assistantMessageId,
    }
  }

  private async requireEligibleEvidence(
    tx: Prisma.TransactionClient,
    courseId: string,
    evidence: readonly TutoringEvidenceInput[],
  ): Promise<void> {
    if (evidence.length === 0) {
      throw new TutoringEvidenceUnavailableError()
    }

    const chunks = await tx.materialChunk.findMany({
      where: {
        id: { in: evidence.map((entry) => entry.chunkId) },
        material: {
          courseId,
          status: { in: [MaterialStatus.READY, MaterialStatus.WARNING] },
          deletedAt: null,
          extractedTextLength: { gt: 0 },
          chunkCount: { gt: 0 },
        },
      },
      select: { id: true, materialId: true },
    })
    const materialByChunkId = new Map(
      chunks.map((chunk) => [chunk.id, chunk.materialId]),
    )
    if (
      !evidence.every(
        (entry) => materialByChunkId.get(entry.chunkId) === entry.materialId,
      )
    ) {
      throw new TutoringEvidenceUnavailableError()
    }
  }

  private async persistAuditGraph(
    tx: Prisma.TransactionClient,
    attemptId: string,
    auditGraph: ResponseAuditGraph,
  ): Promise<void> {
    if (auditGraph.candidateAttempts.length > 0) {
      await tx.tutoringCandidateAttempt.createMany({
        data: auditGraph.candidateAttempts.map((attempt) => ({
          attemptId,
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
    }
    if (auditGraph.guardResults.length > 0) {
      await tx.guardResult.createMany({
        data: auditGraph.guardResults.map((guard) => ({
          attemptId,
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
  }

  private async lockExactTurnSession(
    tx: Prisma.TransactionClient,
    input: AuthorizedTurnInput,
  ): Promise<AuthorizationResult> {
    return this.conversationAuthorization.authorizeSessionOwner(
      input,
      asDatabaseTransaction(tx),
    )
  }

  private async failExpiredActiveTurns(
    tx: Prisma.TransactionClient,
    scope: AuthorizedTurnInput,
    now: Date,
  ): Promise<void> {
    const expired = await tx.tutoringAttempt.findMany({
      where: {
        sessionId: scope.sessionId,
        status: {
          in: [
            TutoringAttemptStatus.RECEIVED,
            TutoringAttemptStatus.ANALYZING,
            TutoringAttemptStatus.RETRIEVING,
            TutoringAttemptStatus.DECIDING,
            TutoringAttemptStatus.GENERATING,
            TutoringAttemptStatus.VALIDATING,
            TutoringAttemptStatus.REGENERATING,
          ],
        },
        OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } }],
      },
      select: {
        id: true,
        studentMessageId: true,
        assistantMessageId: true,
      },
    })
    if (expired.length === 0) {
      return
    }

    const attemptIds = expired.map(({ id }) => id)
    for (const attempt of expired) {
      if (
        attempt.studentMessageId === null ||
        attempt.assistantMessageId === null
      ) {
        continue
      }

      const finalized = await this.conversationTurns.finalize(
        {
          courseId: scope.courseId,
          sessionId: scope.sessionId,
          studentId: scope.studentId,
          attemptId: attempt.id,
          studentMessageId: attempt.studentMessageId,
          assistantMessageId: attempt.assistantMessageId,
          status: MessageStatus.FAILED,
          content: GROUNDING_FAILED_CONTENT,
          errorCode: GROUNDING_ATTEMPT_EXPIRED,
          provider: null,
          model: null,
          promptVersion: null,
          inputTokens: null,
          outputTokens: null,
          authorization: 'session_owner',
          completedAt: now,
          clearEvidence: true,
        },
        asDatabaseTransaction(tx),
      )
      if (
        finalized.kind === 'membership_missing' ||
        finalized.kind === 'session_not_found'
      ) {
        throw new Error(
          `Expired Tutoring Attempt ${attempt.id} lost its Conversation authorization`,
        )
      }
    }

    await tx.tutoringAttempt.updateMany({
      where: { id: { in: attemptIds } },
      data: {
        status: TutoringAttemptStatus.FAILED,
        failureCode: TutoringAttemptFailureCode.PERSISTENCE_FAILED,
        leaseExpiresAt: null,
        completedAt: now,
      },
    })
  }

  private async reconcileStartedTurn(
    input: AuthorizedTurnInput,
    identity: {
      studentMessageId?: string
      assistantMessageId?: string
      attemptId: string
    },
    originalError: unknown,
  ): Promise<Extract<BeginTutoringTurnResult, { kind: 'ok' }>> {
    try {
      const reconciled = await this.prismaService.$transaction(async (tx) => {
        const session = await tx.chatSession.findFirst({
          where: {
            id: input.sessionId,
            courseId: input.courseId,
            studentId: input.studentId,
          },
          select: { courseId: true },
        })
        if (session === null) {
          return null
        }

        const attempt = await tx.tutoringAttempt.findUnique({
          where: { id: identity.attemptId },
          select: { studentMessageId: true, assistantMessageId: true },
        })
        const studentMessageId =
          identity.studentMessageId ?? attempt?.studentMessageId
        const assistantMessageId =
          identity.assistantMessageId ?? attempt?.assistantMessageId
        if (studentMessageId === null || studentMessageId === undefined) {
          return null
        }

        const studentMessage = await this.findMessage(
          {
            id: studentMessageId,
            sessionId: input.sessionId,
            role: MessageRole.STUDENT,
            authorUserId: input.studentId,
          },
          tx,
        )
        if (studentMessage === null) {
          return null
        }

        const assistantMessage = await this.findMessage(
          {
            ...(assistantMessageId === null || assistantMessageId === undefined
              ? {}
              : { id: assistantMessageId }),
            sessionId: input.sessionId,
            role: MessageRole.ASSISTANT,
            responseToMessageId: studentMessage.id,
            status: MessageStatus.PENDING,
            attemptId: identity.attemptId,
          },
          tx,
        )
        if (assistantMessage === null) {
          return null
        }

        return {
          kind: 'ok' as const,
          courseId: session.courseId,
          attemptId: identity.attemptId,
          studentMessage,
          assistantMessage,
        }
      })
      if (reconciled !== null) {
        return reconciled
      }
    } catch {
      // The original failure remains the most accurate safe category. Neither
      // exception is persisted or returned to the client.
    }

    throw originalError
  }

  private async reconcileTerminalTurn(
    input:
      | CompleteTutoringTurnInput
      | CompletePolicyTutoringTurnInput
      | FinalizeTutoringTurnInput,
    expectedStatus:
      | typeof MessageStatus.COMPLETED
      | typeof MessageStatus.FAILED
      | typeof MessageStatus.BLOCKED,
    originalError: unknown,
  ): Promise<FinalizeTutoringTurnResult> {
    try {
      const message = await this.prismaService.$transaction(async (tx) => {
        const exact = await this.findMessage(
          {
            id: input.assistantMessageId,
            sessionId: input.sessionId,
            role: MessageRole.ASSISTANT,
            responseToMessageId: input.studentMessageId,
            attemptId: input.attemptId,
            status: expectedStatus,
          },
          tx,
        )
        if (exact === null) {
          return null
        }

        const session = await tx.chatSession.findFirst({
          where: {
            id: input.sessionId,
            courseId: input.courseId,
            studentId: input.studentId,
          },
          select: { id: true },
        })
        return session === null ? null : exact
      })
      if (message !== null) {
        return { kind: 'ok', message }
      }
    } catch {
      // Preserve the original sanitized failure category at the service seam.
    }

    throw originalError
  }

  private findMessage(
    input: ConversationMessageLookup & { readonly studentId?: string },
    tx: Prisma.TransactionClient,
  ): Promise<ChatMessageRecord | null> {
    return this.conversationMessages.find(input, asDatabaseTransaction(tx))
  }

  private async findMessageOrThrow(
    input: ConversationMessageLookup & { readonly studentId?: string },
    tx: Prisma.TransactionClient,
  ): Promise<ChatMessageRecord> {
    const message = await this.findMessage(input, tx)
    if (message === null) {
      throw new Error(
        `Conversation message not found: ${input.id ?? 'unknown'}`,
      )
    }

    return message
  }

  private async runTransaction<T>(
    callback: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
      try {
        return await this.prismaService.$transaction(callback)
      } catch (error) {
        if (!isWriteConflict(error) || attempt === MAX_TRANSACTION_ATTEMPTS) {
          throw error
        }
      }
    }

    throw new Error('Unreachable transaction retry state')
  }
}

interface TerminalConversationMessageData {
  status:
    | typeof MessageStatus.COMPLETED
    | typeof MessageStatus.FAILED
    | typeof MessageStatus.BLOCKED
  content: string
  guidanceLabel: MessageGuidanceLabel | null
  provider: string | null
  model: string | null
  promptVersion: string | null
  inputTokens: number | null
  outputTokens: number | null
  errorCode: string | null
  requestKind?: MessageRequestKind | null
  topicId?: string | null
  hintLevel?: number | null
  approvalSource?: TutoringApprovalSource | null
  approvedCandidateAttempt?: number | null
  safeFallbackUsed?: boolean
  safeFallbackReason?: TutoringSafeFallbackReason | null
  validationPolicyVersion?: string | null
  clearEvidence?: boolean
  authorization: 'active_membership' | 'session_owner'
  completedAt: Date
}

function orderedCitationMaterialIds(
  evidence: readonly TutoringEvidenceInput[],
): string[] {
  const seen = new Set<string>()
  const ordered: string[] = []
  for (const entry of [...evidence].sort((a, b) => a.rank - b.rank)) {
    if (!seen.has(entry.materialId)) {
      seen.add(entry.materialId)
      ordered.push(entry.materialId)
    }
  }
  return ordered
}

function citationRows(
  input: CompleteTutoringTurnInput | CompletePolicyTutoringTurnInput,
): readonly { readonly materialId: string; readonly citationOrder: number }[] {
  if (
    !('citationContextIndexes' in input) ||
    input.citationContextIndexes === undefined
  ) {
    return orderedCitationMaterialIds(input.evidence).map(
      (materialId, index) => ({ materialId, citationOrder: index + 1 }),
    )
  }

  const seen = new Set<string>()
  const ordered: { materialId: string; citationOrder: number }[] = []

  for (const citationOrder of [...new Set(input.citationContextIndexes)].sort(
    (left, right) => left - right,
  )) {
    const citedEvidence = input.evidence.at(citationOrder - 1)
    if (citedEvidence === undefined) {
      throw new TutoringEvidenceUnavailableError()
    }
    if (!seen.has(citedEvidence.materialId)) {
      seen.add(citedEvidence.materialId)
      ordered.push({ materialId: citedEvidence.materialId, citationOrder })
    }
  }

  return ordered
}

function leaseExpiry(now: Date): Date {
  return new Date(now.getTime() + GROUNDING_ATTEMPT_LEASE_MS)
}

function isRetryableAttempt(
  assistant: {
    status: TutoringAttemptStatus
    leaseExpiresAt: Date | null
  },
  now: Date,
): boolean {
  if (assistant.status === TutoringAttemptStatus.FAILED) {
    return true
  }

  return (
    assistant.status !== TutoringAttemptStatus.COMPLETED &&
    (assistant.leaseExpiresAt === null || assistant.leaseExpiresAt <= now)
  )
}

function isTerminalMessageStatus(status: MessageStatus): boolean {
  return (
    status === MessageStatus.COMPLETED ||
    status === MessageStatus.FAILED ||
    status === MessageStatus.BLOCKED
  )
}

function isWriteConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2034'
  )
}
