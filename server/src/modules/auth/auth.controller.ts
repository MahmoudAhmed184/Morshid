import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import type { Request } from 'express'

import {
  logoutRequestSchema,
  refreshRequestSchema,
  signInRequestSchema,
  type LogoutRequest,
  type RefreshRequest,
  type SignInRequest,
} from './auth.dto'
import { AuthGuard, type AuthenticatedHttpRequest } from './auth.guard'
import { AuthService } from './auth.service'
import { ZodValidationPipe } from './pipes/zod-validation.pipe'

@ApiTags('auth')
@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('auth/sign-in')
  @HttpCode(200)
  signIn(
    @Body(new ZodValidationPipe(signInRequestSchema)) body: SignInRequest,
    @Req() request: Request,
  ) {
    return this.authService.signIn(body, getRequestContext(request))
  }

  @Post('auth/refresh')
  @HttpCode(200)
  refresh(
    @Body(new ZodValidationPipe(refreshRequestSchema)) body: RefreshRequest,
    @Req() request: Request,
  ) {
    return this.authService.refresh(body, getRequestContext(request))
  }

  @Post('auth/logout')
  @HttpCode(204)
  async logout(
    @Body(new ZodValidationPipe(logoutRequestSchema)) body: LogoutRequest,
    @Req() request: Request,
  ) {
    await this.authService.logout(body, getRequestContext(request))
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  me(@Req() request: AuthenticatedHttpRequest) {
    return this.authService.getMe(request.user.id)
  }
}

export function getRequestContext(request: Request) {
  return {
    ip: request.ip ?? null,
    userAgent: request.get('user-agent') ?? null,
  }
}
