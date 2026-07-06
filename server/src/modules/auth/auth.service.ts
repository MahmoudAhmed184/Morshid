import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto'

import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'

import type { RefreshToken, User } from '../../generated/prisma/client'
import {
  AUDIT_EVENT_ACTIONS,
  AUDIT_TARGET_TYPES,
} from '../audit/audit.constants'
import { AuditService } from '../audit/audit.service'
import type { AppEnvironment } from '../config/env.schema'
import { PrismaService } from '../prisma/prisma.service'
import {
  AUTH_ERROR_CODES,
  type AuthCourseSummary,
  type AuthenticatedRequestUser,
  type AuthRequestContext,
  type AuthSessionResponse,
  type AuthUserSummary,
  type LogoutRequest,
  type MeResponse,
  type RefreshRequest,
  type SignInRequest,
} from './auth.dto'

@Injectable()
export class AuthService {
  private readonly accessTokenSecret: string
  private readonly refreshTokenHashSecret: string
  private readonly accessTokenTtlSeconds: number
  private readonly refreshTokenTtlDays: number

  constructor(
    private readonly prismaService: PrismaService,
    private readonly jwtService: JwtService,
    configService: ConfigService<AppEnvironment, true>,
    private readonly auditService: AuditService,
  ) {
    this.accessTokenSecret = configService.get('AUTH_ACCESS_TOKEN_SECRET', {
      infer: true,
    })
    this.refreshTokenHashSecret = configService.get(
      'AUTH_REFRESH_TOKEN_HASH_SECRET',
      {
        infer: true,
      },
    )
    this.accessTokenTtlSeconds = configService.get(
      'AUTH_ACCESS_TOKEN_TTL_SECONDS',
      {
        infer: true,
      },
    )
    this.refreshTokenTtlDays = configService.get(
      'AUTH_REFRESH_TOKEN_TTL_DAYS',
      {
        infer: true,
      },
    )
  }

  async signIn(
    input: SignInRequest,
    requestContext: AuthRequestContext,
  ): Promise<AuthSessionResponse> {
    const email = normalizeEmail(input.email)
    const user = await this.prismaService.user.findUnique({
      where: {
        email,
      },
    })

    const passwordHash = user?.passwordHash ?? DUMMY_PASSWORD_HASH

    if (!verifyPassword(input.password, passwordHash) || !user) {
      await this.auditService.recordEvent({
        action: AUDIT_EVENT_ACTIONS.AUTH_LOGIN_FAILED,
        target: {
          type: AUDIT_TARGET_TYPES.AUTH_SESSION,
        },
        metadata: {
          email,
        },
        requestContext,
      })
      throw invalidCredentialsException()
    }

    if (user.status === 'DISABLED') {
      await this.recordDisabledAccountBlock(user, requestContext)
      throw accountDisabledException()
    }

    const now = new Date()

    await this.prismaService.user.update({
      where: {
        id: user.id,
      },
      data: {
        lastLoginAt: now,
      },
    })

    const session = await this.createSession(user, now, requestContext)

    await this.auditService.recordEvent({
      actorUserId: user.id,
      action: AUDIT_EVENT_ACTIONS.AUTH_LOGIN_SUCCEEDED,
      target: {
        type: AUDIT_TARGET_TYPES.AUTH_SESSION,
        id: session.refreshTokenRecord.id,
      },
      requestContext,
    })

    return session.response
  }

  async refresh(
    input: RefreshRequest,
    requestContext: AuthRequestContext,
  ): Promise<AuthSessionResponse> {
    const now = new Date()
    const refreshTokenHash = this.hashRefreshToken(input.refreshToken)
    const rotation = await this.rotateRefreshToken(
      refreshTokenHash,
      now,
      requestContext,
    )

    const accessToken = await this.createAccessToken(rotation.user, now)
    const userSummary = await this.buildUserSummary(rotation.user)

    await this.auditService.recordEvent({
      actorUserId: rotation.user.id,
      action: AUDIT_EVENT_ACTIONS.AUTH_REFRESH_TOKEN_ROTATED,
      target: {
        type: AUDIT_TARGET_TYPES.AUTH_SESSION,
        id: rotation.nextRefreshToken.record.id,
      },
      metadata: {
        previousRefreshTokenId: rotation.previousToken.id,
      },
      requestContext,
    })

    return {
      tokenType: 'Bearer',
      accessToken: accessToken.token,
      accessTokenExpiresAt: accessToken.expiresAt.toISOString(),
      refreshToken: rotation.nextRefreshToken.token,
      refreshTokenExpiresAt:
        rotation.nextRefreshToken.record.expiresAt.toISOString(),
      user: userSummary,
    }
  }

  async logout(
    input: LogoutRequest,
    requestContext: AuthRequestContext,
  ): Promise<void> {
    const now = new Date()
    const result = await this.prismaService.refreshToken.updateMany({
      where: {
        tokenHash: this.hashRefreshToken(input.refreshToken),
        revokedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      data: {
        revokedAt: now,
      },
    })

    if (result.count === 0) {
      return
    }

    await this.auditService.recordEvent({
      action: AUDIT_EVENT_ACTIONS.AUTH_LOGOUT,
      target: {
        type: AUDIT_TARGET_TYPES.AUTH_SESSION,
      },
      requestContext,
    })
  }

  async getMe(userId: string): Promise<MeResponse> {
    const user = await this.findActiveUserById(userId)

    if (!user) {
      throw invalidAccessTokenException()
    }

    return {
      user: await this.buildUserSummary(user),
    }
  }

  async authenticateAccessToken(
    accessToken: string,
    requestContext: AuthRequestContext,
  ): Promise<AuthenticatedRequestUser> {
    const payload = await this.verifyAccessToken(accessToken)
    const user = await this.prismaService.user.findUnique({
      where: {
        id: payload.sub,
      },
    })

    if (!user) {
      throw invalidAccessTokenException()
    }

    if (user.status === 'DISABLED') {
      await this.recordDisabledAccountBlock(user, requestContext)
      throw accountDisabledException()
    }

    return pickAuthenticatedUser(user)
  }

  private async findActiveUserById(
    userId: string,
  ): Promise<AuthenticatedRequestUser | null> {
    const user = await this.prismaService.user.findUnique({
      where: {
        id: userId,
      },
    })

    if (!user || user.status === 'DISABLED') {
      return null
    }

    return pickAuthenticatedUser(user)
  }

  private async createSession(
    user: User,
    now: Date,
    requestContext: AuthRequestContext,
  ) {
    const accessToken = await this.createAccessToken(user, now)
    const refreshToken = await this.createRefreshTokenRecord(
      this.prismaService,
      user,
      now,
      requestContext,
    )
    const userSummary = await this.buildUserSummary(user)

    return {
      refreshTokenRecord: refreshToken.record,
      response: {
        tokenType: 'Bearer' as const,
        accessToken: accessToken.token,
        accessTokenExpiresAt: accessToken.expiresAt.toISOString(),
        refreshToken: refreshToken.token,
        refreshTokenExpiresAt: refreshToken.record.expiresAt.toISOString(),
        user: userSummary,
      },
    }
  }

  private async rotateRefreshToken(
    refreshTokenHash: string,
    now: Date,
    requestContext: AuthRequestContext,
  ) {
    const result = await this.prismaService.$transaction(async (tx) => {
      const storedToken = await tx.refreshToken.findUnique({
        where: {
          tokenHash: refreshTokenHash,
        },
        include: {
          user: true,
        },
      })

      if (!storedToken || !isActiveRefreshToken(storedToken, now)) {
        throw invalidRefreshTokenException()
      }

      const revokeResult = await tx.refreshToken.updateMany({
        where: {
          id: storedToken.id,
          tokenHash: refreshTokenHash,
          revokedAt: null,
          expiresAt: {
            gt: now,
          },
        },
        data: {
          revokedAt: now,
        },
      })

      if (revokeResult.count !== 1) {
        throw invalidRefreshTokenException()
      }

      if (storedToken.user.status === 'DISABLED') {
        return {
          kind: 'disabled' as const,
          userId: storedToken.user.id,
        }
      }

      const nextRefreshToken = await this.createRefreshTokenRecord(
        tx,
        storedToken.user,
        now,
        requestContext,
      )

      await tx.refreshToken.update({
        where: {
          id: storedToken.id,
        },
        data: {
          replacedByTokenId: nextRefreshToken.record.id,
        },
      })

      return {
        kind: 'rotated' as const,
        nextRefreshToken,
        previousToken: storedToken,
        user: storedToken.user,
      }
    })

    if (result.kind === 'disabled') {
      await this.recordDisabledAccountBlock(
        {
          id: result.userId,
        },
        requestContext,
      )
      throw accountDisabledException()
    }

    return result
  }

  private async createAccessToken(user: Pick<User, 'id'>, now: Date) {
    const expiresAt = addSeconds(now, this.accessTokenTtlSeconds)
    const token = await this.jwtService.signAsync(
      {
        sub: user.id,
        typ: 'access',
      } satisfies VerifiedAccessTokenPayload,
      {
        expiresIn: this.accessTokenTtlSeconds,
        secret: this.accessTokenSecret,
      },
    )

    return {
      expiresAt,
      token,
    }
  }

  private async verifyAccessToken(
    token: string,
  ): Promise<VerifiedAccessTokenPayload> {
    try {
      const payload =
        await this.jwtService.verifyAsync<UntrustedAccessTokenPayload>(token, {
          secret: this.accessTokenSecret,
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

  private async createRefreshTokenRecord(
    client: RefreshTokenWriteClient,
    user: Pick<User, 'id'>,
    now: Date,
    requestContext: AuthRequestContext,
  ) {
    const token = randomBytes(32).toString('base64url')
    const record = await client.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashRefreshToken(token),
        expiresAt: addDays(now, this.refreshTokenTtlDays),
        ip: requestContext.ip ?? null,
        userAgent: requestContext.userAgent ?? null,
      },
    })

    return {
      record,
      token,
    }
  }

  private hashRefreshToken(token: string) {
    return createHmac('sha256', this.refreshTokenHashSecret)
      .update(token)
      .digest('base64url')
  }

  private async buildUserSummary(
    user: AuthenticatedRequestUser | User,
  ): Promise<AuthUserSummary> {
    const courses =
      user.role === 'ADMIN'
        ? await this.listAdminCourseSummaries(user.id)
        : await this.listMemberCourseSummaries(user.id)

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      status: user.status,
      courses,
    }
  }

  private async listAdminCourseSummaries(
    userId: string,
  ): Promise<AuthCourseSummary[]> {
    const courses = await this.prismaService.course.findMany({
      include: {
        memberships: {
          where: {
            userId,
          },
        },
      },
    })

    return courses
      .map((course) => ({
        id: course.id,
        code: course.code,
        title: course.title,
        membershipRole: course.memberships[0]?.role ?? null,
      }))
      .sort(compareCourses)
  }

  private async listMemberCourseSummaries(
    userId: string,
  ): Promise<AuthCourseSummary[]> {
    const memberships = await this.prismaService.courseMembership.findMany({
      where: {
        userId,
      },
      include: {
        course: true,
      },
    })

    return memberships
      .map((membership) => ({
        id: membership.course.id,
        code: membership.course.code,
        title: membership.course.title,
        membershipRole: membership.role,
      }))
      .sort(compareCourses)
  }

  private async recordDisabledAccountBlock(
    user: Pick<User, 'id'>,
    requestContext: AuthRequestContext,
  ) {
    await this.auditService.recordEvent({
      actorUserId: user.id,
      action: AUDIT_EVENT_ACTIONS.AUTH_LOGIN_BLOCKED_DISABLED_ACCOUNT,
      target: {
        type: AUDIT_TARGET_TYPES.USER,
        id: user.id,
      },
      requestContext,
    })
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

type RefreshTokenWriteClient = Pick<PrismaService, 'refreshToken'>

const SCRYPT_OPTIONS = {
  N: 16_384,
  r: 8,
  p: 1,
  keyLength: 64,
} as const

const DUMMY_PASSWORD_HASH = createScryptPasswordHash(
  '__morshid_dummy_password__',
  'morshid-auth-dummy-password',
)

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function createScryptPasswordHash(password: string, passwordSalt: string) {
  const derivedKey = scryptSync(
    password,
    passwordSalt,
    SCRYPT_OPTIONS.keyLength,
    {
      N: SCRYPT_OPTIONS.N,
      r: SCRYPT_OPTIONS.r,
      p: SCRYPT_OPTIONS.p,
    },
  )

  return [
    'scrypt',
    'v1',
    `N=${SCRYPT_OPTIONS.N.toString()},r=${SCRYPT_OPTIONS.r.toString()},p=${SCRYPT_OPTIONS.p.toString()},keylen=${SCRYPT_OPTIONS.keyLength.toString()}`,
    Buffer.from(passwordSalt).toString('base64url'),
    derivedKey.toString('base64url'),
  ].join(':')
}

function verifyPassword(password: string, passwordHash: string): boolean {
  const parts = passwordHash.split(':')
  const [algorithm, version, options, salt, hash] = parts

  if (
    parts.length !== 5 ||
    algorithm !== 'scrypt' ||
    version !== 'v1' ||
    !options ||
    !salt ||
    !hash
  ) {
    return false
  }

  const scryptOptions = parseScryptOptions(options)

  if (!scryptOptions) {
    return false
  }

  const expected = Buffer.from(hash, 'base64url')
  const actual = scryptSync(
    password,
    Buffer.from(salt, 'base64url').toString('utf8'),
    scryptOptions.keyLength,
    {
      N: scryptOptions.N,
      p: scryptOptions.p,
      r: scryptOptions.r,
    },
  )

  return expected.length === actual.length && timingSafeEqual(actual, expected)
}

function parseScryptOptions(options: string) {
  const parsed = new Map(
    options.split(',').map((option) => {
      const [key, value] = option.split('=')
      return [key, Number(value)] as const
    }),
  )
  const N = parsed.get('N')
  const r = parsed.get('r')
  const p = parsed.get('p')
  const keyLength = parsed.get('keylen')

  if (
    !isPositiveInteger(N) ||
    !isPositiveInteger(r) ||
    !isPositiveInteger(p) ||
    !isPositiveInteger(keyLength)
  ) {
    return null
  }

  return {
    N,
    keyLength,
    p,
    r,
  }
}

function isPositiveInteger(value: number | undefined): value is number {
  return value !== undefined && Number.isInteger(value) && value > 0
}

function isActiveRefreshToken(refreshToken: RefreshToken, now: Date) {
  return refreshToken.revokedAt === null && refreshToken.expiresAt > now
}

function addSeconds(date: Date, seconds: number) {
  return new Date(date.getTime() + seconds * 1000)
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

function compareCourses(a: AuthCourseSummary, b: AuthCourseSummary) {
  return a.code.localeCompare(b.code)
}

function pickAuthenticatedUser(user: User): AuthenticatedRequestUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
  }
}

function invalidCredentialsException() {
  return new UnauthorizedException({
    code: AUTH_ERROR_CODES.INVALID_CREDENTIALS,
    message: 'Invalid email or password',
  })
}

function invalidAccessTokenException() {
  return new UnauthorizedException({
    code: AUTH_ERROR_CODES.INVALID_ACCESS_TOKEN,
    message: 'Invalid access token',
  })
}

function invalidRefreshTokenException() {
  return new UnauthorizedException({
    code: AUTH_ERROR_CODES.INVALID_REFRESH_TOKEN,
    message: 'Invalid refresh token',
  })
}

function accountDisabledException() {
  return new ForbiddenException({
    code: AUTH_ERROR_CODES.ACCOUNT_DISABLED,
    message: 'Account is disabled',
  })
}
