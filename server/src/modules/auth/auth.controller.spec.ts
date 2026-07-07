import { Test } from '@nestjs/testing'
import type { Request, Response } from 'express'

import { AUTH_REFRESH_COOKIE_NAME } from './auth.constants'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'

jest.mock('./auth.service', () => ({
  AuthService: jest.fn(),
}))

describe('AuthController', () => {
  it('sets the refresh cookie and returns the public login response', async () => {
    const authService = {
      login: jest.fn().mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        refreshTokenExpiresAt: new Date('2026-07-21T00:00:00.000Z'),
        user: {
          id: '00000000-0000-0000-0000-000000000001',
          email: 'admin@morshid.demo',
          displayName: 'P0 Demo Admin',
          role: 'ADMIN',
        },
      }),
    }
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    }).compile()
    const controller = moduleRef.get(AuthController)
    const request = {
      ip: '203.0.113.10',
      get: jest.fn().mockReturnValue('Mozilla/5.0'),
    } as unknown as Request
    const response = {
      cookie: jest.fn(),
    } as unknown as Response

    await expect(
      controller.login(
        {
          email: 'admin@morshid.demo',
          password: 'MorshidDemoP0!',
        },
        request,
        response,
      ),
    ).resolves.toEqual({
      accessToken: 'access-token',
      user: {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'admin@morshid.demo',
        displayName: 'P0 Demo Admin',
        role: 'ADMIN',
      },
    })
    expect(authService.login).toHaveBeenCalledWith(
      {
        email: 'admin@morshid.demo',
        password: 'MorshidDemoP0!',
      },
      {
        ip: '203.0.113.10',
        userAgent: 'Mozilla/5.0',
      },
    )
    expect(response.cookie).toHaveBeenCalledWith(
      AUTH_REFRESH_COOKIE_NAME,
      'refresh-token',
      {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        expires: new Date('2026-07-21T00:00:00.000Z'),
      },
    )
  })

  it('refreshes tokens from the refresh cookie', async () => {
    const authService = {
      refreshSession: jest.fn().mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        refreshTokenExpiresAt: new Date('2026-07-21T00:00:00.000Z'),
        user: {
          id: '00000000-0000-0000-0000-000000000001',
          email: 'admin@morshid.demo',
          displayName: 'P0 Demo Admin',
          role: 'ADMIN',
        },
      }),
    }
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    }).compile()
    const controller = moduleRef.get(AuthController)
    const request = {
      cookies: {
        [AUTH_REFRESH_COOKIE_NAME]: 'old-refresh-token',
      },
      ip: '203.0.113.10',
      get: jest.fn().mockReturnValue('Mozilla/5.0'),
    } as unknown as Request
    const response = {
      cookie: jest.fn(),
    } as unknown as Response

    await expect(controller.refresh(request, response)).resolves.toEqual({
      accessToken: 'new-access-token',
      user: {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'admin@morshid.demo',
        displayName: 'P0 Demo Admin',
        role: 'ADMIN',
      },
    })
    expect(authService.refreshSession).toHaveBeenCalledWith(
      'old-refresh-token',
      {
        ip: '203.0.113.10',
        userAgent: 'Mozilla/5.0',
      },
    )
    expect(response.cookie).toHaveBeenCalledWith(
      AUTH_REFRESH_COOKIE_NAME,
      'new-refresh-token',
      {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        expires: new Date('2026-07-21T00:00:00.000Z'),
      },
    )
  })

  it('logs out from the refresh cookie and clears it', async () => {
    const authService = {
      logoutSession: jest.fn().mockResolvedValue(undefined),
    }
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    }).compile()
    const controller = moduleRef.get(AuthController)
    const request = {
      cookies: {
        [AUTH_REFRESH_COOKIE_NAME]: 'refresh-token',
      },
      ip: '203.0.113.10',
      get: jest.fn().mockReturnValue('Mozilla/5.0'),
    } as unknown as Request
    const response = {
      clearCookie: jest.fn(),
    } as unknown as Response

    await expect(controller.logout(request, response)).resolves.toEqual({
      message: 'Logged out successfully',
    })
    expect(authService.logoutSession).toHaveBeenCalledWith('refresh-token', {
      ip: '203.0.113.10',
      userAgent: 'Mozilla/5.0',
    })
    expect(response.clearCookie).toHaveBeenCalledWith(
      AUTH_REFRESH_COOKIE_NAME,
      {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
      },
    )
  })
})
