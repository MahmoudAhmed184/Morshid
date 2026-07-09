import { UnauthorizedException } from '@nestjs/common'

import { buildAuthServiceTestHarness } from '../../../test/support/auth-service-test-harness'
import {
  AUDIT_EVENT_ACTIONS,
  AUDIT_TARGET_TYPES,
} from '../audit/audit.constants'
import { P0_DEMO_PASSWORD } from '../../seeds/p0-demo.seed'

describe('AuthService token lifecycle', () => {
  const anyDate = expect.any(Date) as unknown as Date
  const requestContext = {
    ip: '203.0.113.10',
    userAgent: 'Jest',
  }

  it('rotates refresh tokens and rejects the replaced token', async () => {
    const { service } = buildAuthServiceTestHarness()
    const session = await service.signIn(
      {
        email: 'student1@morshid.demo',
        password: P0_DEMO_PASSWORD,
      },
      requestContext,
    )

    const rotatedSession = await service.refresh(
      {
        refreshToken: session.refreshToken,
      },
      requestContext,
    )

    expect(rotatedSession.refreshToken).not.toBe(session.refreshToken)
    expect(rotatedSession.accessToken).toEqual(expect.any(String))
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
