import { Injectable } from '@nestjs/common'

import { AUDIT_EVENT_ACTIONS, AUDIT_TARGET_TYPES } from '../audit/audit.public'
import { AuditService } from '../audit/audit.public'
import type { IdentityRequestContext } from './identity.types'

@Injectable()
export class IdentityAudit {
  constructor(private readonly auditService: AuditService) {}

  async recordLoginFailed(
    email: string,
    requestContext: IdentityRequestContext,
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
    user: Pick<IdentityAuditUser, 'id'>,
    requestContext: IdentityRequestContext,
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
    user: Pick<IdentityAuditUser, 'id'>,
    refreshTokenId: string,
    requestContext: IdentityRequestContext,
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
    user: Pick<IdentityAuditUser, 'id'>,
    nextRefreshTokenId: string,
    previousRefreshTokenId: string,
    requestContext: IdentityRequestContext,
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

  async recordLogout(
    refreshToken: IdentityAuditRefreshToken,
    requestContext: IdentityRequestContext,
  ): Promise<void> {
    await this.auditService.recordEvent({
      actorUserId: refreshToken.user.id,
      action: AUDIT_EVENT_ACTIONS.AUTH_LOGOUT,
      target: {
        type: AUDIT_TARGET_TYPES.AUTH_SESSION,
        id: refreshToken.id,
      },
      metadata: {
        refreshTokenCreatedAt: refreshToken.createdAt.toISOString(),
        refreshTokenExpiresAt: refreshToken.expiresAt.toISOString(),
        refreshTokenIp: refreshToken.ip,
        refreshTokenRevokedAt: refreshToken.revokedAt?.toISOString() ?? null,
        refreshTokenUserAgent: refreshToken.userAgent,
      },
      requestContext,
    })
  }

  async recordProfileUpdated(
    user: Pick<IdentityAuditUser, 'id'>,
    oldDisplayName: string,
    newDisplayName: string,
    requestContext: IdentityRequestContext,
  ): Promise<void> {
    await this.auditService.recordEvent({
      actorUserId: user.id,
      action: AUDIT_EVENT_ACTIONS.AUTH_PROFILE_UPDATED,
      target: {
        type: AUDIT_TARGET_TYPES.USER,
        id: user.id,
      },
      metadata: {
        oldDisplayName,
        newDisplayName,
      },
      requestContext,
    })
  }

  async recordPasswordChanged(
    user: Pick<IdentityAuditUser, 'id'>,
    requestContext: IdentityRequestContext,
  ): Promise<void> {
    await this.auditService.recordEvent({
      actorUserId: user.id,
      action: AUDIT_EVENT_ACTIONS.AUTH_PASSWORD_CHANGED,
      target: {
        type: AUDIT_TARGET_TYPES.USER,
        id: user.id,
      },
      metadata: {},
      requestContext,
    })
  }
}

interface IdentityAuditUser {
  id: string
}

interface IdentityAuditRefreshToken {
  id: string
  createdAt: Date
  expiresAt: Date
  ip: string | null
  revokedAt: Date | null
  user: IdentityAuditUser
  userAgent: string | null
}
