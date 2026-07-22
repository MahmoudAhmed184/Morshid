import { Injectable } from '@nestjs/common'

import {
  AUDIT_EVENT_ACTIONS,
  AUDIT_TARGET_TYPES,
} from '../audit/audit.constants'
import {
  AuditService,
  type AuditDatabase,
  type AuditRequestContext,
} from '../audit/audit.service'

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
    | 'ASSISTANT_MESSAGE_NOT_FOUND'
    | 'ASSISTANT_MESSAGE_NOT_PENDING'
    | 'RETRY_TARGET_NOT_FOUND'
    | 'TURN_IN_PROGRESS'
    | 'RETRY_NOT_ALLOWED'
  messageId?: string | null
  requestContext?: AuditRequestContext
}

@Injectable()
export class StudentChatAuditService {
  constructor(private readonly auditService: AuditService) {}

  async recordSessionDeleted(
    input: RecordSessionDeletedInput,
    database?: AuditDatabase,
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
      database,
    )
  }

  async recordAccessDenied(
    input: RecordAccessDeniedInput,
    database?: AuditDatabase,
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
      database,
    )
  }
}
