import { ForbiddenException } from '@nestjs/common'
import type { ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'

import { buildIdentityServiceTestHarness } from '../../../test/support/identity-service-test-harness'
import { P0_DEMO_PASSWORD } from '../../seeds/p0-demo.seed'
import { IdentityGuard } from './identity.guard'
import type { AuthenticatedUser } from './identity.types'

function buildGuard() {
  const harness = buildIdentityServiceTestHarness()

  return {
    ...harness,
    guard: new IdentityGuard(harness.service, new Reflector()),
  }
}

interface GuardTestRequest {
  headers: {
    authorization: string
  }
  ip: string
  get: (headerName: string) => string | undefined
  user?: AuthenticatedUser
}

function createExecutionContext(
  authorization: string,
  requestRef?: { request?: GuardTestRequest },
): ExecutionContext {
  const handler = () => undefined
  const request: GuardTestRequest = {
    headers: {
      authorization,
    },
    ip: '203.0.113.10',
    get: (headerName: string) =>
      headerName.toLowerCase() === 'user-agent' ? 'Jest' : undefined,
  }
  if (requestRef) {
    requestRef.request = request
  }
  return {
    getHandler: () => handler,
    getClass: () => Object,
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext
}

describe('IdentityGuard', () => {
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
        createExecutionContext(`Bearer ${session.response.accessToken}`),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('blocks an access token after the university becomes suspended', async () => {
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

    const student = store.findUserByEmail('student1@morshid.demo')
    if (student?.universityId === null || student?.universityId === undefined) {
      throw new Error('Missing student university')
    }

    store.setUniversityStatus(student.universityId, 'SUSPENDED')

    const activate = guard.canActivate(
      createExecutionContext(`Bearer ${session.response.accessToken}`),
    )

    await expect(activate).rejects.toBeInstanceOf(ForbiddenException)
    await expect(activate).rejects.toMatchObject({
      response: {
        code: 'UNIVERSITY_SUSPENDED',
      },
    })
  })

  it('blocks an access token after the university becomes inactive', async () => {
    const { guard, service, store } = buildGuard()
    const session = await service.signIn(
      {
        email: 'instructor@morshid.demo',
        password: P0_DEMO_PASSWORD,
      },
      {
        ip: '203.0.113.10',
        userAgent: 'Jest',
      },
    )

    const instructor = store.findUserByEmail('instructor@morshid.demo')
    if (
      instructor?.universityId === null ||
      instructor?.universityId === undefined
    ) {
      throw new Error('Missing instructor university')
    }

    store.setUniversityStatus(instructor.universityId, 'INACTIVE')

    const activate = guard.canActivate(
      createExecutionContext(`Bearer ${session.response.accessToken}`),
    )

    await expect(activate).rejects.toBeInstanceOf(ForbiddenException)
    await expect(activate).rejects.toMatchObject({
      response: {
        code: 'UNIVERSITY_INACTIVE',
      },
    })
  })

  it('allows SUPER_ADMIN with universityId = null to authenticate successfully', async () => {
    const { guard, service } = buildGuard()
    const session = await service.signIn(
      {
        email: 'superadmin@morshid.demo',
        password: P0_DEMO_PASSWORD,
      },
      {
        ip: '203.0.113.10',
        userAgent: 'Jest',
      },
    )

    const requestRef: {
      request?: GuardTestRequest
    } = {}
    const result = await guard.canActivate(
      createExecutionContext(
        `Bearer ${session.response.accessToken}`,
        requestRef,
      ),
    )

    expect(result).toBe(true)
    expect(requestRef.request?.user).toBeDefined()
    expect(requestRef.request?.user?.role).toBe('SUPER_ADMIN')
    expect(requestRef.request?.user?.universityId).toBeNull()
  })
})
