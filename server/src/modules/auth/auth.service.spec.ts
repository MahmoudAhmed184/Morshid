import { ForbiddenException, UnauthorizedException } from '@nestjs/common'

import { buildAuthServiceTestHarness } from '../../../test/support/auth-service-test-harness'
import {
  AUDIT_EVENT_ACTIONS,
  AUDIT_TARGET_TYPES,
} from '../audit/audit.constants'
import { P0_DEMO_PASSWORD } from '../../seeds/p0-demo.seed'
import { AUTH_ERROR_CODES } from './auth.dto'

describe('AuthService token lifecycle', () => {
  const anyDate = expect.any(Date) as unknown as Date
  const requestContext = {
    ip: '203.0.113.10',
    userAgent: 'Jest',
  }

  it('blocks sign-in for a disabled account after validating credentials', async () => {
    const { service, store } = buildAuthServiceTestHarness()

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
    const { service, store } = buildAuthServiceTestHarness()

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
        code: AUTH_ERROR_CODES.INVALID_CREDENTIALS,
        message: 'Invalid email or password',
      },
    })
  })

  it('revokes the submitted refresh token without replacing it after account disablement', async () => {
    const { service, store } = buildAuthServiceTestHarness()
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
    const { service, store } = buildAuthServiceTestHarness()
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
    expect(rotatedSession.accessToken).toEqual(expect.any(String))
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
    const { service, store } = buildAuthServiceTestHarness()
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
    const { service, store } = buildAuthServiceTestHarness()
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

    expect(student).not.toBeNull()
    expect(refreshTokenRecord.revokedAt).toBeInstanceOf(Date)
    expect(logoutEvents).toHaveLength(1)
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
})
