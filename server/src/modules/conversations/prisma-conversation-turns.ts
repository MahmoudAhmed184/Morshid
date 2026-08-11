import { Injectable } from '@nestjs/common'

import {
  CourseMembershipRole,
  MessageRequestKind,
  MessageRole,
  MessageStatus,
  Prisma,
} from '../../generated/prisma/client'
import {
  lockAuthorizedConversation,
  lockConversationSessionOwner,
} from './prisma-conversation-authorization'
import {
  asPrismaTransaction,
  type DatabaseTransaction,
} from '../../platform/database/database-transaction'
import {
  ConversationTurns,
  type AdmitConversationTurnInput,
  type AdmittedTurn,
  type ConversationMessage,
  type FinalizeConversationMessageInput,
  type FinalizedMessage,
} from './conversation-turns'
import type {
  ConversationAuthorization,
  ConversationAuthorizationInput,
} from './conversation-authorization'
import type {
  ConversationAnalysisContext,
  ConversationAnalysisContextInput,
  ConversationAnalysisHistoryInput,
  ConversationAnalysisMessage,
  ConversationStudentMessageCountInput,
  ConversationMessageReader,
  ConversationMessageLookup,
} from './conversation-message-reader'
import { CONVERSATION_ANALYSIS_HISTORY_LIMIT } from './conversation-message-reader'
import { PrismaService } from '../../platform/database/prisma.service'
import {
  chatMessageScalarSelect,
  chatMessageSelect,
  chatMessageSelectForStudent,
} from './conversation-repository.support'

@Injectable()
export class PrismaConversationTurns
  extends ConversationTurns
  implements ConversationAuthorization, ConversationMessageReader
{
  constructor(private readonly prismaService: PrismaService) {
    super()
  }

  authorizeStudent(
    input: ConversationAuthorizationInput,
    transaction: DatabaseTransaction,
  ) {
    return lockAuthorizedConversation(asPrismaTransaction(transaction), input)
  }

  authorizeSessionOwner(
    input: ConversationAuthorizationInput,
    transaction: DatabaseTransaction,
  ) {
    return lockConversationSessionOwner(asPrismaTransaction(transaction), input)
  }

  async admit(
    input: AdmitConversationTurnInput,
    transaction: DatabaseTransaction,
  ): Promise<AdmittedTurn> {
    const tx = asPrismaTransaction(transaction)
    const authorization = await this.authorizeStudent(input, transaction)
    if (authorization.kind !== 'ok') {
      return authorization
    }

    const activeAssistant = await tx.message.findFirst({
      where: {
        sessionId: input.sessionId,
        role: MessageRole.ASSISTANT,
        status: { in: [MessageStatus.PENDING, MessageStatus.STREAMING] },
      },
      select: { id: true },
    })
    if (activeAssistant !== null) {
      return { kind: 'turn_in_progress' }
    }

    if (input.kind === 'retry') {
      await tx.messageRetrieval.deleteMany({
        where: { messageId: input.assistantMessageId },
      })
      await tx.messageCitation.deleteMany({
        where: { messageId: input.assistantMessageId },
      })
      await tx.message.update({
        where: { id: input.studentMessageId },
        data: { attemptId: input.attemptId },
      })
      const assistantMessage = await tx.message.update({
        where: {
          id: input.assistantMessageId,
          sessionId: input.sessionId,
          role: MessageRole.ASSISTANT,
          responseToMessageId: input.studentMessageId,
        },
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
          attemptId: input.attemptId,
          completedAt: null,
        },
        select: chatMessageSelect,
      })
      const studentMessage = await tx.message.findUniqueOrThrow({
        where: { id: input.studentMessageId },
        select: chatMessageSelect,
      })

      return {
        kind: 'admitted',
        studentMessage,
        assistantMessage,
      }
    }

    const studentSequence = authorization.session.lastSequence + 1
    const assistantSequence = studentSequence + 1
    const studentMessage = await tx.message.create({
      data: {
        id: input.studentMessageId,
        sessionId: input.sessionId,
        attemptId: input.attemptId,
        sequence: studentSequence,
        role: MessageRole.STUDENT,
        authorUserId: input.studentId,
        content: input.content,
        status: MessageStatus.COMPLETED,
        requestKind: input.requestKind,
        guidanceLabel: null,
        hintLevel: null,
        createdAt: input.now,
        completedAt: input.now,
      },
      select: chatMessageSelect,
    })
    const assistantMessage = await tx.message.create({
      data: {
        id: input.assistantMessageId,
        sessionId: input.sessionId,
        attemptId: input.attemptId,
        sequence: assistantSequence,
        role: MessageRole.ASSISTANT,
        authorUserId: null,
        responseToMessageId: studentMessage.id,
        content: '',
        status: MessageStatus.PENDING,
        requestKind: input.requestKind ?? MessageRequestKind.CONCEPTUAL,
        guidanceLabel: null,
        hintLevel: null,
        createdAt: input.now,
        completedAt: null,
      },
      select: chatMessageSelect,
    })
    await tx.chatSession.update({
      where: { id: input.sessionId },
      data: {
        lastSequence: assistantSequence,
        lastMessageAt: input.now,
      },
    })

    return {
      kind: 'admitted',
      studentMessage,
      assistantMessage,
    }
  }

  async finalize(
    input: FinalizeConversationMessageInput,
    transaction: DatabaseTransaction,
  ): Promise<FinalizedMessage> {
    const tx = asPrismaTransaction(transaction)
    const authorization =
      input.authorization === 'session_owner'
        ? await this.authorizeSessionOwner(input, transaction)
        : await this.authorizeStudent(input, transaction)
    if (authorization.kind !== 'ok') {
      return authorization
    }

    const updated = await tx.message.updateManyAndReturn({
      where: {
        id: input.assistantMessageId,
        sessionId: input.sessionId,
        attemptId: input.attemptId,
        ...(input.topicId === undefined || input.topicId === null
          ? {}
          : { OR: [{ topicId: null }, { topicId: input.topicId }] }),
        role: MessageRole.ASSISTANT,
        status: { in: [MessageStatus.PENDING, MessageStatus.STREAMING] },
        responseToMessageId: input.studentMessageId,
      },
      data: {
        status: input.status,
        content: input.content,
        errorCode: input.errorCode ?? null,
        errorMessage: null,
        requestKind:
          input.requestKind === undefined ? undefined : input.requestKind,
        guidanceLabel:
          input.guidanceLabel === undefined ? undefined : input.guidanceLabel,
        hintLevel: input.hintLevel === undefined ? undefined : input.hintLevel,
        provider: input.provider === undefined ? undefined : input.provider,
        model: input.model === undefined ? undefined : input.model,
        promptVersion:
          input.promptVersion === undefined ? undefined : input.promptVersion,
        inputTokens:
          input.inputTokens === undefined ? undefined : input.inputTokens,
        outputTokens:
          input.outputTokens === undefined ? undefined : input.outputTokens,
        topicId: input.topicId ?? undefined,
        completedAt: input.completedAt,
      },
      select: chatMessageScalarSelect,
      limit: 1,
    })
    const updatedMessage = updated.at(0)
    if (updatedMessage === undefined) {
      const existing = await tx.message.findUnique({
        where: { id: input.assistantMessageId },
        select: { id: true, status: true },
      })
      return existing === null
        ? { kind: 'message_not_found' }
        : { kind: 'message_not_pending' }
    }

    if (input.requestKind !== undefined || input.topicId != null) {
      const updatedStudent = await tx.message.updateMany({
        where: {
          id: input.studentMessageId,
          sessionId: input.sessionId,
          attemptId: input.attemptId,
          role: MessageRole.STUDENT,
          ...(input.topicId == null
            ? {}
            : { OR: [{ topicId: null }, { topicId: input.topicId }] }),
        },
        data: {
          requestKind:
            input.requestKind === undefined ? undefined : input.requestKind,
          topicId: input.topicId ?? undefined,
        },
      })
      if (updatedStudent.count !== 1) {
        throw new Error(
          'Conversation Student message changed during Assistant finalization',
        )
      }
    }

    if (input.clearEvidence === true) {
      await tx.messageRetrieval.deleteMany({
        where: { messageId: input.assistantMessageId },
      })
      await tx.messageCitation.deleteMany({
        where: { messageId: input.assistantMessageId },
      })
    }

    const message = await tx.message.findUnique({
      where: { id: updatedMessage.id },
      select: chatMessageSelect,
    })
    if (message === null) {
      return { kind: 'message_not_found' }
    }

    return { kind: 'finalized', message }
  }

  async find(
    input: ConversationMessageLookup & { readonly studentId?: string },
    transaction?: DatabaseTransaction,
  ): Promise<ConversationMessage | null> {
    const database =
      transaction === undefined
        ? this.prismaService
        : asPrismaTransaction(transaction)
    const { studentId, statuses, excludeId, ...lookup } = input

    const where = {
      ...lookup,
      ...(statuses === undefined ? {} : { status: { in: [...statuses] } }),
      ...(excludeId === undefined ? {} : { id: { not: excludeId } }),
    }
    const message =
      studentId === undefined
        ? await database.message.findFirst({
            where,
            select: chatMessageSelect,
          })
        : await database.message.findFirst({
            where,
            select: chatMessageSelectForStudent(studentId),
          })

    return message
  }

  async loadAnalysisContext(
    input: ConversationAnalysisContextInput,
  ): Promise<ConversationAnalysisContext | null> {
    const session = await this.prismaService.chatSession.findFirst({
      where: {
        id: input.sessionId,
        courseId: input.courseId,
        studentId: input.studentId,
        deletedAt: null,
        membership: {
          role: CourseMembershipRole.STUDENT,
          removedAt: null,
        },
      },
      select: {
        course: {
          select: {
            id: true,
            code: true,
            title: true,
          },
        },
        messages: {
          where: {
            id: input.studentMessageId,
            role: MessageRole.STUDENT,
            authorUserId: input.studentId,
            status: MessageStatus.COMPLETED,
          },
          select: conversationAnalysisMessageSelect,
          take: 1,
        },
      },
    })

    const studentMessage = session?.messages[0]
    if (session === null || studentMessage === undefined) {
      return null
    }

    return {
      courseMetadata: session.course,
      studentMessage,
    }
  }

  async listAnalysisHistoryCandidates(
    input: ConversationAnalysisHistoryInput,
  ): Promise<ConversationAnalysisMessage[]> {
    const messages = await this.prismaService.message.findMany({
      where: {
        sessionId: input.sessionId,
        session: {
          courseId: input.courseId,
          studentId: input.studentId,
          deletedAt: null,
          membership: {
            role: CourseMembershipRole.STUDENT,
            removedAt: null,
          },
        },
        topicId: input.topicId,
        sequence: { lt: input.beforeSequence },
        status: MessageStatus.COMPLETED,
        role: { in: [MessageRole.STUDENT, MessageRole.ASSISTANT] },
      },
      select: conversationAnalysisMessageSelect,
      orderBy: [{ sequence: 'desc' }, { id: 'desc' }],
      take: CONVERSATION_ANALYSIS_HISTORY_LIMIT,
    })

    return messages.reverse()
  }

  countStudentMessages(
    input: ConversationStudentMessageCountInput,
  ): Promise<number> {
    return this.prismaService.message.count({
      where: {
        id: { in: [...input.messageIds] },
        sessionId: input.sessionId,
        role: MessageRole.STUDENT,
      },
    })
  }
}

const conversationAnalysisMessageSelect = {
  id: true,
  sequence: true,
  role: true,
  attemptId: true,
  topicId: true,
  authorUserId: true,
  responseToMessageId: true,
  content: true,
  status: true,
  requestKind: true,
  guidanceLabel: true,
  hintLevel: true,
  createdAt: true,
  completedAt: true,
} satisfies Prisma.MessageSelect
