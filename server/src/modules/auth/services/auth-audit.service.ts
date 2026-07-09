import { Injectable } from '@nestjs/common'

import {
  AUDIT_EVENT_ACTIONS,
  AUDIT_TARGET_TYPES,
} from '../../audit/audit.constants'
import { AuditService } from '../../audit/audit.service'
import type { AuthRequestContext } from '../auth.dto'

@Injectable()
export class AuthAuditService {
  constructor(private readonly auditService: AuditService) {}

  async recordLoginFailed(
    email: string,
    requestContext: AuthRequestContext,
  ): Promise<void> {
    await this.auditService.recordEvent({
      action: AUDIT_EVENT_ACTIONS.AUTH_LOGIN_FAILED,
      target: {
        type: AUDIT_TARGET_TYPES.AUTH_SESSION,
      },
      metadata: {
        email,
      },
      requestContext,
    })
  }

  async recordDisabledAccountBlock(
    user: Pick<AuthAuditUser, 'id'>,
    requestContext: AuthRequestContext,
  ): Promise<void> {
    await this.auditService.recordEvent({
      actorUserId: user.id,
      action: AUDIT_EVENT_ACTIONS.AUTH_LOGIN_BLOCKED_DISABLED_ACCOUNT,
      target: {
        type: AUDIT_TARGET_TYPES.USER,
        id: user.id,
      },
      requestContext,
    })
  }

  async recordLoginSucceeded(
    user: Pick<AuthAuditUser, 'id'>,
    refreshTokenId: string,
    requestContext: AuthRequestContext,
  ): Promise<void> {
    await this.auditService.recordEvent({
      actorUserId: user.id,
      action: AUDIT_EVENT_ACTIONS.AUTH_LOGIN_SUCCEEDED,
      target: {
        type: AUDIT_TARGET_TYPES.AUTH_SESSION,
        id: refreshTokenId,
      },
      requestContext,
    })
  }

  async recordRefreshTokenRotated(
    user: Pick<AuthAuditUser, 'id'>,
    nextRefreshTokenId: string,
    previousRefreshTokenId: string,
    requestContext: AuthRequestContext,
  ): Promise<void> {
    await this.auditService.recordEvent({
      actorUserId: user.id,
      action: AUDIT_EVENT_ACTIONS.AUTH_REFRESH_TOKEN_ROTATED,
      target: {
        type: AUDIT_TARGET_TYPES.AUTH_SESSION,
        id: nextRefreshTokenId,
      },
      metadata: {
        previousRefreshTokenId,
      },
      requestContext,
    })
  }

  async recordLogout(requestContext: AuthRequestContext): Promise<void> {
    await this.auditService.recordEvent({
      action: AUDIT_EVENT_ACTIONS.AUTH_LOGOUT,
      target: {
        type: AUDIT_TARGET_TYPES.AUTH_SESSION,
      },
      requestContext,
    })
  }
}

interface AuthAuditUser {
  id: string
}
