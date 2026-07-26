import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'
import type { Request, Response } from 'express'

import { ApiAccessTokenAuth } from '../../common/http/openapi.decorators'
import { OpenApiErrorDto } from '../../common/http/openapi-error.dto'
import { getRequestContext } from '../../common/http/request-context'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import {
  logoutRequestSchema,
  refreshRequestSchema,
  signInRequestSchema,
  AuthSessionResponseDto,
  MeResponseDto,
  RefreshRequestDto,
  SignInRequestDto,
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

const refreshCookieSetResponseHeader = {
  'Set-Cookie': {
    description:
      'Sets the HttpOnly morshid_refresh cookie scoped to /api/v1/auth.',
    schema: {
      type: 'string',
      example:
        'morshid_refresh=<token>; Path=/api/v1/auth; HttpOnly; SameSite=Lax',
    },
  },
}

const refreshCookieClearResponseHeader = {
  'Set-Cookie': {
    description:
      'Clears the HttpOnly morshid_refresh cookie scoped to /api/v1/auth.',
    schema: {
      type: 'string',
      example:
        'morshid_refresh=; Path=/api/v1/auth; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax',
    },
  },
}

@ApiTags('auth')
@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('auth/sign-in')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sign in' })
  @ApiBody({ type: SignInRequestDto })
  @ApiOkResponse({
    type: AuthSessionResponseDto,
    headers: refreshCookieSetResponseHeader,
    description: 'A new access and refresh session.',
  })
  @ApiBadRequestResponse({
    type: OpenApiErrorDto,
    description: 'The sign-in body is invalid.',
  })
  @ApiUnauthorizedResponse({
    type: OpenApiErrorDto,
    description: 'The email or password is invalid.',
  })
  @ApiForbiddenResponse({
    type: OpenApiErrorDto,
    description: 'The account is disabled.',
  })
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
  @ApiOperation({
    summary: 'Refresh authentication session',
    description:
      'Uses the morshid_refresh cookie when present, with refreshToken in JSON as a fallback.',
  })
  @ApiSecurity('refresh-session')
  @ApiSecurity({})
  @ApiBody({ type: RefreshRequestDto })
  @ApiOkResponse({
    type: AuthSessionResponseDto,
    headers: refreshCookieSetResponseHeader,
    description: 'A rotated access and refresh session.',
  })
  @ApiBadRequestResponse({
    type: OpenApiErrorDto,
    description: 'The refresh body is invalid.',
  })
  @ApiUnauthorizedResponse({
    type: OpenApiErrorDto,
    description: 'The refresh token is missing, malformed, or invalid.',
  })
  @ApiForbiddenResponse({
    type: OpenApiErrorDto,
    description: 'The account is disabled.',
  })
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
  @ApiOperation({
    summary: 'Log out',
    description:
      'Revokes the refresh session from the morshid_refresh cookie or optional refreshToken JSON fallback.',
  })
  @ApiSecurity('refresh-session')
  @ApiSecurity({})
  @ApiBody({ type: RefreshRequestDto })
  @ApiNoContentResponse({
    headers: refreshCookieClearResponseHeader,
    description: 'The refresh session is revoked and its cookie is cleared.',
  })
  @ApiBadRequestResponse({
    type: OpenApiErrorDto,
    description: 'The logout body is invalid.',
  })
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
  @ApiOperation({ summary: 'Get current user' })
  @ApiAccessTokenAuth()
  @ApiOkResponse({
    type: MeResponseDto,
    description: 'The authenticated user and their visible courses.',
  })
  me(@Req() request: AuthenticatedHttpRequest) {
    return this.authService.getMe(request.user.id)
  }
}
