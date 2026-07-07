import { UnauthorizedException } from '@nestjs/common'
import type { ExecutionContext } from '@nestjs/common'
import type { Request } from 'express'

import { AUTH_TOKEN_TYPES } from '../auth.constants'
import { JwtAccessGuard } from './jwt-access.guard'

jest.mock('../auth.service', () => ({
  AuthService: jest.fn(),
}))

describe('JwtAccessGuard', () => {
  it('validates a bearer access token and attaches the user to the request', async () => {
    const request = buildRequest({
      authorization: 'Bearer access-token',
    })
    const authService = {
      validateAccessTokenPayload: jest.fn().mockResolvedValue({
        id: '00000000-0000-0000-0000-000000000001',
        email: 'admin@morshid.demo',
        displayName: 'P0 Demo Admin',
        role: 'ADMIN',
        status: 'ACTIVE',
      }),
    }
    const configService = {
      get: jest.fn().mockReturnValue('access-secret-at-least-32-characters'),
    }
    const jwtService = {
      verifyAsync: jest.fn().mockResolvedValue({
        sub: '00000000-0000-0000-0000-000000000001',
        email: 'admin@morshid.demo',
        role: 'ADMIN',
        tokenType: AUTH_TOKEN_TYPES.ACCESS,
        iat: 1_783_401_600,
      }),
    }
    const guard = new JwtAccessGuard(
      authService as never,
      configService as never,
      jwtService as never,
    )

    await expect(guard.canActivate(buildContext(request))).resolves.toBe(true)

    expect(jwtService.verifyAsync).toHaveBeenCalledWith('access-token', {
      secret: 'access-secret-at-least-32-characters',
    })
    expect(authService.validateAccessTokenPayload).toHaveBeenCalledWith(
      {
        sub: '00000000-0000-0000-0000-000000000001',
        email: 'admin@morshid.demo',
        role: 'ADMIN',
        tokenType: AUTH_TOKEN_TYPES.ACCESS,
        iat: 1_783_401_600,
      },
      {
        ip: '203.0.113.10',
        userAgent: 'Mozilla/5.0',
      },
    )
    expect(request.user).toEqual({
      id: '00000000-0000-0000-0000-000000000001',
      email: 'admin@morshid.demo',
      displayName: 'P0 Demo Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
    })
  })

  it('rejects requests without a bearer token', async () => {
    const guard = new JwtAccessGuard(
      {
        validateAccessTokenPayload: jest.fn(),
      } as never,
      {
        get: jest.fn(),
      } as never,
      {
        verifyAsync: jest.fn(),
      } as never,
    )

    await expect(
      guard.canActivate(buildContext(buildRequest())),
    ).rejects.toBeInstanceOf(UnauthorizedException)
  })
})

function buildRequest(headers: Record<string, string> = {}) {
  return {
    headers,
    ip: '203.0.113.10',
    get: jest.fn().mockReturnValue('Mozilla/5.0'),
  } as unknown as Request & {
    user?: unknown
  }
}

function buildContext(request: Request): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext
}
