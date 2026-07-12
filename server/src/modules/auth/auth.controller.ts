import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import type { Request, Response } from 'express'

import { getRequestContext } from '../../common/http/request-context'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import {
  logoutRequestSchema,
  refreshRequestSchema,
  signInRequestSchema,
  type RefreshHttpRequest,
  type SignInRequest,
} from './auth.dto'
import type { AuthenticatedHttpRequest } from './auth.guard'
import { AuthService } from './auth.service'
import { invalidAuthRequestException } from './auth.errors'
import { Public } from './public.decorator'
import {
  clearRefreshTokenCookie,
  getRefreshToken,
  setRefreshTokenCookie,
} from './refresh-token-cookie'

@ApiTags('auth')
@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('auth/sign-in')
  @HttpCode(200)
  async signIn(
    @Body(
      new ZodValidationPipe(signInRequestSchema, invalidAuthRequestException),
    )
    body: SignInRequest,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.authService.signIn(
      body,
      getRequestContext(request),
    )

    setRefreshTokenCookie(
      response,
      session.refreshToken,
      session.refreshTokenExpiresAt,
    )

    return session
  }

  @Public()
  @Post('auth/refresh')
  @HttpCode(200)
  async refresh(
    @Body(
      new ZodValidationPipe(refreshRequestSchema, invalidAuthRequestException),
    )
    body: RefreshHttpRequest,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.authService.refresh(
      { refreshToken: getRefreshToken(request, body.refreshToken) },
      getRequestContext(request),
    )

    setRefreshTokenCookie(
      response,
      session.refreshToken,
      session.refreshTokenExpiresAt,
    )

    return session
  }

  @Public()
  @Post('auth/logout')
  @HttpCode(204)
  async logout(
    @Body(
      new ZodValidationPipe(logoutRequestSchema, invalidAuthRequestException),
    )
    body: RefreshHttpRequest,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    let refreshToken: string | null = null

    try {
      refreshToken = getRefreshToken(request, body.refreshToken)
    } catch {
      // Logout remains idempotent when the browser has no refresh session.
    }

    if (refreshToken !== null) {
      await this.authService.logout(
        { refreshToken },
        getRequestContext(request),
      )
    }

    clearRefreshTokenCookie(response)
  }

  @Get('me')
  @ApiBearerAuth()
  me(@Req() request: AuthenticatedHttpRequest) {
    return this.authService.getMe(request.user.id)
  }
}
