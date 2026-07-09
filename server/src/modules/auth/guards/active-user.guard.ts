import type { Request } from 'express'
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'

import type { AppEnvironment } from '../../../modules/config/env.schema'
import { RedisService } from '../../../modules/redis/redis.service'
import { AUTH_ERROR_CODES } from '../auth.dto'

@Injectable()
export class ActiveUserGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AppEnvironment, true>,
    private readonly redisService: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>()
    const accessToken = extractBearerToken(request.headers.authorization)

    if (accessToken === null) {
      throw invalidAccessTokenException()
    }

    const payload = await this.verifyAccessToken(accessToken)

    const isDisabled = await this.redisService.isUserDisabled(payload.sub)
    if (isDisabled) {
      throw accountDisabledException()
    }

    return true
  }

  private async verifyAccessToken(
    token: string,
  ): Promise<VerifiedAccessTokenPayload> {
    try {
      const payload =
        await this.jwtService.verifyAsync<UntrustedAccessTokenPayload>(token, {
          secret: this.configService.get('AUTH_ACCESS_TOKEN_SECRET', {
            infer: true,
          }),
        })

      if (payload.typ !== 'access' || typeof payload.sub !== 'string') {
        throw invalidAccessTokenException()
      }

      return {
        sub: payload.sub,
        typ: 'access',
      }
    } catch {
      throw invalidAccessTokenException()
    }
  }
}

interface VerifiedAccessTokenPayload {
  sub: string
  typ: 'access'
}

interface UntrustedAccessTokenPayload {
  sub?: unknown
  typ?: unknown
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

function invalidAccessTokenException() {
  return new UnauthorizedException({
    code: AUTH_ERROR_CODES.INVALID_ACCESS_TOKEN,
    message: 'Invalid access token',
  })
}

function accountDisabledException() {
  return new ForbiddenException({
    code: AUTH_ERROR_CODES.ACCOUNT_DISABLED,
    message: 'Account is disabled',
  })
}
