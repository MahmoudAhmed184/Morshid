import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import type { Request } from 'express'

import { getRequestContext } from '../../common/http/request-context'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import {
  logoutRequestSchema,
  refreshRequestSchema,
  signInRequestSchema,
  type LogoutRequest,
  type RefreshRequest,
  type SignInRequest,
} from './auth.dto'
import type { AuthenticatedHttpRequest } from './auth.guard'
import { AuthService } from './auth.service'
import { invalidAuthRequestException } from './auth.errors'
import { Public } from './public.decorator'

@ApiTags('auth')
@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('auth/sign-in')
  @HttpCode(200)
  signIn(
    @Body(
      new ZodValidationPipe(signInRequestSchema, invalidAuthRequestException),
    )
    body: SignInRequest,
    @Req() request: Request,
  ) {
    return this.authService.signIn(body, getRequestContext(request))
  }

  @Public()
  @Post('auth/refresh')
  @HttpCode(200)
  refresh(
    @Body(
      new ZodValidationPipe(refreshRequestSchema, invalidAuthRequestException),
    )
    body: RefreshRequest,
    @Req() request: Request,
  ) {
    return this.authService.refresh(body, getRequestContext(request))
  }

  @Public()
  @Post('auth/logout')
  @HttpCode(204)
  async logout(
    @Body(
      new ZodValidationPipe(logoutRequestSchema, invalidAuthRequestException),
    )
    body: LogoutRequest,
    @Req() request: Request,
  ) {
    await this.authService.logout(body, getRequestContext(request))
  }

  @Get('me')
  @ApiBearerAuth()
  me(@Req() request: AuthenticatedHttpRequest) {
    return this.authService.getMe(request.user.id)
  }
}
