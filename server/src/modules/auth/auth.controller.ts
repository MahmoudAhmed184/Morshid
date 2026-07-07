import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common'
import type { Request, Response } from 'express'

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { AUTH_REFRESH_COOKIE_NAME } from './auth.constants'
import { CurrentUser } from './decorators/current-user.decorator'
import { AuthService } from './auth.service'
import type { AuthenticatedUser, LoginResult } from './auth.service'
import type { AuthProfileDto, AuthResponseDto } from './dto/auth-response.dto'
import { loginSchema, type LoginDto } from './dto/login.dto'
import { JwtAccessGuard } from './guards/jwt-access.guard'

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

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ message: string }> {
    await this.authService.logoutSession(getRefreshTokenCookie(request), {
      ip: request.ip ?? null,
      userAgent: request.get('user-agent') ?? null,
    })

    response.clearCookie(AUTH_REFRESH_COOKIE_NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    })

    return {
      message: 'Logged out successfully',
    }
  }

  @Get('me')
  @UseGuards(JwtAccessGuard)
  async me(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<AuthProfileDto> {
    return this.authService.getMe(user.id, {
      ip: request.ip ?? null,
      userAgent: request.get('user-agent') ?? null,
    })
  }
}

function getRefreshTokenCookie(request: Request): string | undefined {
  const cookies = request.cookies as Record<string, unknown> | undefined
  const token = cookies?.[AUTH_REFRESH_COOKIE_NAME]
  return typeof token === 'string' ? token : undefined
}

function setRefreshTokenCookie(response: Response, result: LoginResult): void {
  response.cookie(AUTH_REFRESH_COOKIE_NAME, result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: result.refreshTokenExpiresAt,
  })
}
