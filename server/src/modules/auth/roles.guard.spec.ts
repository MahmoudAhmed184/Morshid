import { ForbiddenException } from '@nestjs/common'
import type { ExecutionContext, Type } from '@nestjs/common'
import { Reflector } from '@nestjs/core'

import type { UserRole } from '../../generated/prisma/client'
import type { AccessAuditService } from '../audit/access-audit.service'
import { AUTH_ERROR_CODES, type AuthenticatedRequestUser } from './auth.dto'
import { Roles, ROLES_KEY } from './roles.decorator'
import { RolesGuard } from './roles.guard'

class TestController {
  open() {
    return undefined
  }

  @Roles('ADMIN')
  adminOnly() {
    return undefined
  }
}

@Roles('INSTRUCTOR')
class InstructorController {
  index() {
    return undefined
  }
}

const baseUser: AuthenticatedRequestUser = {
  id: 'user-1',
  email: 'user@morshid.demo',
  displayName: 'Test User',
  role: 'STUDENT',
  status: 'ACTIVE',
}

function buildUser(role: UserRole): AuthenticatedRequestUser {
  return {
    ...baseUser,
    role,
  }
}

function getControllerHandler(
  controller: object,
  propertyName: string,
): () => unknown {
  const descriptor = Object.getOwnPropertyDescriptor(controller, propertyName)
  const value = descriptor?.value as unknown

  if (typeof value !== 'function') {
    throw new Error(`Missing handler ${propertyName}`)
  }

  return value as () => unknown
}

function createExecutionContext({
  handler,
  controller = TestController,
  user,
  method = 'GET',
  path = '/test',
}: {
  handler: () => unknown
  controller?: Type<unknown>
  user?: AuthenticatedRequestUser
  method?: string
  path?: string
}): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => controller,
    switchToHttp: () => ({
      getRequest: () => ({
        user,
        method,
        path,
        route: {
          path,
        },
        ip: '203.0.113.10',
        get: (headerName: string) =>
          headerName.toLowerCase() === 'user-agent' ? 'Jest' : undefined,
      }),
    }),
  } as unknown as ExecutionContext
}

const recordRbacDenied = jest.fn().mockResolvedValue(undefined)

function buildAccessAuditServiceMock(): AccessAuditService {
  return {
    recordRbacDenied,
  } as unknown as AccessAuditService
}

describe('RolesGuard', () => {
  const reflector = new Reflector()
  const accessAuditService = buildAccessAuditServiceMock()
  const guard = new RolesGuard(reflector, accessAuditService)

  beforeEach(() => {
    jest.clearAllMocks()
  })
  const openHandler = getControllerHandler(TestController.prototype, 'open')
  const adminOnlyHandler = getControllerHandler(
    TestController.prototype,
    'adminOnly',
  )
  const instructorIndexHandler = getControllerHandler(
    InstructorController.prototype,
    'index',
  )

  it('stores allowed roles with the local decorator', () => {
    expect(reflector.get<UserRole[]>(ROLES_KEY, adminOnlyHandler)).toEqual([
      'ADMIN',
    ])
  })

  it('allows a request when the user has an allowed role', async () => {
    await expect(
      guard.canActivate(
        createExecutionContext({
          handler: adminOnlyHandler,
          user: buildUser('ADMIN'),
        }),
      ),
    ).resolves.toBe(true)
  })

  it('rejects a request when the user does not have a required role', async () => {
    await expect(
      guard.canActivate(
        createExecutionContext({
          handler: adminOnlyHandler,
          user: buildUser('STUDENT'),
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException)
    expect(recordRbacDenied).toHaveBeenCalledWith({
      actor: {
        id: 'user-1',
        role: 'STUDENT',
      },
      allowedRoles: ['ADMIN'],
      route: {
        method: 'GET',
        path: '/test',
      },
      requestContext: {
        ip: '203.0.113.10',
        userAgent: 'Jest',
      },
    })
  })

  it('rejects a request when role metadata exists but the user is missing', async () => {
    try {
      await guard.canActivate(
        createExecutionContext({
          handler: adminOnlyHandler,
        }),
      )
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException)
      expect((error as ForbiddenException).getResponse()).toEqual({
        code: AUTH_ERROR_CODES.INSUFFICIENT_ROLE,
        message: 'Insufficient role',
      })
      return
    }

    throw new Error('Expected RolesGuard to reject the request')
  })

  it('rejects a request when the user exists but role is missing', async () => {
    const userWithoutRole = {
      id: 'user-1',
      email: 'user@morshid.demo',
      displayName: 'Test User',
      status: 'ACTIVE',
    } as unknown as AuthenticatedRequestUser

    try {
      await guard.canActivate(
        createExecutionContext({
          handler: adminOnlyHandler,
          user: userWithoutRole,
        }),
      )
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException)
      expect((error as ForbiddenException).getResponse()).toEqual({
        code: AUTH_ERROR_CODES.INSUFFICIENT_ROLE,
        message: 'Insufficient role',
      })
      return
    }

    throw new Error('Expected RolesGuard to reject the request')
  })

  it('allows public routes when no role metadata is present', async () => {
    await expect(
      guard.canActivate(
        createExecutionContext({
          handler: openHandler,
        }),
      ),
    ).resolves.toBe(true)
  })

  it('supports role metadata declared on a controller class', async () => {
    await expect(
      guard.canActivate(
        createExecutionContext({
          controller: InstructorController,
          handler: instructorIndexHandler,
          user: buildUser('INSTRUCTOR'),
        }),
      ),
    ).resolves.toBe(true)
  })
})
