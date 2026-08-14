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
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe'
import {
  signInRequestSchema,
  IdentitySessionResponseDto,
  MeResponseDto,
  SignInRequestDto,
  type SignInRequest,
} from './identity.types'
import type { AuthenticatedHttpRequest } from './identity.guard'
import { IdentityService } from './identity.service'
import { invalidAuthRequestException } from './identity.errors'
import { Public } from './identity.public'
import {
  clearRefreshTokenCookie,
  getRefreshToken,
  setRefreshTokenCookie,
} from './refresh-session-cookie'

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

@ApiTags('identity')
@Controller()
export class IdentityController {
  constructor(private readonly identityService: IdentityService) {}

  @Public()
  @Post('auth/sign-in')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sign in' })
  @ApiBody({ type: SignInRequestDto })
  @ApiOkResponse({
    type: IdentitySessionResponseDto,
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
    const session = await this.identityService.signIn(
      body,
      getRequestContext(request),
    )

    setRefreshTokenCookie(
      response,
      session.refreshToken,
      session.refreshTokenExpiresAt,
    )

    return session.response
  }

  @Public()
  @Post('auth/refresh')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Refresh authentication session',
    description: 'Rotates the morshid_refresh HttpOnly cookie session.',
  })
  @ApiSecurity('refresh-session')
  @ApiOkResponse({
    type: IdentitySessionResponseDto,
    headers: refreshCookieSetResponseHeader,
    description: 'A rotated access and refresh session.',
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
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.identityService.refresh(
      { refreshToken: getRefreshToken(request) },
      getRequestContext(request),
    )

    setRefreshTokenCookie(
      response,
      session.refreshToken,
      session.refreshTokenExpiresAt,
    )

    return session.response
  }

  @Public()
  @Post('auth/logout')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Log out',
    description: 'Revokes the morshid_refresh HttpOnly cookie session.',
  })
  @ApiSecurity('refresh-session')
  @ApiNoContentResponse({
    headers: refreshCookieClearResponseHeader,
    description: 'The refresh session is revoked and its cookie is cleared.',
  })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    let refreshToken: string | null = null

    try {
      refreshToken = getRefreshToken(request)
    } catch {
      // Logout remains idempotent when the browser has no refresh session.
    }

    if (refreshToken !== null) {
      await this.identityService.logout(
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
    description: 'The authenticated user.',
  })
  me(@Req() request: AuthenticatedHttpRequest) {
    return this.identityService.getMe(request.user.id)
  }
}
