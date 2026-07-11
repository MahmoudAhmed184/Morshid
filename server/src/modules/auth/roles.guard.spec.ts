import { ForbiddenException } from '@nestjs/common'
import type { ExecutionContext, Type } from '@nestjs/common'
import { Reflector } from '@nestjs/core'

import type { UserRole } from '../../generated/prisma/client'
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
}: {
  handler: () => unknown
  controller?: Type<unknown>
  user?: AuthenticatedRequestUser
}): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => controller,
    switchToHttp: () => ({
      getRequest: () => ({
        user,
      }),
    }),
  } as unknown as ExecutionContext
}

describe('RolesGuard', () => {
  const reflector = new Reflector()
  const guard = new RolesGuard(reflector)
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

  it('allows a request when the user has an allowed role', () => {
    expect(
      guard.canActivate(
        createExecutionContext({
          handler: adminOnlyHandler,
          user: buildUser('ADMIN'),
        }),
      ),
    ).toBe(true)
  })

  it('rejects a request when the user does not have a required role', () => {
    expect(() =>
      guard.canActivate(
        createExecutionContext({
          handler: adminOnlyHandler,
          user: buildUser('STUDENT'),
        }),
      ),
    ).toThrow(ForbiddenException)
  })

  it('rejects a request when role metadata exists but the user is missing', () => {
    try {
      guard.canActivate(
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

  it('rejects a request when the user exists but role is missing', () => {
    const userWithoutRole = {
      id: 'user-1',
      email: 'user@morshid.demo',
      displayName: 'Test User',
      status: 'ACTIVE',
    } as unknown as AuthenticatedRequestUser

    try {
      guard.canActivate(
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

  it('allows public routes when no role metadata is present', () => {
    expect(
      guard.canActivate(
        createExecutionContext({
          handler: openHandler,
        }),
      ),
    ).toBe(true)
  })

  it('supports role metadata declared on a controller class', () => {
    expect(
      guard.canActivate(
        createExecutionContext({
          controller: InstructorController,
          handler: instructorIndexHandler,
          user: buildUser('INSTRUCTOR'),
        }),
      ),
    ).toBe(true)
  })
})
