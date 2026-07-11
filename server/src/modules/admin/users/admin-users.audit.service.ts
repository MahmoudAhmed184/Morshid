import { Injectable } from '@nestjs/common'

import {
  AUDIT_EVENT_ACTIONS,
  AUDIT_TARGET_TYPES,
} from '../../audit/audit.constants'
import {
  AuditService,
  type AuditDatabase,
  type AuditRequestContext,
} from '../../audit/audit.service'
import type { UserRole } from '../../../generated/prisma/client'

interface RecordAdminUserCreatedInput {
  actorUserId: string
  targetUser: {
    id: string
    email: string
    displayName: string
    role: UserRole
  }
  requestContext?: AuditRequestContext
}

@Injectable()
export class AdminUsersAuditService {
  constructor(private readonly auditService: AuditService) {}

  async recordUserCreated(
    input: RecordAdminUserCreatedInput,
    database?: AuditDatabase,
  ): Promise<void> {
    await this.auditService.recordEvent(
      {
        actorUserId: input.actorUserId,
        action: AUDIT_EVENT_ACTIONS.ADMIN_ACCOUNT_CREATED,
        target: {
          type: AUDIT_TARGET_TYPES.USER,
          id: input.targetUser.id,
        },
        metadata: {
          email: input.targetUser.email,
          displayName: input.targetUser.displayName,
          role: input.targetUser.role,
        },
        requestContext: input.requestContext,
      },
      database,
    )
  }
}
