import { ForbiddenException } from '@nestjs/common'
import type { ExecutionContext } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'

import { AuthTestStore } from '../../../test/support/auth-test-store'
import type { AuditService } from '../audit/audit.service'
import type { AppEnvironment } from '../config/env.schema'
import { P0_DEMO_PASSWORD } from '../../seeds/p0-demo.seed'
import { AuthGuard } from './auth.guard'
import { AuthService } from './auth.service'

const authConfig = {
  AUTH_ACCESS_TOKEN_SECRET:
    'test-access-token-secret-with-at-least-32-characters',
  AUTH_REFRESH_TOKEN_HASH_SECRET:
    'test-refresh-token-hash-secret-with-at-least-32-characters',
  AUTH_ACCESS_TOKEN_TTL_SECONDS: 900,
  AUTH_REFRESH_TOKEN_TTL_DAYS: 7,
} satisfies Partial<AppEnvironment>

function buildGuard() {
  const store = new AuthTestStore()
  const auditService = {
    recordEvent: jest.fn().mockResolvedValue(undefined),
  } as unknown as AuditService
  const configService = {
    get: jest.fn((key: keyof typeof authConfig) => authConfig[key]),
  } as unknown as ConfigService<AppEnvironment, true>
  const service = new AuthService(
    store.prisma,
    new JwtService(),
    configService,
    auditService,
    store.redis,
  )

  return {
    auditService,
    guard: new AuthGuard(service),
    service,
    store,
  }
}

function createExecutionContext(authorization: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: {
          authorization,
        },
        ip: '203.0.113.10',
        get: (headerName: string) =>
          headerName.toLowerCase() === 'user-agent' ? 'Jest' : undefined,
      }),
    }),
  } as unknown as ExecutionContext
}

describe('AuthGuard', () => {
  it('blocks an old access token after the account is disabled', async () => {
    const { guard, service, store } = buildGuard()
    const session = await service.signIn(
      {
        email: 'student1@morshid.demo',
        password: P0_DEMO_PASSWORD,
      },
      {
        ip: '203.0.113.10',
        userAgent: 'Jest',
      },
    )

    store.disableUser('student1@morshid.demo')

    await expect(
      guard.canActivate(
        createExecutionContext(`Bearer ${session.accessToken}`),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException)
  })
})
