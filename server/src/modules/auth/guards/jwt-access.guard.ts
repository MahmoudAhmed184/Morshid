import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import type { Request } from 'express'

import type { AppEnvironment } from '../../config/env.schema'
import { AuthService } from '../auth.service'
import type { AccessTokenPayload, AuthenticatedUser } from '../auth.service'

export type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser
}

@Injectable()
export class JwtAccessGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService<AppEnvironment, true>,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const token = this.getBearerToken(request)

    if (token === undefined) {
      throw new UnauthorizedException('Missing access token')
    }

    try {
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(
        token,
        {
          secret: this.configService.get('JWT_ACCESS_SECRET', { infer: true }),
        },
      )

      request.user = await this.authService.validateAccessTokenPayload(
        payload,
        {
          ip: request.ip ?? null,
          userAgent: request.get('user-agent') ?? null,
        },
      )
    } catch {
      throw new UnauthorizedException('Invalid access token')
    }

    return true
  }

  private getBearerToken(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? []

    return type === 'Bearer' ? token : undefined
  }
}
