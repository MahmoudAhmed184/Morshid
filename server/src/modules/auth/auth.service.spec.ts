import { UnauthorizedException } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'

import { AuthTestStore } from '../../../test/support/auth-test-store'
import type { AppEnvironment } from '../config/env.schema'
import type { AuditService } from '../audit/audit.service'
import { P0_DEMO_PASSWORD } from '../../seeds/p0-demo.seed'
import { AuthService } from './auth.service'

const authConfig = {
  AUTH_ACCESS_TOKEN_SECRET:
    'test-access-token-secret-with-at-least-32-characters',
  AUTH_REFRESH_TOKEN_HASH_SECRET:
    'test-refresh-token-hash-secret-with-at-least-32-characters',
  AUTH_ACCESS_TOKEN_TTL_SECONDS: 900,
  AUTH_REFRESH_TOKEN_TTL_DAYS: 7,
} satisfies Partial<AppEnvironment>

function buildAuthService() {
  const store = new AuthTestStore()
  const auditService = {
    recordEvent: jest.fn().mockResolvedValue(undefined),
  } as unknown as AuditService
  const configService = {
    get: jest.fn((key: keyof typeof authConfig) => authConfig[key]),
  } as unknown as ConfigService<AppEnvironment, true>

  return {
    auditService,
    service: new AuthService(
      store.prisma,
      new JwtService(),
      configService,
      auditService,
    ),
    store,
  }
}

describe('AuthService token lifecycle', () => {
  const requestContext = {
    ip: '203.0.113.10',
    userAgent: 'Jest',
  }

  it('rotates refresh tokens and rejects the replaced token', async () => {
    const { service } = buildAuthService()
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

  it('makes logout idempotent and invalidates the submitted refresh token', async () => {
    const { service } = buildAuthService()
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
})
