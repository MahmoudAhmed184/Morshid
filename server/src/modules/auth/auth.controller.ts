import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common'
import type { Request, Response } from 'express'

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { AUTH_REFRESH_COOKIE_NAME } from './auth.constants'
import { AuthService } from './auth.service'
import type { LoginResult } from './auth.service'
import type { AuthResponseDto } from './dto/auth-response.dto'
import { loginSchema, type LoginDto } from './dto/login.dto'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.authService.login(dto, {
      ip: request.ip ?? null,
      userAgent: request.get('user-agent') ?? null,
    })

    setRefreshTokenCookie(response, result)

    return {
      accessToken: result.accessToken,
      user: result.user,
    }
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.authService.refreshSession(
      getRefreshTokenCookie(request),
      {
        ip: request.ip ?? null,
        userAgent: request.get('user-agent') ?? null,
      },
    )

    setRefreshTokenCookie(response, result)

    return {
      accessToken: result.accessToken,
      user: result.user,
    }
  }
}

type RequestWithCookies = Request & {
  cookies?: Partial<Record<string, string>>
}

function getRefreshTokenCookie(request: Request): string | undefined {
  return (request as RequestWithCookies).cookies?.[AUTH_REFRESH_COOKIE_NAME]
}

function setRefreshTokenCookie(response: Response, result: LoginResult): void {
  response.cookie(AUTH_REFRESH_COOKIE_NAME, result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: result.refreshTokenExpiresAt,
  })
}
