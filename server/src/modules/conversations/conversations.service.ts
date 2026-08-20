import type { Readable } from 'node:stream'
import { Injectable, Logger } from '@nestjs/common'

import type { AuthenticatedUser } from '../identity/identity.types'
import {
  AccessAuditService,
  type AccessAuditActor,
  type AccessAuditRouteContext,
} from '../audit/audit.public'
import type { AuditRequestContext } from '../audit/audit.public'
import { StudentCitationSources } from '../materials/interface/student-citation-sources'
import { StudentReviewSummaries } from '../reviews/interface/student-review-summaries'
import {
  ConversationAuditService,
  type RecordAccessDeniedInput,
} from './conversation-audit.service'
import type {
  ChatMessageHistoryResponseDto,
  ChatSessionDto,
  ChatSessionListResponseDto,
  ChatSessionResponseDto,
  ChatSessionSummaryResponseDto,
  CreateChatSessionRequest,
  ListChatMessagesQuery,
  ListChatSessionsQuery,
  RenameChatSessionRequest,
} from './interface/conversation-dto'
import {
  DEFAULT_MESSAGE_PAGE_SIZE,
  DEFAULT_SESSION_PAGE_SIZE,
  MAX_MESSAGE_PAGE_SIZE,
  MAX_SESSION_PAGE_SIZE,
} from './interface/conversation-dto'
import {
  activeStudentMembershipRequiredException,
  conversationSessionNotFoundException,
} from './interface/conversation-errors'
import { ConversationMessageRepository } from './conversation-message.repository'
import { ConversationMessagePresenter } from './interface/conversation-message-presenter'
import { ConversationSessionRepository } from './conversation-session.repository'
import type { ChatSessionRecord } from './interface/conversation-records'
import { ConversationCourseBoundaryAudit } from './interface/conversation-course-boundary-audit'
import {
  createConversationExportStream,
  generateExportFilename,
} from './conversation-markdown-export'

const DEFAULT_CHAT_TITLE = 'New chat'

@Injectable()
export class ConversationsService extends ConversationCourseBoundaryAudit {
  private readonly logger = new Logger(ConversationsService.name)

  constructor(
    private readonly sessionRepository: ConversationSessionRepository,
    private readonly messageRepository: ConversationMessageRepository,
    private readonly conversationAuditService: ConversationAuditService,
    private readonly accessAuditService: AccessAuditService,
    private readonly messagePresenter: ConversationMessagePresenter,
    private readonly citationSources: StudentCitationSources,
    private readonly reviewSummaries: StudentReviewSummaries,
  ) {
    super()
  }

  async createSession(
    courseId: string,
    body: CreateChatSessionRequest,
    user: AuthenticatedUser,
    requestContext?: AuditRequestContext,
  ): Promise<ChatSessionResponseDto> {
    await this.requireActiveStudentMembership(courseId, user.id, requestContext)

    const session = await this.sessionRepository.createSession(
      courseId,
      user.id,
      body.title ?? DEFAULT_CHAT_TITLE,
    )

    // A null result means the membership was removed between the guard and the
    // insert (composite FK violation) — treat it as a membership denial, not a
    // 500.
    if (session === null) {
      await this.recordMembershipDenied(courseId, user.id, requestContext)
      throw activeStudentMembershipRequiredException()
    }

    return { session: mapSession(session) }
  }

  async listSessions(
    courseId: string,
    user: AuthenticatedUser,
    query: ListChatSessionsQuery,
    requestContext?: AuditRequestContext,
  ): Promise<ChatSessionListResponseDto> {
    await this.requireActiveStudentMembership(courseId, user.id, requestContext)

    const limit = Math.min(
      query.limit ?? DEFAULT_SESSION_PAGE_SIZE,
      MAX_SESSION_PAGE_SIZE,
    )
    const sessionsWithLookahead = await this.sessionRepository.listSessions(
      courseId,
      user.id,
      { limit: limit + 1, cursor: query.cursor ?? null },
    )
    const hasMore = sessionsWithLookahead.length > limit
    const sessions = hasMore
      ? sessionsWithLookahead.slice(0, limit)
      : sessionsWithLookahead

    return {
      sessions: sessions.map(mapSession),
      nextCursor: hasMore ? (sessions[sessions.length - 1]?.id ?? null) : null,
    }
  }

  async getSession(
    courseId: string,
    sessionId: string,
    user: Pick<AuthenticatedUser, 'id'>,
    requestContext?: AuditRequestContext,
  ): Promise<ChatSessionResponseDto> {
    const session = await this.requireOwnedActiveSession(
      courseId,
      sessionId,
      user.id,
      requestContext,
    )

    return { session: mapSession(session) }
  }

  async getSessionSummary(
    courseId: string,
    sessionId: string,
    user: Pick<AuthenticatedUser, 'id'>,
    requestContext?: AuditRequestContext,
  ): Promise<ChatSessionSummaryResponseDto> {
    await this.requireActiveStudentMembership(courseId, user.id, requestContext)

    const summary = await this.sessionRepository.getSessionSummary(
      courseId,
      sessionId,
      user.id,
    )

    if (summary === null) {
      await this.recordSessionAccessDenied(
        courseId,
        user.id,
        sessionId,
        requestContext,
      )
      throw conversationSessionNotFoundException()
    }

    return { summary }
  }

  async renameSession(
    courseId: string,
    sessionId: string,
    body: RenameChatSessionRequest,
    user: AuthenticatedUser,
    requestContext?: AuditRequestContext,
  ): Promise<ChatSessionResponseDto> {
    await this.requireActiveStudentMembership(courseId, user.id, requestContext)

    const session = await this.sessionRepository.renameSession(
      courseId,
      sessionId,
      user.id,
      body.title,
    )

    if (session === null) {
      await this.recordSessionAccessDenied(
        courseId,
        user.id,
        sessionId,
        requestContext,
      )
      throw conversationSessionNotFoundException()
    }

    return { session: mapSession(session) }
  }

  async softDeleteSession(
    courseId: string,
    sessionId: string,
    user: AuthenticatedUser,
    requestContext?: AuditRequestContext,
  ): Promise<void> {
    await this.requireActiveStudentMembership(courseId, user.id, requestContext)

    const outcome = await this.sessionRepository.softDeleteSession({
      courseId,
      sessionId,
      studentId: user.id,
      requestContext,
    })

    // Deleting a session you own that is already deleted is idempotent success
    // (204) — it must not emit a spurious access-denied audit row nor a 404.
    if (outcome === 'not_found') {
      await this.recordSessionAccessDenied(
        courseId,
        user.id,
        sessionId,
        requestContext,
      )
      throw conversationSessionNotFoundException()
    }
  }

  async listMessages(
    courseId: string,
    sessionId: string,
    user: AuthenticatedUser,
    query: ListChatMessagesQuery,
    requestContext?: AuditRequestContext,
  ): Promise<ChatMessageHistoryResponseDto> {
    await this.requireActiveStudentMembership(courseId, user.id, requestContext)

    const limit = Math.min(
      query.limit ?? DEFAULT_MESSAGE_PAGE_SIZE,
      MAX_MESSAGE_PAGE_SIZE,
    )
    const isLoadingLatestOrEarlier =
      query.page === 'latest' || query.before !== undefined
    const messagesWithLookahead = await this.messageRepository.listMessages(
      courseId,
      sessionId,
      user.id,
      {
        limit: limit + 1,
        after: query.after ?? null,
        before: query.before ?? null,
        latest: query.page === 'latest',
      },
    )

    if (messagesWithLookahead === null) {
      await this.recordSessionAccessDenied(
        courseId,
        user.id,
        sessionId,
        requestContext,
      )
      throw conversationSessionNotFoundException()
    }

    const hasMore = messagesWithLookahead.length > limit
    const messages = isLoadingLatestOrEarlier
      ? messagesWithLookahead.slice(-limit)
      : messagesWithLookahead.slice(0, limit)

    return {
      messages: await this.messagePresenter.presentMany(messages, user.id),
      nextCursor: hasMore
        ? isLoadingLatestOrEarlier
          ? (messages[0]?.sequence ?? null)
          : (messages[messages.length - 1]?.sequence ?? null)
        : null,
    }
  }

  async exportSessionMarkdown(
    courseId: string,
    sessionId: string,
    user: AuthenticatedUser,
    requestContext?: AuditRequestContext,
  ): Promise<{ stream: Readable; filename: string }> {
    const hasAccess =
      await this.sessionRepository.hasActiveOrArchivedStudentAccess(
        courseId,
        user.id,
      )

    if (!hasAccess) {
      await this.recordMembershipDenied(courseId, user.id, requestContext)
      throw activeStudentMembershipRequiredException()
    }

    const session = await this.sessionRepository.findExportableSession(
      courseId,
      sessionId,
      user.id,
    )

    if (session === null) {
      await this.recordSessionAccessDenied(
        courseId,
        user.id,
        sessionId,
        requestContext,
      )
      throw conversationSessionNotFoundException()
    }

    // Must log audit event before returning content; fail the export if auditing fails.
    await this.conversationAuditService.recordSessionExported({
      actorUserId: user.id,
      courseId,
      sessionId,
      requestContext,
    })

    const filename = generateExportFilename(session.course.code, session.title)
    const stream = createConversationExportStream(session, {
      fetchMessagesBatch: (cursor) =>
        this.sessionRepository.listMessagesForExport(sessionId, cursor),
      fetchCitations: (messageIds) =>
        this.citationSources.loadForMessages(messageIds),
      fetchPublishedGuidance: (messageIds) =>
        this.reviewSummaries.loadPublishedGuidanceForMessages(
          messageIds,
          user.id,
        ),
    })

    return { stream, filename }
  }

  /**
   * Records a course-boundary denial (a Student reaching a course-scoped chat
   * endpoint for a course they are not an active member of). The membership
   * check lives inside the service, so the 403 is thrown from deep in the call
   * stack; this is invoked from a controller-scoped exception filter where the
   * attempted operation (method/path) and request context are still available.
   * Emits the generic `ACCESS_COURSE_BOUNDARY_DENIED` audit event (Issue #15)
   * in addition to the chat-scoped membership event. Like every deny path here
   * it is best-effort and FK-safe: it never converts the 403 into a 500 and
   * never stores an unverified course id in the FK column.
   */
  async recordCourseBoundaryDenied(
    courseId: string | null,
    actor: AccessAuditActor | null,
    route: AccessAuditRouteContext,
    requestContext: AuditRequestContext,
  ): Promise<void> {
    const courseExists =
      courseId !== null && (await this.courseExistsSafe(courseId))

    await this.accessAuditService.recordCourseBoundaryDenied({
      actor,
      courseId: courseExists ? courseId : null,
      unverifiedCourseId: courseExists ? null : courseId,
      route,
      requestContext,
    })
  }

  private async requireActiveStudentMembership(
    courseId: string,
    studentId: string,
    requestContext?: AuditRequestContext,
  ): Promise<void> {
    const hasMembership =
      await this.sessionRepository.hasActiveStudentMembership(
        courseId,
        studentId,
      )

    if (!hasMembership) {
      await this.recordMembershipDenied(courseId, studentId, requestContext)
      throw activeStudentMembershipRequiredException()
    }
  }

  /**
   * Records a membership access-denied audit event without ever converting the
   * intended 403 into a 500:
   *  - the raw `courseId` may reference a non-existent course, which would
   *    violate the `audit_logs.course_id` FK, so it is only stored in the FK
   *    column when the course is confirmed to exist (otherwise kept in
   *    unconstrained JSONB metadata); this also removes a course-existence
   *    oracle for students.
   *  - the write itself is best-effort so a transient audit failure never
   *    replaces the domain response.
   */
  private async recordMembershipDenied(
    courseId: string,
    studentId: string,
    requestContext?: AuditRequestContext,
  ): Promise<void> {
    const courseExists = await this.courseExistsSafe(courseId)

    await this.recordAccessDenied({
      actorUserId: studentId,
      courseId: courseExists ? courseId : null,
      unverifiedCourseId: courseExists ? null : courseId,
      reason: 'ACTIVE_STUDENT_MEMBERSHIP_REQUIRED',
      requestContext,
    })
  }

  private async courseExistsSafe(courseId: string): Promise<boolean> {
    try {
      return await this.sessionRepository.courseExists(courseId)
    } catch (error) {
      this.logger.error(
        'Failed to resolve course existence for student chat audit',
        error instanceof Error ? error.stack : undefined,
      )

      return false
    }
  }

  private async recordAccessDenied(
    input: RecordAccessDeniedInput,
  ): Promise<void> {
    try {
      await this.conversationAuditService.recordAccessDenied(input)
    } catch (error) {
      // Deny-path audit writes must never turn a correct 403/404 into a 500.
      this.logger.error(
        'Failed to record student chat access-denied audit event',
        error instanceof Error ? error.stack : undefined,
      )
    }
  }

  private async requireOwnedActiveSession(
    courseId: string,
    sessionId: string,
    studentId: string,
    requestContext?: AuditRequestContext,
  ): Promise<ChatSessionRecord> {
    await this.requireActiveStudentMembership(
      courseId,
      studentId,
      requestContext,
    )

    const session = await this.sessionRepository.findOwnedActiveSession(
      courseId,
      sessionId,
      studentId,
    )

    if (session === null) {
      await this.recordSessionAccessDenied(
        courseId,
        studentId,
        sessionId,
        requestContext,
      )
      throw conversationSessionNotFoundException()
    }

    return session
  }

  private recordSessionAccessDenied(
    courseId: string,
    studentId: string,
    sessionId: string,
    requestContext?: AuditRequestContext,
  ): Promise<void> {
    // Reached only after an active membership was confirmed, so the course is
    // known to exist and `courseId` is safe for the FK column.
    return this.recordAccessDenied({
      actorUserId: studentId,
      courseId,
      sessionId,
      reason: 'DELETED_OR_UNOWNED',
      requestContext,
    })
  }
}

function mapSession(record: ChatSessionRecord): ChatSessionDto {
  return {
    id: record.id,
    courseId: record.courseId,
    title: record.title,
    lastMessageAt: record.lastMessageAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}
