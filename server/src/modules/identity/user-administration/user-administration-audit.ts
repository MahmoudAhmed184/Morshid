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

interface ManagedUserAuditInput {
  actorUserId: string
  targetUser: UserAdministrationAuditTarget
  requestContext?: AuditRequestContext
}

interface ManagedUserUpdatedAuditInput extends ManagedUserAuditInput {
  previousUser: UserAdministrationAuditTarget
}

interface UserAdministrationAuditTarget {
  id: string
  email: string
  displayName: string
  role: UserRole
}

interface ManagedUserAuditWithRevocationInput extends ManagedUserAuditInput {
  revokedRefreshTokenCount: number
}

type RecordManagedUserCreatedInput = ManagedUserAuditInput
type RecordManagedUserUpdatedInput = ManagedUserUpdatedAuditInput
type RecordManagedUserDisabledInput = ManagedUserAuditWithRevocationInput
type RecordManagedUserReactivatedInput = ManagedUserAuditInput
type RecordManagedUserPasswordResetInput = ManagedUserAuditWithRevocationInput

@Injectable()
export class UserAdministrationAuditService {
  constructor(private readonly auditService: AuditService) {}

  async recordUserCreated(
    input: RecordManagedUserCreatedInput,
    database?: AuditDatabase,
  ): Promise<void> {
    await this.recordUserEvent(
      AUDIT_EVENT_ACTIONS.ADMIN_ACCOUNT_CREATED,
      input,
      {},
      database,
    )
  }

  async recordUserUpdated(
    input: RecordManagedUserUpdatedInput,
    database?: AuditDatabase,
  ): Promise<void> {
    const before = userAuditSnapshot(input.previousUser)
    const after = userAuditSnapshot(input.targetUser)

    await this.auditService.recordEvent(
      {
        actorUserId: input.actorUserId,
        action: AUDIT_EVENT_ACTIONS.ADMIN_ACCOUNT_UPDATED,
        target: {
          type: AUDIT_TARGET_TYPES.USER,
          id: input.targetUser.id,
        },
        metadata: {
          before,
          after,
          changedFields: Object.keys(after).filter(
            (field) =>
              before[field as keyof typeof before] !==
              after[field as keyof typeof after],
          ),
        },
        requestContext: input.requestContext,
      },
      database,
    )
  }

  async recordUserDisabled(
    input: RecordManagedUserDisabledInput,
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
    input: RecordManagedUserReactivatedInput,
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
    input: RecordManagedUserPasswordResetInput,
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
    input: ManagedUserAuditInput,
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

function userAuditSnapshot(user: UserAdministrationAuditTarget) {
  return {
    email: user.email,
    displayName: user.displayName,
    role: user.role,
  }
}
