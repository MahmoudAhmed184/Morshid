import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import type { Request } from 'express'

import type { AuthenticatedRequestUser } from './auth.dto'
import { invalidAccessTokenException } from './auth.errors'
import { AuthService } from './auth.service'

export interface AuthenticatedHttpRequest extends Request {
  user: AuthenticatedRequestUser
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedHttpRequest>()
    const accessToken = extractBearerToken(request.headers.authorization)

    if (accessToken === null) {
      throw invalidAccessTokenException()
    }

    request.user = await this.authService.authenticateAccessToken(accessToken, {
      ip: request.ip ?? null,
      userAgent: request.get('user-agent') ?? null,
    })

    return true
  }
}

function extractBearerToken(authorization: string | string[] | undefined) {
  if (typeof authorization !== 'string') {
    return null
  }

  const parts = authorization.split(' ')

  if (parts.length !== 2) {
    return null
  }

  const [scheme, token] = parts as [string, string]

  if (scheme !== 'Bearer' || token.length === 0) {
    return null
  }

  return token
}
