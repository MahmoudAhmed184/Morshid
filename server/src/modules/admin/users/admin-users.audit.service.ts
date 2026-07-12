import { Injectable } from '@nestjs/common'

import {
  AUDIT_EVENT_ACTIONS,
  AUDIT_TARGET_TYPES,
} from '../../audit/audit.constants'
import {
  AuditService,
  type AuditDatabase,
  type AuditMetadata,
  type AuditRequestContext,
} from '../../audit/audit.service'
import type { AuditEventAction } from '../../audit/audit.constants'
import type { UserRole } from '../../../generated/prisma/client'

interface AdminUserAuditInput {
  actorUserId: string
  targetUser: AdminAuditTargetUser
  requestContext?: AuditRequestContext
}

interface AdminAuditTargetUser {
  id: string
  email: string
  displayName: string
  role: UserRole
}

interface AdminUserAuditWithRevocationInput extends AdminUserAuditInput {
  revokedRefreshTokenCount: number
}

type RecordAdminUserCreatedInput = AdminUserAuditInput
type RecordAdminUserDisabledInput = AdminUserAuditWithRevocationInput
type RecordAdminUserReactivatedInput = AdminUserAuditInput
type RecordAdminUserPasswordResetInput = AdminUserAuditWithRevocationInput

@Injectable()
export class AdminUsersAuditService {
  constructor(private readonly auditService: AuditService) {}

  async recordUserCreated(
    input: RecordAdminUserCreatedInput,
    database?: AuditDatabase,
  ): Promise<void> {
    await this.recordUserEvent(
      AUDIT_EVENT_ACTIONS.ADMIN_ACCOUNT_CREATED,
      input,
      {},
      database,
    )
  }

  async recordUserDisabled(
    input: RecordAdminUserDisabledInput,
    database?: AuditDatabase,
  ): Promise<void> {
    await this.recordUserEvent(
      AUDIT_EVENT_ACTIONS.ADMIN_ACCOUNT_DISABLED,
      input,
      { revokedRefreshTokenCount: input.revokedRefreshTokenCount },
      database,
    )
  }

  async recordUserReactivated(
    input: RecordAdminUserReactivatedInput,
    database?: AuditDatabase,
  ): Promise<void> {
    await this.recordUserEvent(
      AUDIT_EVENT_ACTIONS.ADMIN_ACCOUNT_ENABLED,
      input,
      {},
      database,
    )
  }

  async recordUserPasswordReset(
    input: RecordAdminUserPasswordResetInput,
    database?: AuditDatabase,
  ): Promise<void> {
    await this.recordUserEvent(
      AUDIT_EVENT_ACTIONS.ADMIN_USER_PASSWORD_RESET,
      input,
      {
        refreshTokensRevoked: input.revokedRefreshTokenCount > 0,
        revokedRefreshTokenCount: input.revokedRefreshTokenCount,
      },
      database,
    )
  }

  private async recordUserEvent(
    action: AuditEventAction,
    input: AdminUserAuditInput,
    metadata: AuditMetadata,
    database?: AuditDatabase,
  ): Promise<void> {
    await this.auditService.recordEvent(
      {
        actorUserId: input.actorUserId,
        action,
        target: {
          type: AUDIT_TARGET_TYPES.USER,
          id: input.targetUser.id,
        },
        metadata: {
          email: input.targetUser.email,
          displayName: input.targetUser.displayName,
          role: input.targetUser.role,
          ...metadata,
        },
        requestContext: input.requestContext,
      },
      database,
    )
  }
}
