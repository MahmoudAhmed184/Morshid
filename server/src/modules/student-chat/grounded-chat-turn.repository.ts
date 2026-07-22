import { randomUUID } from 'node:crypto'

import { Injectable } from '@nestjs/common'

import {
  CourseMembershipRole,
  MaterialStatus,
  MessageGuidanceLabel,
  MessageRequestKind,
  MessageRole,
  MessageStatus,
  Prisma,
} from '../../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import {
  chatMessageSelect,
  chatMessageScalarSelect,
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
  content: string
}

export interface RetryGroundedChatTurnInput extends AuthorizedTurnInput {
  studentMessageId: string
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
}

export interface FinalizeGroundedChatTurnInput extends AuthorizedTurnInput {
  attemptId: string
  studentMessageId: string
  assistantMessageId: string
  content: string
  errorCode: string
}

export type BeginGroundedChatTurnResult =
  | {
      kind: 'ok'
      courseId: string
      attemptId: string
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

export type FinalizeGroundedChatTurnResult =
  | { kind: 'ok'; message: ChatMessageRecord }
  | { kind: 'membership_missing' }
  | { kind: 'session_not_found' }
  | { kind: 'message_not_found'; messageId: string }
  | { kind: 'message_not_pending'; messageId: string }

interface LockedSession {
  id: string
  courseId: string
  lastSequence: number
  deletedAt: Date | null
}

interface LockedMembership {
  role: CourseMembershipRole
  removedAt: Date | null
}

type AuthorizationResult =
  | { kind: 'ok'; session: LockedSession }
  | { kind: 'membership_missing' }
  | { kind: 'session_not_found' }

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

  abstract completeTurn(
    input: CompleteGroundedChatTurnInput,
  ): Promise<FinalizeGroundedChatTurnResult>

  abstract failTurn(
    input: FinalizeGroundedChatTurnInput,
  ): Promise<FinalizeGroundedChatTurnResult>

  abstract blockTurn(
    input: FinalizeGroundedChatTurnInput,
  ): Promise<FinalizeGroundedChatTurnResult>
}

@Injectable()
export class PrismaGroundedChatTurnRepository extends GroundedChatTurnRepository {
  constructor(private readonly prismaService: PrismaService) {
    super()
  }

  async beginTurn(
    input: BeginGroundedChatTurnInput,
  ): Promise<BeginGroundedChatTurnResult> {
    const identity = {
      studentMessageId: randomUUID(),
      assistantMessageId: randomUUID(),
      attemptId: randomUUID(),
    }

    try {
      return await this.runTransaction(async (tx) => {
        const authorization = await this.lockAuthorizedSession(tx, input)
        if (authorization.kind !== 'ok') {
          return authorization
        }
        const { session } = authorization
        const now = await currentDatabaseTime(tx)
        await this.failExpiredActiveTurns(tx, session.id, now)

        const activeAssistant = await tx.message.findFirst({
          where: {
            sessionId: session.id,
            role: MessageRole.ASSISTANT,
            status: { in: [MessageStatus.PENDING, MessageStatus.STREAMING] },
          },
          select: { id: true },
        })
        if (activeAssistant !== null) {
          return { kind: 'turn_in_progress' }
        }

        const studentSequence = session.lastSequence + 1
        const assistantSequence = studentSequence + 1
        const studentMessage = await tx.message.create({
          data: {
            id: identity.studentMessageId,
            sessionId: session.id,
            sequence: studentSequence,
            role: MessageRole.STUDENT,
            authorUserId: input.studentId,
            content: input.content,
            status: MessageStatus.COMPLETED,
            requestKind: MessageRequestKind.CONCEPTUAL,
            guidanceLabel: null,
            hintLevel: null,
            createdAt: now,
            completedAt: now,
          },
          select: chatMessageSelect,
        })
        const assistantMessage = await tx.message.create({
          data: {
            id: identity.assistantMessageId,
            sessionId: session.id,
            sequence: assistantSequence,
            role: MessageRole.ASSISTANT,
            authorUserId: null,
            responseToMessageId: studentMessage.id,
            content: '',
            status: MessageStatus.PENDING,
            requestKind: MessageRequestKind.CONCEPTUAL,
            guidanceLabel: null,
            hintLevel: null,
            groundingAttemptId: identity.attemptId,
            groundingLeaseExpiresAt: leaseExpiry(now),
            createdAt: now,
            completedAt: null,
          },
          select: chatMessageSelect,
        })
        await tx.chatSession.update({
          where: { id: session.id },
          data: {
            lastSequence: assistantSequence,
            lastMessageAt: now,
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
        const authorization = await this.lockAuthorizedSession(tx, input)
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
          select: {
            ...chatMessageSelect,
            groundingLeaseExpiresAt: true,
          },
        })
        if (assistantMessage?.role !== MessageRole.ASSISTANT) {
          return {
            kind: 'message_not_found',
            messageId: input.studentMessageId,
          }
        }
        if (!isRetryableAssistant(assistantMessage, now)) {
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

        await tx.messageRetrieval.deleteMany({
          where: { messageId: assistantMessage.id },
        })
        await tx.messageCitation.deleteMany({
          where: { messageId: assistantMessage.id },
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
            groundingAttemptId: attemptId,
            groundingLeaseExpiresAt: leaseExpiry(now),
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

  async completeTurn(
    input: CompleteGroundedChatTurnInput,
  ): Promise<FinalizeGroundedChatTurnResult> {
    try {
      return await this.runTransaction(async (tx) => {
        const authorization = await this.lockAuthorizedSession(tx, input)
        if (authorization.kind !== 'ok') {
          return authorization
        }
        const { session } = authorization
        await this.requireEligibleEvidence(tx, session.courseId, input.evidence)

        const now = await currentDatabaseTime(tx)
        const updated = await this.transitionPendingAssistant(tx, input, {
          status: MessageStatus.COMPLETED,
          content: input.content,
          guidanceLabel: MessageGuidanceLabel.COURSE_GROUNDED,
          provider: input.provider,
          model: input.model,
          promptVersion: input.promptVersion,
          inputTokens: input.inputTokens ?? null,
          outputTokens: input.outputTokens ?? null,
          errorCode: null,
          errorMessage: null,
          groundingLeaseExpiresAt: null,
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
        await tx.messageRetrieval.createMany({
          data: input.evidence.map((entry) => ({
            messageId: input.assistantMessageId,
            chunkId: entry.chunkId,
            rank: entry.rank,
            similarityScore: entry.similarityScore,
          })),
        })
        await tx.messageCitation.createMany({
          data: orderedCitationMaterialIds(input.evidence).map(
            (materialId, index) => ({
              messageId: input.assistantMessageId,
              materialId,
              citationOrder: index + 1,
            }),
          ),
        })

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
    return this.finalizeWithoutEvidence(input, {
      status: MessageStatus.FAILED,
      content: input.content,
      guidanceLabel: null,
      errorCode: input.errorCode,
    })
  }

  blockTurn(
    input: FinalizeGroundedChatTurnInput,
  ): Promise<FinalizeGroundedChatTurnResult> {
    return this.finalizeWithoutEvidence(input, {
      status: MessageStatus.BLOCKED,
      content: input.content,
      guidanceLabel: MessageGuidanceLabel.GENERAL_NOT_FOUND,
      errorCode: input.errorCode,
    })
  }

  private finalizeWithoutEvidence(
    input: FinalizeGroundedChatTurnInput,
    terminal: {
      status: typeof MessageStatus.FAILED | typeof MessageStatus.BLOCKED
      content: string
      guidanceLabel: typeof MessageGuidanceLabel.GENERAL_NOT_FOUND | null
      errorCode: string
    },
  ): Promise<FinalizeGroundedChatTurnResult> {
    return this.persistTerminalWithoutEvidence(input, terminal)
  }

  private async persistTerminalWithoutEvidence(
    input: FinalizeGroundedChatTurnInput,
    terminal: {
      status: typeof MessageStatus.FAILED | typeof MessageStatus.BLOCKED
      content: string
      guidanceLabel: typeof MessageGuidanceLabel.GENERAL_NOT_FOUND | null
      errorCode: string
    },
  ): Promise<FinalizeGroundedChatTurnResult> {
    try {
      return await this.runTransaction(async (tx) => {
        const authorization =
          terminal.status === MessageStatus.FAILED
            ? await this.lockExactTurnSession(tx, input)
            : await this.lockAuthorizedSession(tx, input)
        if (authorization.kind !== 'ok') {
          return authorization
        }
        const now = await currentDatabaseTime(tx)
        const updated = await this.transitionPendingAssistant(tx, input, {
          ...terminal,
          provider: null,
          model: null,
          promptVersion: null,
          inputTokens: null,
          outputTokens: null,
          errorMessage: null,
          groundingLeaseExpiresAt: null,
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
    input: Pick<
      CompleteGroundedChatTurnInput,
      'sessionId' | 'studentMessageId' | 'assistantMessageId' | 'attemptId'
    >,
    data: Prisma.MessageUpdateManyMutationInput,
  ): Promise<FinalizeGroundedChatTurnResult> {
    const messages = await tx.message.updateManyAndReturn({
      where: {
        id: input.assistantMessageId,
        sessionId: input.sessionId,
        role: MessageRole.ASSISTANT,
        status: MessageStatus.PENDING,
        responseToMessageId: input.studentMessageId,
        groundingAttemptId: input.attemptId,
      },
      data,
      select: chatMessageScalarSelect,
      limit: 1,
    })
    const updated = messages.at(0)
    if (updated !== undefined) {
      const message = await tx.message.findUniqueOrThrow({
        where: { id: updated.id },
        select: chatMessageSelect,
      })
      return { kind: 'ok', message }
    }

    const existing = await tx.message.findFirst({
      where: {
        id: input.assistantMessageId,
        sessionId: input.sessionId,
        role: MessageRole.ASSISTANT,
        responseToMessageId: input.studentMessageId,
      },
      select: { id: true },
    })
    return existing === null
      ? { kind: 'message_not_found', messageId: input.assistantMessageId }
      : { kind: 'message_not_pending', messageId: input.assistantMessageId }
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

  private async lockAuthorizedSession(
    tx: Prisma.TransactionClient,
    input: AuthorizedTurnInput,
  ): Promise<AuthorizationResult> {
    const sessions = await tx.$queryRaw<LockedSession[]>(Prisma.sql`
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
    if (session?.courseId !== input.courseId || session.deletedAt !== null) {
      return { kind: 'session_not_found' }
    }

    const memberships = await tx.$queryRaw<LockedMembership[]>(Prisma.sql`
      SELECT
        role,
        removed_at AS "removedAt"
      FROM course_memberships
      WHERE course_id = ${session.courseId}::uuid
        AND user_id = ${input.studentId}::uuid
      FOR UPDATE
    `)
    const membership = memberships.at(0)
    if (
      membership?.role !== CourseMembershipRole.STUDENT ||
      membership.removedAt !== null
    ) {
      return { kind: 'membership_missing' }
    }

    return { kind: 'ok', session }
  }

  private async lockExactTurnSession(
    tx: Prisma.TransactionClient,
    input: AuthorizedTurnInput,
  ): Promise<AuthorizationResult> {
    const sessions = await tx.$queryRaw<LockedSession[]>(Prisma.sql`
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
    const expired = await tx.message.findMany({
      where: {
        sessionId,
        role: MessageRole.ASSISTANT,
        status: { in: [MessageStatus.PENDING, MessageStatus.STREAMING] },
        OR: [
          { groundingLeaseExpiresAt: null },
          { groundingLeaseExpiresAt: { lte: now } },
        ],
      },
      select: { id: true },
    })
    if (expired.length === 0) {
      return
    }

    const messageIds = expired.map(({ id }) => id)
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
        groundingLeaseExpiresAt: null,
        completedAt: now,
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
            groundingAttemptId: identity.attemptId,
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
    input: CompleteGroundedChatTurnInput | FinalizeGroundedChatTurnInput,
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
            groundingAttemptId: input.attemptId,
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

function leaseExpiry(now: Date): Date {
  return new Date(now.getTime() + GROUNDING_ATTEMPT_LEASE_MS)
}

function isRetryableAssistant(
  assistant: {
    status: MessageStatus
    groundingLeaseExpiresAt: Date | null
  },
  now: Date,
): boolean {
  if (assistant.status === MessageStatus.FAILED) {
    return true
  }

  return (
    (assistant.status === MessageStatus.PENDING ||
      assistant.status === MessageStatus.STREAMING) &&
    (assistant.groundingLeaseExpiresAt === null ||
      assistant.groundingLeaseExpiresAt <= now)
  )
}

function isWriteConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2034'
  )
}
