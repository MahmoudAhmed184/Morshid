import { Injectable } from '@nestjs/common'

import type {
  AuthenticatedUser,
  ChangePasswordRequest,
  IdentityRequestContext,
  IdentitySession,
  IdentityUserRecord,
  RefreshTokenRecord,
  LogoutRequest,
  MeResponse,
  RefreshRequest,
  SignInRequest,
  UpdateOwnProfileRequest,
} from './identity.types'
import {
  accountDisabledException,
  invalidAccessTokenException,
  invalidAuthRequestException,
  invalidCredentialsException,
} from './identity.errors'
import { AccessToken } from './access-token'
import { IdentityAudit } from './identity-audit'
import { IdentityUser } from './identity-user'
import { PasswordHasher } from './password-hasher'
import { defaultPasswordPolicy } from './password-policy'
import { RefreshSession } from './refresh-session'

@Injectable()
export class IdentityService {
  constructor(
    private readonly passwordHasher: PasswordHasher,
    private readonly accessToken: AccessToken,
    private readonly refreshSession: RefreshSession,
    private readonly identityUser: IdentityUser,
    private readonly identityAudit: IdentityAudit,
  ) {}

  async signIn(
    input: SignInRequest,
    requestContext: IdentityRequestContext,
  ): Promise<IdentitySession> {
    const email = this.identityUser.normalizeEmail(input.email)
    const user = await this.identityUser.findByEmail(email)
    const isPasswordValid = this.passwordHasher.verifyPassword(
      input.password,
      user?.passwordHash,
    )

    if (!isPasswordValid || !user) {
      await this.identityAudit.recordLoginFailed(email, requestContext)
      throw invalidCredentialsException()
    }

    if (this.identityUser.isDisabled(user)) {
      await this.identityAudit.recordDisabledAccountBlock(user, requestContext)
      throw accountDisabledException()
    }

    const now = new Date()

    await this.identityUser.recordLastLogin(user, now)

    const session = await this.createSession(user, now, requestContext)

    await this.identityAudit.recordLoginSucceeded(
      user,
      session.refreshTokenRecord.id,
      requestContext,
    )

    return session
  }

  async refresh(
    input: RefreshRequest,
    requestContext: IdentityRequestContext,
  ): Promise<IdentitySession> {
    const now = new Date()
    const rotation = await this.refreshSession.rotate(
      input.refreshToken,
      now,
      requestContext,
    )

    if (rotation.kind === 'disabled') {
      await this.identityAudit.recordDisabledAccountBlock(
        {
          id: rotation.userId,
        },
        requestContext,
      )
      throw accountDisabledException()
    }

    const accessToken = await this.accessToken.create(rotation.user, now)
    const session = this.buildSession(
      accessToken,
      rotation.nextRefreshToken,
      rotation.user,
    )

    await this.identityAudit.recordRefreshTokenRotated(
      rotation.user,
      rotation.nextRefreshToken.record.id,
      rotation.previousToken.id,
      requestContext,
    )

    return session
  }

  async logout(
    input: LogoutRequest,
    requestContext: IdentityRequestContext,
  ): Promise<void> {
    const now = new Date()
    const revoked = await this.refreshSession.revokeActive(
      input.refreshToken,
      now,
    )

    if (!revoked) {
      return
    }

    await this.identityAudit.recordLogout(revoked, requestContext)
  }

  async getMe(userId: string): Promise<MeResponse> {
    const user = await this.identityUser.findActiveUserById(userId)

    if (!user) {
      throw invalidAccessTokenException()
    }

    return {
      user: this.identityUser.buildIdentityUserSummary(user),
    }
  }

  async updateOwnProfile(
    userId: string,
    input: UpdateOwnProfileRequest,
    requestContext: IdentityRequestContext,
  ): Promise<MeResponse> {
    const user = await this.identityUser.findById(userId)

    if (!user) {
      throw invalidAccessTokenException()
    }

    if (this.identityUser.isDisabled(user)) {
      await this.identityAudit.recordDisabledAccountBlock(user, requestContext)
      throw accountDisabledException()
    }

    const trimmedDisplayName = input.displayName.trim()
    const oldDisplayName = user.displayName

    const updatedUser = await this.identityUser.updateDisplayName(
      userId,
      trimmedDisplayName,
    )

    await this.identityAudit.recordProfileUpdated(
      updatedUser,
      oldDisplayName,
      trimmedDisplayName,
      requestContext,
    )

    return {
      user: this.identityUser.buildIdentityUserSummary(updatedUser),
    }
  }

  async changePassword(
    userId: string,
    input: ChangePasswordRequest,
    requestContext: IdentityRequestContext,
    currentRefreshToken?: string | null,
  ): Promise<IdentitySession> {
    const user = await this.identityUser.findById(userId)

    if (!user) {
      throw invalidAccessTokenException()
    }

    if (this.identityUser.isDisabled(user)) {
      await this.identityAudit.recordDisabledAccountBlock(user, requestContext)
      throw accountDisabledException()
    }

    const isCurrentPasswordValid = this.passwordHasher.verifyPassword(
      input.currentPassword,
      user.passwordHash,
    )

    if (!isCurrentPasswordValid) {
      throw invalidCredentialsException()
    }

    const policyValidation = defaultPasswordPolicy.validate(input.newPassword, {
      currentPassword: input.currentPassword,
      email: user.email,
      displayName: user.displayName,
    })

    if (!policyValidation.isValid) {
      throw invalidAuthRequestException()
    }

    const now = new Date()
    const newPasswordHash = this.passwordHasher.createHash(input.newPassword)

    const result = await this.refreshSession.changePasswordAndRotate(
      userId,
      newPasswordHash,
      currentRefreshToken ?? null,
      now,
      requestContext,
    )

    if (result.kind === 'disabled') {
      await this.identityAudit.recordDisabledAccountBlock(
        result.user,
        requestContext,
      )
      throw accountDisabledException()
    }

    const accessToken = await this.accessToken.create(result.user, now)
    const session = this.buildSession(
      accessToken,
      result.nextRefreshToken,
      result.user,
    )

    await this.identityAudit.recordPasswordChanged(result.user, requestContext)

    return session
  }

  async authenticateAccessToken(
    accessToken: string,
    requestContext: IdentityRequestContext,
  ): Promise<AuthenticatedUser> {
    const payload = await this.accessToken.verify(accessToken)
    const user = await this.identityUser.findById(payload.sub)

    if (!user) {
      throw invalidAccessTokenException()
    }

    if (payload.passwordChangedAt !== user.passwordChangedAt.toISOString()) {
      throw invalidAccessTokenException()
    }

    if (this.identityUser.isDisabled(user)) {
      await this.identityAudit.recordDisabledAccountBlock(user, requestContext)
      throw accountDisabledException()
    }

    return this.identityUser.pickAuthenticatedUser(user)
  }

  private async createSession(
    user: IdentityUserRecord,
    now: Date,
    requestContext: IdentityRequestContext,
  ): Promise<CreatedIdentitySession> {
    const accessToken = await this.accessToken.create(user, now)
    const refreshToken = await this.refreshSession.create(
      user,
      now,
      requestContext,
    )
    const session = this.buildSession(accessToken, refreshToken, user)

    return {
      refreshTokenRecord: refreshToken.record,
      ...session,
    }
  }

  private buildSession(
    accessToken: Awaited<ReturnType<AccessToken['create']>>,
    refreshToken: Awaited<ReturnType<RefreshSession['create']>>,
    user: IdentityUserRecord,
  ): IdentitySession {
    return {
      response: {
        tokenType: 'Bearer',
        accessToken: accessToken.token,
        accessTokenExpiresAt: accessToken.expiresAt.toISOString(),
        user: this.identityUser.buildIdentityUserSummary(user),
      },
      refreshToken: refreshToken.token,
      refreshTokenExpiresAt: refreshToken.record.expiresAt.toISOString(),
    }
  }
}

type CreatedIdentitySession = IdentitySession & {
  refreshTokenRecord: RefreshTokenRecord
}
