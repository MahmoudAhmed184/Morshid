import { UnauthorizedException } from '@nestjs/common'

import { buildAuthServiceTestHarness } from '../../../test/support/auth-service-test-harness'
import { createLegacyScryptPasswordHash } from '../../../test/support/legacy-password-hash'
import { P0_DEMO_PASSWORD } from '../../seeds/p0-demo.seed'

describe('AuthService token lifecycle', () => {
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
    const { service } = buildAuthServiceTestHarness()
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
  })

  it('rehashes a valid legacy scrypt password after sign-in', async () => {
    const { service, store } = buildAuthServiceTestHarness()
    const user = store.findUserByEmail('student1@morshid.demo')

    if (!user) {
      throw new Error('Missing seeded test user')
    }

    const legacyPasswordHash = createLegacyScryptPasswordHash(
      P0_DEMO_PASSWORD,
      'legacy-student-salt',
    )
    store.users.set(user.id, {
      ...user,
      passwordHash: legacyPasswordHash,
    })

    await service.signIn(
      {
        email: 'student1@morshid.demo',
        password: P0_DEMO_PASSWORD,
      },
      requestContext,
    )

    expect(
      store.findUserByEmail('student1@morshid.demo')?.passwordHash,
    ).toEqual(
      expect.stringMatching(
        /^argon2id:v1:m=19456,t=2,p=1,keylen=32:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/,
      ),
    )
    expect(
      store.findUserByEmail('student1@morshid.demo')?.passwordHash,
    ).not.toBe(legacyPasswordHash)
  })
})
