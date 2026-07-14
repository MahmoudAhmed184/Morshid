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

interface RecordAccessDeniedInput {
  actorUserId: string
  courseId: string
  sessionId?: string | null
  reason: 'ACTIVE_STUDENT_MEMBERSHIP_REQUIRED' | 'DELETED_OR_UNOWNED'
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
        },
        requestContext: input.requestContext,
      },
      database,
    )
  }
}
