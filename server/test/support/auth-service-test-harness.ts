import type { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'

import { AuthTestStore } from './auth-test-store'
import type { AuditService } from '../../src/modules/audit/audit.service'
import type { AppEnvironment } from '../../src/modules/config/env.schema'
import { AuthService } from '../../src/modules/auth/auth.service'
import { RefreshTokenRepository } from '../../src/modules/auth/repositories/refresh-token.repository'
import { AccessTokenService } from '../../src/modules/auth/services/access-token.service'
import { AuthAuditService } from '../../src/modules/auth/services/auth-audit.service'
import { AuthUserService } from '../../src/modules/auth/services/auth-user.service'
import { PasswordHasherService } from '../../src/modules/auth/services/password-hasher.service'
import { RefreshTokenService } from '../../src/modules/auth/services/refresh-token.service'

const authConfig = {
  AUTH_ACCESS_TOKEN_SECRET:
    'test-access-token-secret-with-at-least-32-characters',
  AUTH_REFRESH_TOKEN_HASH_SECRET:
    'test-refresh-token-hash-secret-with-at-least-32-characters',
  AUTH_ACCESS_TOKEN_TTL_SECONDS: 900,
  AUTH_REFRESH_TOKEN_TTL_DAYS: 7,
} satisfies Partial<AppEnvironment>

export function buildAuthServiceTestHarness() {
  const store = new AuthTestStore()
  const auditService = {
    recordEvent: jest.fn().mockResolvedValue(undefined),
  } as unknown as AuditService
  const configService = {
    get: jest.fn((key: keyof typeof authConfig) => authConfig[key]),
  } as unknown as ConfigService<AppEnvironment, true>
  const authUserService = new AuthUserService(store.prisma)
  const refreshTokenRepository = new RefreshTokenRepository(store.prisma)
  const accessTokenService = new AccessTokenService(
    new JwtService(),
    configService,
  )
  const refreshTokenService = new RefreshTokenService(
    configService,
    refreshTokenRepository,
    authUserService,
  )
  const authAuditService = new AuthAuditService(auditService)
  const service = new AuthService(
    new PasswordHasherService(),
    accessTokenService,
    refreshTokenService,
    authUserService,
    authAuditService,
  )

  return {
    auditService,
    service,
    store,
  }
}
