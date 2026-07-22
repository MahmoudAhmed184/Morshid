import { Injectable } from '@nestjs/common'

import {
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
  hasActiveStudentMembershipInTransaction,
} from './student-chat.repository.support'
import type { ChatMessageRecord } from './student-chat.repository.types'

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
  studentMessageId: string
  assistantMessageId: string
  content: string
  errorCode: string
}

export type BeginGroundedChatTurnResult =
  | {
      kind: 'ok'
      courseId: string
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

  beginTurn(
    input: BeginGroundedChatTurnInput,
  ): Promise<BeginGroundedChatTurnResult> {
    return this.runTransaction(async (tx) => {
      const authorization = await this.lockAuthorizedSession(tx, input)
      if (authorization.kind !== 'ok') {
        return authorization
      }
      const { session } = authorization
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

      const now = await currentDatabaseTime(tx)
      const studentSequence = session.lastSequence + 1
      const assistantSequence = studentSequence + 1
      const studentMessage = await tx.message.create({
        data: {
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
        studentMessage,
        assistantMessage,
      }
    })
  }

  retryTurn(
    input: RetryGroundedChatTurnInput,
  ): Promise<RetryGroundedChatTurnResult> {
    return this.runTransaction(async (tx) => {
      const authorization = await this.lockAuthorizedSession(tx, input)
      if (authorization.kind !== 'ok') {
        return authorization
      }
      const { session } = authorization
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
        return { kind: 'message_not_found', messageId: input.studentMessageId }
      }

      const assistantMessage = await tx.message.findUnique({
        where: { responseToMessageId: studentMessage.id },
        select: chatMessageSelect,
      })
      if (assistantMessage?.role !== MessageRole.ASSISTANT) {
        return { kind: 'message_not_found', messageId: input.studentMessageId }
      }
      if (assistantMessage.status !== MessageStatus.FAILED) {
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
          completedAt: null,
        },
        select: chatMessageSelect,
      })

      return {
        kind: 'ok',
        courseId: session.courseId,
        studentMessage,
        assistantMessage: resetAssistant,
      }
    })
  }

  completeTurn(
    input: CompleteGroundedChatTurnInput,
  ): Promise<FinalizeGroundedChatTurnResult> {
    return this.runTransaction(async (tx) => {
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
    return this.runTransaction(async (tx) => {
      const authorization = await this.lockAuthorizedSession(tx, input)
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
  }

  private async transitionPendingAssistant(
    tx: Prisma.TransactionClient,
    input: Pick<
      CompleteGroundedChatTurnInput,
      'sessionId' | 'studentMessageId' | 'assistantMessageId'
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
    const hasMembership = await hasActiveStudentMembershipInTransaction(
      tx,
      input.courseId,
      input.studentId,
    )
    if (!hasMembership) {
      return { kind: 'membership_missing' }
    }

    const sessions = await tx.$queryRaw<LockedSession[]>(Prisma.sql`
      SELECT
        id,
        course_id AS "courseId",
        last_sequence AS "lastSequence"
      FROM chat_sessions
      WHERE id = ${input.sessionId}::uuid
        AND student_id = ${input.studentId}::uuid
        AND deleted_at IS NULL
      FOR UPDATE
    `)
    const session = sessions.at(0)
    if (session?.courseId !== input.courseId) {
      return { kind: 'session_not_found' }
    }

    return { kind: 'ok', session }
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

function isWriteConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2034'
  )
}
