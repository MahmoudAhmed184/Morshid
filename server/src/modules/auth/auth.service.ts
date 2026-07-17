import { Injectable } from '@nestjs/common'

import type { RefreshToken, User } from '../../generated/prisma/client'
import type {
  AuthenticatedRequestUser,
  AuthRequestContext,
  AuthSessionResponse,
  LogoutRequest,
  MeResponse,
  RefreshRequest,
  SignInRequest,
} from './auth.dto'
import {
  accountDisabledException,
  invalidAccessTokenException,
  invalidCredentialsException,
} from './auth.errors'
import { AccessTokenService } from './services/access-token.service'
import { AuthAuditService } from './services/auth-audit.service'
import { AuthUserService } from './services/auth-user.service'
import { PasswordHasherService } from './services/password-hasher.service'
import { RefreshTokenService } from './services/refresh-token.service'

@Injectable()
export class AuthService {
  constructor(
    private readonly passwordHasherService: PasswordHasherService,
    private readonly accessTokenService: AccessTokenService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly authUserService: AuthUserService,
    private readonly authAuditService: AuthAuditService,
  ) {}

  async signIn(
    input: SignInRequest,
    requestContext: AuthRequestContext,
  ): Promise<AuthSessionResponse> {
    const email = this.authUserService.normalizeEmail(input.email)
    const user = await this.authUserService.findByEmail(email)
    const isPasswordValid = this.passwordHasherService.verifyPassword(
      input.password,
      user?.passwordHash,
    )

    if (!isPasswordValid || !user) {
      await this.authAuditService.recordLoginFailed(email, requestContext)
      throw invalidCredentialsException()
    }

    if (this.authUserService.isDisabled(user)) {
      await this.authAuditService.recordDisabledAccountBlock(
        user,
        requestContext,
      )
      throw accountDisabledException()
    }

    const now = new Date()

    await this.authUserService.recordLastLogin(user, now)

    const session = await this.createSession(user, now, requestContext)

    await this.authAuditService.recordLoginSucceeded(
      user,
      session.refreshTokenRecord.id,
      requestContext,
    )

    return session.response
  }

  async refresh(
    input: RefreshRequest,
    requestContext: AuthRequestContext,
  ): Promise<AuthSessionResponse> {
    const now = new Date()
    const rotation = await this.refreshTokenService.rotate(
      input.refreshToken,
      now,
      requestContext,
    )

    if (rotation.kind === 'disabled') {
      await this.authAuditService.recordDisabledAccountBlock(
        {
          id: rotation.userId,
        },
        requestContext,
      )
      throw accountDisabledException()
    }

    const accessToken = await this.accessTokenService.create(rotation.user, now)
    const userSummary = await this.authUserService.buildUserSummary(
      rotation.user,
    )

    await this.authAuditService.recordRefreshTokenRotated(
      rotation.user,
      rotation.nextRefreshToken.record.id,
      rotation.previousToken.id,
      requestContext,
    )

    return {
      tokenType: 'Bearer',
      accessToken: accessToken.token,
      accessTokenExpiresAt: accessToken.expiresAt.toISOString(),
      refreshToken: rotation.nextRefreshToken.token,
      refreshTokenExpiresAt:
        rotation.nextRefreshToken.record.expiresAt.toISOString(),
      user: userSummary,
    }
  }

  async logout(
    input: LogoutRequest,
    requestContext: AuthRequestContext,
  ): Promise<void> {
    const now = new Date()
    const revoked = await this.refreshTokenService.revokeActive(
      input.refreshToken,
      now,
    )

    if (!revoked) {
      return
    }

    await this.authAuditService.recordLogout(revoked, requestContext)
  }

  async getMe(userId: string): Promise<MeResponse> {
    const user = await this.authUserService.findActiveUserById(userId)

    if (!user) {
      throw invalidAccessTokenException()
    }

    return {
      user: await this.authUserService.buildUserSummary(user),
    }
  }

  async authenticateAccessToken(
    accessToken: string,
    requestContext: AuthRequestContext,
  ): Promise<AuthenticatedRequestUser> {
    const payload = await this.accessTokenService.verify(accessToken)
    const user = await this.authUserService.findById(payload.sub)

    if (!user) {
      throw invalidAccessTokenException()
    }

    if (payload.passwordChangedAt !== user.passwordChangedAt.toISOString()) {
      throw invalidAccessTokenException()
    }

    if (this.authUserService.isDisabled(user)) {
      await this.authAuditService.recordDisabledAccountBlock(
        user,
        requestContext,
      )
      throw accountDisabledException()
    }

    return this.authUserService.pickAuthenticatedUser(user)
  }

  private async createSession(
    user: User,
    now: Date,
    requestContext: AuthRequestContext,
  ): Promise<{
    refreshTokenRecord: RefreshToken
    response: AuthSessionResponse
  }> {
    const accessToken = await this.accessTokenService.create(user, now)
    const refreshToken = await this.refreshTokenService.create(
      user,
      now,
      requestContext,
    )
    const userSummary = await this.authUserService.buildUserSummary(user)

    return {
      refreshTokenRecord: refreshToken.record,
      response: {
        tokenType: 'Bearer',
        accessToken: accessToken.token,
        accessTokenExpiresAt: accessToken.expiresAt.toISOString(),
        refreshToken: refreshToken.token,
        refreshTokenExpiresAt: refreshToken.record.expiresAt.toISOString(),
        user: userSummary,
      },
    }
  }
}
