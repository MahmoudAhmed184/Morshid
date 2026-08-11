import { randomUUID } from 'node:crypto'

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
} from '../../generated/prisma/client'
import {
  lockAuthorizedStudentChat,
  type LockedStudentChatAuthorizationResult,
  type LockedStudentChatSession,
} from '../../common/authorization/locked-student-chat-session'
import { ConversationTurns } from '../conversations/conversation-turns'
import {
  AUDIT_EVENT_ACTIONS,
  AUDIT_TARGET_TYPES,
  AuditService,
} from '../audit/audit.public'
import { asDatabaseTransaction } from '../prisma/database-transaction'
import { PrismaService } from '../prisma/prisma.service'
import {
  ReviewCaseIntake,
  type AutomaticReviewIntakeInput,
} from '../reviews/reviews.public'
import {
  chatMessageSelect,
  chatMessageSelectForStudent,
  currentDatabaseTime,
} from './student-chat.repository.support'
import type { ChatMessageRecord } from './student-chat.repository.types'
import {
  GROUNDING_ATTEMPT_EXPIRED,
  GROUNDING_ATTEMPT_LEASE_MS,
  GROUNDING_FAILED_CONTENT,
} from './grounded-chat.constants'

const MAX_TRANSACTION_ATTEMPTS = 3

interface AuthorizedTurnInput {
  courseId: string
  sessionId: string
  studentId: string
}

export interface BeginGroundedChatTurnInput extends AuthorizedTurnInput {
  clientMessageId?: string
  content: string
  requestKind?: MessageRequestKind
}

export interface RetryGroundedChatTurnInput extends AuthorizedTurnInput {
  studentMessageId: string
}

export interface RepairGroundedChatReviewInput extends AuthorizedTurnInput {
  attemptId: string
  studentMessageId: string
  assistantMessageId: string
  automaticReview: Omit<AutomaticReviewIntakeInput, 'messageId'>
}

export interface GroundedChatEvidenceInput {
  chunkId: string
  materialId: string
  materialTitle: string
  chunkIndex: number
  content: string
  rank: number
  similarityScore: number
}

export interface CompleteGroundedChatTurnInput extends AuthorizedTurnInput {
  attemptId: string
  studentMessageId: string
  assistantMessageId: string
  content: string
  provider: string
  model: string
  promptVersion: string
  inputTokens?: number
  outputTokens?: number
  evidence: readonly GroundedChatEvidenceInput[]
  citationContextIndexes?: readonly number[]
  guidanceLabel?: MessageGuidanceLabel
  errorCode?: string
  automaticReview?: Omit<AutomaticReviewIntakeInput, 'messageId'>
}

export interface CompletePolicyGroundedChatTurnInput extends AuthorizedTurnInput {
  attemptId: string
  studentMessageId: string
  assistantMessageId: string
  content: string
  evidence: readonly GroundedChatEvidenceInput[]
  guidanceLabel: MessageGuidanceLabel
  errorCode: string
  automaticReview?: Omit<AutomaticReviewIntakeInput, 'messageId'>
}

export interface FinalizeGroundedChatTurnInput extends AuthorizedTurnInput {
  attemptId: string
  studentMessageId: string
  assistantMessageId: string
  content: string
  errorCode: string
  guidanceLabel?: MessageGuidanceLabel
  automaticReview?: Omit<AutomaticReviewIntakeInput, 'messageId'>
}

export interface CompleteSafetyGroundedChatTurnInput extends FinalizeGroundedChatTurnInput {
  guidanceLabel: MessageGuidanceLabel
}

export interface ReadGroundedChatTurnInput extends AuthorizedTurnInput {
  studentMessageId: string
  assistantMessageId: string
}

export type BeginGroundedChatTurnResult =
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
  | { kind: 'turn_in_progress' }

export type RetryGroundedChatTurnResult =
  | {
      kind: 'ok'
      courseId: string
      attemptId: string
      studentMessage: ChatMessageRecord
      assistantMessage: ChatMessageRecord
    }
  | { kind: 'membership_missing' }
  | { kind: 'session_not_found' }
  | { kind: 'message_not_found'; messageId: string }
  | { kind: 'retry_not_allowed'; messageId: string }
  | { kind: 'turn_in_progress' }

export type RepairGroundedChatReviewResult =
  | { kind: 'ok' }
  | { kind: 'membership_missing' }
  | { kind: 'session_not_found' }
  | { kind: 'message_not_found' }

export type FinalizeGroundedChatTurnResult =
  | { kind: 'ok'; message: ChatMessageRecord }
  | { kind: 'membership_missing' }
  | { kind: 'session_not_found' }
  | { kind: 'message_not_found'; messageId: string }
  | { kind: 'message_not_pending'; messageId: string }

export type ReadGroundedChatTurnResult =
  | {
      kind: 'ok'
      studentMessage: ChatMessageRecord
      assistantMessage: ChatMessageRecord
    }
  | { kind: 'membership_missing' }
  | { kind: 'session_not_found' }
  | { kind: 'message_not_found'; messageId: string }

type AuthorizationResult = LockedStudentChatAuthorizationResult

export class GroundedChatEvidenceUnavailableError extends Error {
  constructor() {
    super('Grounded chat evidence is no longer available')
    this.name = 'GroundedChatEvidenceUnavailableError'
  }
}

export abstract class GroundedChatTurnRepository {
  abstract beginTurn(
    input: BeginGroundedChatTurnInput,
  ): Promise<BeginGroundedChatTurnResult>

  abstract retryTurn(
    input: RetryGroundedChatTurnInput,
  ): Promise<RetryGroundedChatTurnResult>

  abstract repairAutomaticReview(
    input: RepairGroundedChatReviewInput,
  ): Promise<RepairGroundedChatReviewResult>

  abstract completeTurn(
    input: CompleteGroundedChatTurnInput,
  ): Promise<FinalizeGroundedChatTurnResult>

  abstract completePolicyTurn(
    input: CompletePolicyGroundedChatTurnInput,
  ): Promise<FinalizeGroundedChatTurnResult>

  abstract failTurn(
    input: FinalizeGroundedChatTurnInput,
  ): Promise<FinalizeGroundedChatTurnResult>

  abstract blockTurn(
    input: FinalizeGroundedChatTurnInput,
  ): Promise<FinalizeGroundedChatTurnResult>

  abstract completeUnsupportedTurn(
    input: FinalizeGroundedChatTurnInput,
  ): Promise<FinalizeGroundedChatTurnResult>

  abstract completeSafetyTurn(
    input: CompleteSafetyGroundedChatTurnInput,
  ): Promise<FinalizeGroundedChatTurnResult>

  abstract readTurnForStudent(
    input: ReadGroundedChatTurnInput,
  ): Promise<ReadGroundedChatTurnResult>
}

@Injectable()
export class PrismaGroundedChatTurnRepository extends GroundedChatTurnRepository {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly conversationTurns: ConversationTurns,
    private readonly reviewCaseIntake: ReviewCaseIntake,
    private readonly auditService: AuditService,
  ) {
    super()
  }

  async beginTurn(
    input: BeginGroundedChatTurnInput,
  ): Promise<BeginGroundedChatTurnResult> {
    const identity = {
      studentMessageId: input.clientMessageId ?? randomUUID(),
      assistantMessageId: randomUUID(),
      attemptId: randomUUID(),
    }

    try {
      return await this.runTransaction(async (tx) => {
        const authorization = await lockAuthorizedStudentChat(tx, input)
        if (authorization.kind !== 'ok') {
          return authorization
        }
        const { session } = authorization
        const now = await currentDatabaseTime(tx)
        await this.failExpiredActiveTurns(tx, session.id, now)

        if (input.clientMessageId !== undefined) {
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
                : await tx.message.findUnique({
                    where: { id: replayedAttempt.studentMessageId },
                    select: chatMessageSelect,
                  })
            const replayedAssistant =
              replayedAttempt.assistantMessageId === null
                ? null
                : await tx.message.findUnique({
                    where: { id: replayedAttempt.assistantMessageId },
                    select: chatMessageSelect,
                  })
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

            return { kind: 'turn_in_progress' as const }
          }
        }

        await tx.tutoringAttempt.create({
          data: {
            id: identity.attemptId,
            sessionId: session.id,
            clientMessageId: input.clientMessageId ?? identity.studentMessageId,
            requestKind: input.requestKind ?? null,
            status: TutoringAttemptStatus.RECEIVED,
            leaseExpiresAt: leaseExpiry(now),
            claimToken: identity.attemptId,
            claimedAt: now,
          },
        })
        const admitted = await this.conversationTurns.admit(
          {
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
        const studentMessage = await tx.message.findUniqueOrThrow({
          where: { id: admitted.studentMessage.id },
          select: chatMessageSelect,
        })
        const assistantMessage = await tx.message.findUniqueOrThrow({
          where: { id: admitted.assistantMessage.id },
          select: chatMessageSelect,
        })
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
    input: RetryGroundedChatTurnInput,
  ): Promise<RetryGroundedChatTurnResult> {
    const attemptId = randomUUID()

    try {
      return await this.runTransaction(async (tx) => {
        const authorization = await lockAuthorizedStudentChat(tx, input)
        if (authorization.kind !== 'ok') {
          return authorization
        }
        const { session } = authorization
        const now = await currentDatabaseTime(tx)
        await this.failExpiredActiveTurns(tx, session.id, now)
        const studentMessage = await tx.message.findFirst({
          where: {
            id: input.studentMessageId,
            sessionId: session.id,
            role: MessageRole.STUDENT,
            authorUserId: input.studentId,
          },
          select: chatMessageSelect,
        })
        if (studentMessage === null) {
          return {
            kind: 'message_not_found',
            messageId: input.studentMessageId,
          }
        }

        const assistantMessage = await tx.message.findUnique({
          where: { responseToMessageId: studentMessage.id },
          select: chatMessageSelect,
        })
        if (assistantMessage?.role !== MessageRole.ASSISTANT) {
          return {
            kind: 'message_not_found',
            messageId: input.studentMessageId,
          }
        }
        const previousAttemptId = assistantMessage.attemptId
        const previousAttempt =
          previousAttemptId === null
            ? null
            : await tx.tutoringAttempt.findUnique({
                where: { id: previousAttemptId },
                select: {
                  id: true,
                  leaseExpiresAt: true,
                  status: true,
                },
              })
        if (
          previousAttempt === null ||
          !isRetryableAttempt(previousAttempt, now)
        ) {
          return {
            kind: 'retry_not_allowed',
            messageId: input.studentMessageId,
          }
        }

        const otherActiveAssistant = await tx.message.findFirst({
          where: {
            sessionId: session.id,
            role: MessageRole.ASSISTANT,
            status: { in: [MessageStatus.PENDING, MessageStatus.STREAMING] },
            id: { not: assistantMessage.id },
          },
          select: { id: true },
        })
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
            claimToken: attemptId,
            claimedAt: now,
          },
        })

        await tx.messageRetrieval.deleteMany({
          where: { messageId: assistantMessage.id },
        })
        await tx.messageCitation.deleteMany({
          where: { messageId: assistantMessage.id },
        })
        await tx.message.update({
          where: { id: studentMessage.id },
          data: { attemptId },
        })
        const resetAssistant = await tx.message.update({
          where: { id: assistantMessage.id },
          data: {
            status: MessageStatus.PENDING,
            content: '',
            guidanceLabel: null,
            provider: null,
            model: null,
            promptVersion: null,
            inputTokens: null,
            outputTokens: null,
            errorCode: null,
            errorMessage: null,
            attemptId,
            completedAt: null,
          },
          select: chatMessageSelect,
        })

        return {
          kind: 'ok',
          courseId: session.courseId,
          attemptId,
          studentMessage,
          assistantMessage: resetAssistant,
        }
      })
    } catch (error) {
      return this.reconcileStartedTurn(
        input,
        {
          studentMessageId: input.studentMessageId,
          attemptId,
        },
        error,
      )
    }
  }

  async repairAutomaticReview(
    input: RepairGroundedChatReviewInput,
  ): Promise<RepairGroundedChatReviewResult> {
    return this.runTransaction(async (tx) => {
      const authorization = await lockAuthorizedStudentChat(tx, input)
      if (authorization.kind !== 'ok') {
        return authorization
      }

      const assistant = await tx.message.findFirst({
        where: {
          id: input.assistantMessageId,
          sessionId: input.sessionId,
          role: MessageRole.ASSISTANT,
          status: MessageStatus.COMPLETED,
          responseToMessageId: input.studentMessageId,
          attemptId: input.attemptId,
        },
        select: { id: true },
      })
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
    input: CompleteGroundedChatTurnInput,
  ): Promise<FinalizeGroundedChatTurnResult> {
    return this.completeWithEvidence(input, {
      guidanceLabel:
        input.guidanceLabel ?? MessageGuidanceLabel.COURSE_GROUNDED,
      provider: input.provider,
      model: input.model,
      promptVersion: input.promptVersion,
      inputTokens: input.inputTokens ?? null,
      outputTokens: input.outputTokens ?? null,
      errorCode: input.errorCode ?? null,
    })
  }

  completePolicyTurn(
    input: CompletePolicyGroundedChatTurnInput,
  ): Promise<FinalizeGroundedChatTurnResult> {
    return this.completeWithEvidence(input, {
      guidanceLabel: input.guidanceLabel,
      provider: null,
      model: null,
      promptVersion: null,
      inputTokens: null,
      outputTokens: null,
      errorCode: input.errorCode,
    })
  }

  private async completeWithEvidence(
    input: CompleteGroundedChatTurnInput | CompletePolicyGroundedChatTurnInput,
    terminal: {
      guidanceLabel: MessageGuidanceLabel
      provider: string | null
      model: string | null
      promptVersion: string | null
      inputTokens: number | null
      outputTokens: number | null
      errorCode: string | null
    },
  ): Promise<FinalizeGroundedChatTurnResult> {
    try {
      return await this.runTransaction(async (tx) => {
        const authorization = await lockAuthorizedStudentChat(tx, input)
        if (authorization.kind !== 'ok') {
          return authorization
        }
        const { session } = authorization
        await this.requireEligibleEvidence(tx, session.courseId, input.evidence)

        const now = await currentDatabaseTime(tx)
        const updated = await this.transitionPendingAssistant(
          tx,
          { ...input, automaticReview: undefined },
          {
            status: MessageStatus.COMPLETED,
            content: input.content,
            ...terminal,
            authorization: 'active_membership',
            completedAt: now,
          },
        )
        if (updated.kind !== 'ok') {
          return updated
        }

        await tx.messageRetrieval.deleteMany({
          where: { messageId: input.assistantMessageId },
        })
        await tx.messageCitation.deleteMany({
          where: { messageId: input.assistantMessageId },
        })
        await tx.messageRetrieval.createMany({
          data: input.evidence.map((entry) => ({
            messageId: input.assistantMessageId,
            chunkId: entry.chunkId,
            rank: entry.rank,
            similarityScore: entry.similarityScore,
          })),
        })
        await tx.messageCitation.createMany({
          data: citationRows(input).map(({ materialId, citationOrder }) => ({
            messageId: input.assistantMessageId,
            materialId,
            citationOrder,
          })),
        })

        if (input.automaticReview !== undefined) {
          await this.reviewCaseIntake.openAutomatic(
            {
              messageId: input.assistantMessageId,
              ...input.automaticReview,
            },
            asDatabaseTransaction(tx),
          )
        }

        const message = await tx.message.findUniqueOrThrow({
          where: { id: input.assistantMessageId },
          select: chatMessageSelect,
        })
        return { kind: 'ok', message }
      })
    } catch (error) {
      return this.reconcileTerminalTurn(input, MessageStatus.COMPLETED, error)
    }
  }

  failTurn(
    input: FinalizeGroundedChatTurnInput,
  ): Promise<FinalizeGroundedChatTurnResult> {
    return this.persistTerminalWithoutEvidence(input, {
      status: MessageStatus.FAILED,
      content: input.content,
      guidanceLabel: null,
      errorCode: input.errorCode,
    })
  }

  blockTurn(
    input: FinalizeGroundedChatTurnInput,
  ): Promise<FinalizeGroundedChatTurnResult> {
    return this.persistTerminalWithoutEvidence(input, {
      status: MessageStatus.BLOCKED,
      content: input.content,
      guidanceLabel:
        input.guidanceLabel ?? MessageGuidanceLabel.GENERAL_NOT_FOUND,
      errorCode: input.errorCode,
    })
  }

  completeUnsupportedTurn(
    input: FinalizeGroundedChatTurnInput,
  ): Promise<FinalizeGroundedChatTurnResult> {
    return this.persistTerminalWithoutEvidence(input, {
      status: MessageStatus.COMPLETED,
      content: input.content,
      guidanceLabel: MessageGuidanceLabel.UNCERTAIN_AWAITING_REVIEW,
      errorCode: input.errorCode,
    })
  }

  completeSafetyTurn(
    input: CompleteSafetyGroundedChatTurnInput,
  ): Promise<FinalizeGroundedChatTurnResult> {
    return this.persistTerminalWithoutEvidence(input, {
      status: MessageStatus.COMPLETED,
      content: input.content,
      guidanceLabel: input.guidanceLabel,
      errorCode: input.errorCode,
    })
  }

  readTurnForStudent(
    input: ReadGroundedChatTurnInput,
  ): Promise<ReadGroundedChatTurnResult> {
    return this.runTransaction(async (tx) => {
      const authorization = await lockAuthorizedStudentChat(tx, input)
      if (authorization.kind !== 'ok') {
        return authorization
      }

      const studentMessage = await tx.message.findFirst({
        where: {
          id: input.studentMessageId,
          sessionId: input.sessionId,
          role: MessageRole.STUDENT,
          authorUserId: input.studentId,
        },
        select: chatMessageSelectForStudent(input.studentId),
      })
      if (studentMessage === null) {
        return { kind: 'message_not_found', messageId: input.studentMessageId }
      }

      const assistantMessage = await tx.message.findFirst({
        where: {
          id: input.assistantMessageId,
          sessionId: input.sessionId,
          role: MessageRole.ASSISTANT,
          responseToMessageId: input.studentMessageId,
        },
        select: chatMessageSelectForStudent(input.studentId),
      })
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
    input: FinalizeGroundedChatTurnInput,
    terminal: {
      status:
        | typeof MessageStatus.COMPLETED
        | typeof MessageStatus.FAILED
        | typeof MessageStatus.BLOCKED
      content: string
      guidanceLabel: MessageGuidanceLabel | null
      errorCode: string
    },
  ): Promise<FinalizeGroundedChatTurnResult> {
    try {
      return await this.runTransaction(async (tx) => {
        const authorization =
          terminal.status === MessageStatus.FAILED ||
          terminal.status === MessageStatus.BLOCKED
            ? await this.lockExactTurnSession(tx, input)
            : await lockAuthorizedStudentChat(tx, input)
        if (authorization.kind !== 'ok') {
          return authorization
        }
        const now = await currentDatabaseTime(tx)
        const updated = await this.transitionPendingAssistant(tx, input, {
          ...terminal,
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
        })
        if (updated.kind !== 'ok') {
          return updated
        }

        await tx.messageRetrieval.deleteMany({
          where: { messageId: input.assistantMessageId },
        })
        await tx.messageCitation.deleteMany({
          where: { messageId: input.assistantMessageId },
        })
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
    },
    data: TerminalConversationMessageData,
  ): Promise<FinalizeGroundedChatTurnResult> {
    const finalized = await this.conversationTurns.finalize(
      {
        courseId: input.courseId,
        sessionId: input.sessionId,
        studentId: input.studentId,
        attemptId: input.attemptId,
        studentMessageId: input.studentMessageId,
        assistantMessageId: input.assistantMessageId,
        status: data.status,
        content: data.content,
        errorCode: data.errorCode,
        guidanceLabel: data.guidanceLabel,
        provider: data.provider,
        model: data.model,
        promptVersion: data.promptVersion,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
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
          failureCode:
            attemptStatus === TutoringAttemptStatus.FAILED
              ? TutoringAttemptFailureCode.PERSISTENCE_FAILED
              : null,
          approvalSource:
            attemptStatus === TutoringAttemptStatus.COMPLETED
              ? 'CLASSIFIED_RESPONSE'
              : null,
          validationPolicyVersion:
            attemptStatus === TutoringAttemptStatus.COMPLETED
              ? 'tutoring-attempt-admission-v1'
              : null,
          leaseExpiresAt: null,
          completedAt: new Date(),
          version: { increment: 1 },
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
      const message = await tx.message.findUniqueOrThrow({
        where: { id: input.assistantMessageId },
        select: chatMessageSelect,
      })
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
    const existing = await tx.message.findFirst({
      where: {
        id: input.assistantMessageId,
        sessionId: input.sessionId,
        role: MessageRole.ASSISTANT,
        responseToMessageId: input.studentMessageId,
      },
      select: {
        ...chatMessageSelect,
      },
    })
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
    evidence: readonly GroundedChatEvidenceInput[],
  ): Promise<void> {
    if (evidence.length === 0) {
      throw new GroundedChatEvidenceUnavailableError()
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
      throw new GroundedChatEvidenceUnavailableError()
    }
  }

  private async lockExactTurnSession(
    tx: Prisma.TransactionClient,
    input: AuthorizedTurnInput,
  ): Promise<AuthorizationResult> {
    const sessions = await tx.$queryRaw<LockedStudentChatSession[]>(Prisma.sql`
      SELECT
        id,
        course_id AS "courseId",
        last_sequence AS "lastSequence",
        deleted_at AS "deletedAt"
      FROM chat_sessions
      WHERE id = ${input.sessionId}::uuid
        AND student_id = ${input.studentId}::uuid
      FOR UPDATE
    `)
    const session = sessions.at(0)
    if (session?.courseId !== input.courseId) {
      return { kind: 'session_not_found' }
    }

    return { kind: 'ok', session }
  }

  private async failExpiredActiveTurns(
    tx: Prisma.TransactionClient,
    sessionId: string,
    now: Date,
  ): Promise<void> {
    const expired = await tx.tutoringAttempt.findMany({
      where: {
        sessionId,
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
      select: { id: true, assistantMessageId: true },
    })
    if (expired.length === 0) {
      return
    }

    const attemptIds = expired.map(({ id }) => id)
    const messageIds = expired.flatMap(({ assistantMessageId }) =>
      assistantMessageId === null ? [] : [assistantMessageId],
    )
    await tx.message.updateMany({
      where: {
        id: { in: messageIds },
        status: { in: [MessageStatus.PENDING, MessageStatus.STREAMING] },
      },
      data: {
        status: MessageStatus.FAILED,
        content: GROUNDING_FAILED_CONTENT,
        guidanceLabel: null,
        provider: null,
        model: null,
        promptVersion: null,
        inputTokens: null,
        outputTokens: null,
        errorCode: GROUNDING_ATTEMPT_EXPIRED,
        errorMessage: null,
        completedAt: now,
      },
    })
    await tx.tutoringAttempt.updateMany({
      where: { id: { in: attemptIds } },
      data: {
        status: TutoringAttemptStatus.FAILED,
        failureCode: TutoringAttemptFailureCode.PERSISTENCE_FAILED,
        leaseExpiresAt: null,
        completedAt: now,
        version: { increment: 1 },
      },
    })
    await tx.messageRetrieval.deleteMany({
      where: { messageId: { in: messageIds } },
    })
    await tx.messageCitation.deleteMany({
      where: { messageId: { in: messageIds } },
    })
  }

  private async reconcileStartedTurn(
    input: AuthorizedTurnInput,
    identity: {
      studentMessageId: string
      assistantMessageId?: string
      attemptId: string
    },
    originalError: unknown,
  ): Promise<Extract<BeginGroundedChatTurnResult, { kind: 'ok' }>> {
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

        const studentMessage = await tx.message.findFirst({
          where: {
            id: identity.studentMessageId,
            sessionId: input.sessionId,
            role: MessageRole.STUDENT,
            authorUserId: input.studentId,
          },
          select: chatMessageSelect,
        })
        if (studentMessage === null) {
          return null
        }

        const assistantMessage = await tx.message.findFirst({
          where: {
            ...(identity.assistantMessageId === undefined
              ? {}
              : { id: identity.assistantMessageId }),
            sessionId: input.sessionId,
            role: MessageRole.ASSISTANT,
            responseToMessageId: studentMessage.id,
            status: MessageStatus.PENDING,
            attemptId: identity.attemptId,
          },
          select: chatMessageSelect,
        })
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
      | CompleteGroundedChatTurnInput
      | CompletePolicyGroundedChatTurnInput
      | FinalizeGroundedChatTurnInput,
    expectedStatus:
      | typeof MessageStatus.COMPLETED
      | typeof MessageStatus.FAILED
      | typeof MessageStatus.BLOCKED,
    originalError: unknown,
  ): Promise<FinalizeGroundedChatTurnResult> {
    try {
      const message = await this.prismaService.$transaction(async (tx) => {
        const exact = await tx.message.findFirst({
          where: {
            id: input.assistantMessageId,
            sessionId: input.sessionId,
            role: MessageRole.ASSISTANT,
            responseToMessageId: input.studentMessageId,
            attemptId: input.attemptId,
            status: expectedStatus,
          },
          select: chatMessageSelect,
        })
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
  authorization: 'active_membership' | 'session_owner'
  completedAt: Date
}

function orderedCitationMaterialIds(
  evidence: readonly GroundedChatEvidenceInput[],
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
  input: CompleteGroundedChatTurnInput | CompletePolicyGroundedChatTurnInput,
): readonly { readonly materialId: string; readonly citationOrder: number }[] {
  if (
    !('citationContextIndexes' in input) ||
    input.citationContextIndexes === undefined
  ) {
    return orderedCitationMaterialIds(input.evidence).map(
      (materialId, index) => ({ materialId, citationOrder: index + 1 }),
    )
  }

  return [...new Set(input.citationContextIndexes)]
    .sort((left, right) => left - right)
    .map((citationOrder) => {
      const citedEvidence = input.evidence.at(citationOrder - 1)
      if (citedEvidence === undefined) {
        throw new GroundedChatEvidenceUnavailableError()
      }
      return { materialId: citedEvidence.materialId, citationOrder }
    })
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
