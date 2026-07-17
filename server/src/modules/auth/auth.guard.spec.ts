import { ForbiddenException } from '@nestjs/common'
import type { ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'

import { buildAuthServiceTestHarness } from '../../../test/support/auth-service-test-harness'
import { P0_DEMO_PASSWORD } from '../../seeds/p0-demo.seed'
import { AuthGuard } from './auth.guard'

function buildGuard() {
  const harness = buildAuthServiceTestHarness()

  return {
    ...harness,
    guard: new AuthGuard(harness.service, new Reflector()),
  }
}

function createExecutionContext(authorization: string): ExecutionContext {
  const handler = () => undefined
  return {
    getHandler: () => handler,
    getClass: () => Object,
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
