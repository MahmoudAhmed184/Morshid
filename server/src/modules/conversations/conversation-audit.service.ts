import { Injectable } from '@nestjs/common'

import { AUDIT_EVENT_ACTIONS, AUDIT_TARGET_TYPES } from '../audit/audit.public'
import { AuditService, type AuditRequestContext } from '../audit/audit.public'
import type { DatabaseTransaction } from '../prisma/database-transaction'

interface RecordSessionDeletedInput {
  actorUserId: string
  courseId: string
  sessionId: string
  requestContext?: AuditRequestContext
}

export interface RecordAccessDeniedInput {
  actorUserId: string
  /**
   * Verified course id. Pass `null` when the course could not be confirmed to
   * exist so the audit row does not violate the `audit_logs.course_id` foreign
   * key; the raw value is preserved in `unverifiedCourseId`.
   */
  courseId: string | null
  /**
   * Raw, unverified course id from the request. Stored in JSONB metadata (which
   * carries no foreign key) so the audit trail is never lost for a denial that
   * references a non-existent course.
   */
  unverifiedCourseId?: string | null
  sessionId?: string | null
  reason:
    | 'ACTIVE_STUDENT_MEMBERSHIP_REQUIRED'
    | 'INSUFFICIENT_ROLE'
    | 'DELETED_OR_UNOWNED'
    | 'RETRY_TARGET_NOT_FOUND'
    | 'TURN_IN_PROGRESS'
    | 'RETRY_NOT_ALLOWED'
  messageId?: string | null
  requestContext?: AuditRequestContext
}

@Injectable()
export class ConversationAuditService {
  constructor(private readonly auditService: AuditService) {}

  async recordSessionDeleted(
    input: RecordSessionDeletedInput,
    transaction?: DatabaseTransaction,
  ): Promise<void> {
    await this.auditService.recordEvent(
      {
        actorUserId: input.actorUserId,
        action: AUDIT_EVENT_ACTIONS.CHAT_SESSION_DELETED,
        target: {
          type: AUDIT_TARGET_TYPES.CHAT_SESSION,
          id: input.sessionId,
        },
        courseId: input.courseId,
        metadata: {},
        requestContext: input.requestContext,
      },
      transaction,
    )
  }

  async recordAccessDenied(
    input: RecordAccessDeniedInput,
    transaction?: DatabaseTransaction,
  ): Promise<void> {
    await this.auditService.recordEvent(
      {
        actorUserId: input.actorUserId,
        action: AUDIT_EVENT_ACTIONS.CHAT_SESSION_ACCESS_DENIED,
        target: {
          type: AUDIT_TARGET_TYPES.CHAT_SESSION,
          id: input.sessionId ?? null,
        },
        courseId: input.courseId,
        metadata: {
          reason: input.reason,
          ...(input.messageId === undefined
            ? {}
            : { messageId: input.messageId }),
          ...(input.unverifiedCourseId === undefined ||
          input.unverifiedCourseId === null
            ? {}
            : { unverifiedCourseId: input.unverifiedCourseId }),
        },
        requestContext: input.requestContext,
      },
      transaction,
    )
  }
}
