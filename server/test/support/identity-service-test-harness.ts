import type { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'

import { IdentityTestStore } from './identity-test-store'
import { AuditService } from '../../src/modules/audit/audit.service'
import type { AppEnvironment } from '../../src/modules/config/env.schema'
import { IdentityService } from '../../src/modules/identity/identity.service'
import { RefreshSessionRepository } from '../../src/modules/identity/refresh-session.repository'
import { AccessToken } from '../../src/modules/identity/access-token'
import { IdentityAudit } from '../../src/modules/identity/identity-audit'
import { IdentityUser } from '../../src/modules/identity/identity-user'
import { PasswordHasher } from '../../src/modules/identity/password-hasher'
import { RefreshSession } from '../../src/modules/identity/refresh-session'

const authConfig = {
  AUTH_ACCESS_TOKEN_SECRET:
    'test-access-token-secret-with-at-least-32-characters',
  AUTH_REFRESH_TOKEN_HASH_SECRET:
    'test-refresh-token-hash-secret-with-at-least-32-characters',
  AUTH_ACCESS_TOKEN_TTL_SECONDS: 900,
  AUTH_REFRESH_TOKEN_TTL_DAYS: 7,
} satisfies Partial<AppEnvironment>

export function buildIdentityServiceTestHarness() {
  const store = new IdentityTestStore()
  const auditService = new AuditService(store.prisma)
  const configService = {
    get: jest.fn((key: keyof typeof authConfig) => authConfig[key]),
  } as unknown as ConfigService<AppEnvironment, true>
  const authUserService = new IdentityUser(store.prisma)
  const refreshTokenRepository = new RefreshSessionRepository(store.prisma)
  const accessTokenService = new AccessToken(new JwtService(), configService)
  const refreshTokenService = new RefreshSession(
    configService,
    refreshTokenRepository,
    authUserService,
  )
  const authAuditService = new IdentityAudit(auditService)
  const service = new IdentityService(
    new PasswordHasher(),
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
