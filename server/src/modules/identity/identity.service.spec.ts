import { ForbiddenException, UnauthorizedException } from '@nestjs/common'

import { buildIdentityServiceTestHarness } from '../../../test/support/identity-service-test-harness'
import { AUDIT_EVENT_ACTIONS, AUDIT_TARGET_TYPES } from '../audit/audit.public'
import { P0_DEMO_PASSWORD } from '../../seeds/p0-demo.seed'
import { IDENTITY_ERROR_CODES } from './identity.types'

describe('IdentityService token lifecycle', () => {
  const anyDate = expect.any(Date) as unknown as Date
  const requestContext = {
    ip: '203.0.113.10',
    userAgent: 'Jest',
  }

  it('blocks sign-in for a disabled account after validating credentials', async () => {
    const { service, store } = buildIdentityServiceTestHarness()

    store.disableUser('student1@morshid.demo')

    await expect(
      service.signIn(
        {
          email: 'student1@morshid.demo',
          password: P0_DEMO_PASSWORD,
        },
        requestContext,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException)
    expect(store.refreshTokens.size).toBe(0)
  })

  it('returns invalid credentials for a disabled account with the wrong password', async () => {
    const { service, store } = buildIdentityServiceTestHarness()

    store.disableUser('student1@morshid.demo')

    const signIn = service.signIn(
      {
        email: 'student1@morshid.demo',
        password: 'wrong-password',
      },
      requestContext,
    )

    await expect(signIn).rejects.toBeInstanceOf(UnauthorizedException)
    await expect(signIn).rejects.toMatchObject({
      response: {
        code: IDENTITY_ERROR_CODES.INVALID_CREDENTIALS,
        message: 'Invalid email or password',
      },
    })
  })

  it('revokes the submitted refresh token without replacing it after account disablement', async () => {
    const { service, store } = buildIdentityServiceTestHarness()
    const session = await service.signIn(
      {
        email: 'student1@morshid.demo',
        password: P0_DEMO_PASSWORD,
      },
      requestContext,
    )

    store.disableUser('student1@morshid.demo')

    await expect(
      service.refresh(
        {
          refreshToken: session.refreshToken,
        },
        requestContext,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException)

    const storedTokens = [...store.refreshTokens.values()]

    expect(storedTokens).toHaveLength(1)
    expect(storedTokens[0].revokedAt).toBeInstanceOf(Date)
    expect(storedTokens[0].replacedByTokenId).toBeNull()
  })

  it('rotates refresh tokens and rejects the replaced token', async () => {
    const { service, store } = buildIdentityServiceTestHarness()
    const session = await service.signIn(
      {
        email: 'student1@morshid.demo',
        password: P0_DEMO_PASSWORD,
      },
      requestContext,
    )
    const transactionSpy = jest.spyOn(store.prisma, '$transaction')

    const rotatedSession = await service.refresh(
      {
        refreshToken: session.refreshToken,
      },
      requestContext,
    )

    expect(rotatedSession.refreshToken).not.toBe(session.refreshToken)
    expect(rotatedSession.response.accessToken).toEqual(expect.any(String))
    expect(transactionSpy).toHaveBeenCalledWith(expect.any(Function), {
      maxWait: 10_000,
      timeout: 5_000,
    })
    await expect(
      service.refresh(
        {
          refreshToken: session.refreshToken,
        },
        requestContext,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('does not issue a replacement when the active refresh token revoke loses a race', async () => {
    const { service, store } = buildIdentityServiceTestHarness()
    const session = await service.signIn(
      {
        email: 'student1@morshid.demo',
        password: P0_DEMO_PASSWORD,
      },
      requestContext,
    )

    store.simulateNextActiveRefreshTokenRevokeRace()

    await expect(
      service.refresh(
        {
          refreshToken: session.refreshToken,
        },
        requestContext,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException)
    expect(store.refreshTokens.size).toBe(1)
  })

  it('makes logout idempotent and invalidates the submitted refresh token', async () => {
    const { service, store } = buildIdentityServiceTestHarness()
    const session = await service.signIn(
      {
        email: 'student1@morshid.demo',
        password: P0_DEMO_PASSWORD,
      },
      requestContext,
    )

    await expect(
      service.logout(
        {
          refreshToken: session.refreshToken,
        },
        requestContext,
      ),
    ).resolves.toBeUndefined()
    await expect(
      service.logout(
        {
          refreshToken: session.refreshToken,
        },
        requestContext,
      ),
    ).resolves.toBeUndefined()
    await expect(
      service.refresh(
        {
          refreshToken: session.refreshToken,
        },
        requestContext,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException)

    const student = store.findUserByEmail('student1@morshid.demo')
    const refreshTokenRecord = [...store.refreshTokens.values()][0]
    const logoutEvents = [...store.auditLogs.values()].filter(
      (auditLog) => auditLog.action === AUDIT_EVENT_ACTIONS.AUTH_LOGOUT,
    )

    expect(logoutEvents[0]).toEqual(
      expect.objectContaining({
        actorUserId: student?.id,
        action: AUDIT_EVENT_ACTIONS.AUTH_LOGOUT,
        targetType: AUDIT_TARGET_TYPES.AUTH_SESSION,
        targetId: refreshTokenRecord.id,
        ip: requestContext.ip,
        userAgent: requestContext.userAgent,
        metadata: {
          refreshTokenCreatedAt: refreshTokenRecord.createdAt.toISOString(),
          refreshTokenExpiresAt: refreshTokenRecord.expiresAt.toISOString(),
          refreshTokenIp: refreshTokenRecord.ip,
          refreshTokenRevokedAt: refreshTokenRecord.revokedAt?.toISOString(),
          refreshTokenUserAgent: refreshTokenRecord.userAgent,
        },
        createdAt: anyDate,
      }),
    )
  })

  describe('updateOwnProfile', () => {
    it('updates own display name, trims whitespace, and records an audit log', async () => {
      const { service, store } = buildIdentityServiceTestHarness()
      const student = store.findUserByEmail('student1@morshid.demo')
      if (!student) throw new Error('Missing student')
      const oldDisplayName = student.displayName

      const result = await service.updateOwnProfile(
        student.id,
        { displayName: '   Updated Student Name   ' },
        requestContext,
      )

      expect(result.user.displayName).toBe('Updated Student Name')
      expect(store.users.get(student.id)?.displayName).toBe(
        'Updated Student Name',
      )

      const profileAuditLogs = [...store.auditLogs.values()].filter(
        (log) => log.action === AUDIT_EVENT_ACTIONS.AUTH_PROFILE_UPDATED,
      )
      expect(profileAuditLogs).toHaveLength(1)
      expect(profileAuditLogs[0]).toEqual(
        expect.objectContaining({
          actorUserId: student.id,
          action: AUDIT_EVENT_ACTIONS.AUTH_PROFILE_UPDATED,
          targetType: AUDIT_TARGET_TYPES.USER,
          targetId: student.id,
          ip: requestContext.ip,
          userAgent: requestContext.userAgent,
          metadata: {
            oldDisplayName,
            newDisplayName: 'Updated Student Name',
          },
        }),
      )
    })

    it('rejects profile update for disabled account and records disabled account block audit log', async () => {
      const { service, store } = buildIdentityServiceTestHarness()
      const student = store.findUserByEmail('student1@morshid.demo')
      if (!student) throw new Error('Missing student')

      store.disableUser('student1@morshid.demo')

      await expect(
        service.updateOwnProfile(
          student.id,
          { displayName: 'New Name' },
          requestContext,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException)

      const blockLogs = [...store.auditLogs.values()].filter(
        (log) =>
          log.action ===
          AUDIT_EVENT_ACTIONS.AUTH_LOGIN_BLOCKED_DISABLED_ACCOUNT,
      )
      expect(blockLogs).toHaveLength(1)
      expect(blockLogs[0].actorUserId).toBe(student.id)
    })

    it('rejects profile update for nonexistent user', async () => {
      const { service } = buildIdentityServiceTestHarness()

      await expect(
        service.updateOwnProfile(
          '00000000-0000-0000-0000-000000000999',
          { displayName: 'New Name' },
          requestContext,
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException)
    })
  })

  describe('changePassword', () => {
    const validNewPassword = 'A brand new safe passphrase 2026!'

    it('changes password successfully, rotates current session, revokes other sessions, and records audit event', async () => {
      const { service, store } = buildIdentityServiceTestHarness()
      const student = store.findUserByEmail('student1@morshid.demo')
      if (!student) throw new Error('Missing student')

      // Create two sessions (session 1 and session 2)
      const session1 = await service.signIn(
        {
          email: 'student1@morshid.demo',
          password: P0_DEMO_PASSWORD,
        },
        requestContext,
      )
      const session2 = await service.signIn(
        {
          email: 'student1@morshid.demo',
          password: P0_DEMO_PASSWORD,
        },
        requestContext,
      )

      expect(store.refreshTokens.size).toBe(2)

      const resultSession = await service.changePassword(
        student.id,
        {
          currentPassword: P0_DEMO_PASSWORD,
          newPassword: validNewPassword,
          confirmation: validNewPassword,
        },
        requestContext,
        session2.refreshToken,
      )

      expect(resultSession.response.accessToken).toBeDefined()
      expect(resultSession.refreshToken).toBeDefined()
      expect(resultSession.refreshToken).not.toBe(session2.refreshToken)

      // Old password should fail sign in
      await expect(
        service.signIn(
          {
            email: 'student1@morshid.demo',
            password: P0_DEMO_PASSWORD,
          },
          requestContext,
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException)

      // New password should succeed sign in
      const newSignIn = await service.signIn(
        {
          email: 'student1@morshid.demo',
          password: validNewPassword,
        },
        requestContext,
      )
      expect(newSignIn.response.accessToken).toBeDefined()

      // Session 1 should be revoked and unable to refresh
      await expect(
        service.refresh(
          {
            refreshToken: session1.refreshToken,
          },
          requestContext,
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException)

      // Old access token verification should fail due to passwordChangedAt mismatch
      await expect(
        service.authenticateAccessToken(
          session2.response.accessToken,
          requestContext,
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException)

      // Rotated session should be active and able to authenticate
      const authenticated = await service.authenticateAccessToken(
        resultSession.response.accessToken,
        requestContext,
      )
      expect(authenticated.id).toBe(student.id)

      // Audit event should be recorded with no password material
      const passwordAuditLogs = [...store.auditLogs.values()].filter(
        (log) => log.action === AUDIT_EVENT_ACTIONS.AUTH_PASSWORD_CHANGED,
      )
      expect(passwordAuditLogs).toHaveLength(1)
      expect(passwordAuditLogs[0]).toEqual(
        expect.objectContaining({
          actorUserId: student.id,
          action: AUDIT_EVENT_ACTIONS.AUTH_PASSWORD_CHANGED,
          targetType: AUDIT_TARGET_TYPES.USER,
          targetId: student.id,
          ip: requestContext.ip,
          userAgent: requestContext.userAgent,
          metadata: {},
        }),
      )
    })

    it('rejects incorrect current password with generic invalid credentials exception', async () => {
      const { service, store } = buildIdentityServiceTestHarness()
      const student = store.findUserByEmail('student1@morshid.demo')
      if (!student) throw new Error('Missing student')

      await expect(
        service.changePassword(
          student.id,
          {
            currentPassword: 'wrong-current-password',
            newPassword: validNewPassword,
            confirmation: validNewPassword,
          },
          requestContext,
        ),
      ).rejects.toMatchObject({
        response: {
          code: IDENTITY_ERROR_CODES.INVALID_CREDENTIALS,
        },
      })
    })

    it('rejects new password matching current password', async () => {
      const { service, store } = buildIdentityServiceTestHarness()
      const student = store.findUserByEmail('student1@morshid.demo')
      if (!student) throw new Error('Missing student')

      await expect(
        service.changePassword(
          student.id,
          {
            currentPassword: P0_DEMO_PASSWORD,
            newPassword: P0_DEMO_PASSWORD,
            confirmation: P0_DEMO_PASSWORD,
          },
          requestContext,
        ),
      ).rejects.toMatchObject({
        response: {
          code: IDENTITY_ERROR_CODES.INVALID_REQUEST,
        },
      })
    })

    it('rejects change password for a disabled account', async () => {
      const { service, store } = buildIdentityServiceTestHarness()
      const student = store.findUserByEmail('student1@morshid.demo')
      if (!student) throw new Error('Missing student')

      store.disableUser('student1@morshid.demo')

      await expect(
        service.changePassword(
          student.id,
          {
            currentPassword: P0_DEMO_PASSWORD,
            newPassword: validNewPassword,
            confirmation: validNewPassword,
          },
          requestContext,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException)

      const blockLogs = [...store.auditLogs.values()].filter(
        (log) =>
          log.action ===
          AUDIT_EVENT_ACTIONS.AUTH_LOGIN_BLOCKED_DISABLED_ACCOUNT,
      )
      expect(blockLogs).toHaveLength(1)
    })
  })
})
