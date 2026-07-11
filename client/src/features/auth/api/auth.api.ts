import type {
  AuthApiError,
  AuthApiErrorCode,
  AuthUser,
  LoginApiResponse,
} from '@/features/auth/types/auth.types'

export const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password.'
export const DISABLED_ACCOUNT_MESSAGE =
  'Your account is disabled. Please contact the administrator.'

const ACCEPTED_PASSWORD = 'password'
const mockAccessTokenExpiresAt = '2026-07-11T12:15:00.000Z'
const mockRefreshTokenExpiresAt = '2026-07-18T12:00:00.000Z'

// TODO: Replace this temporary mock with the real auth service implementation.
const seededUsers: Partial<Record<string, AuthUser>> = {
  'admin@morshid.demo': {
    id: 'mock-admin',
    email: 'admin@morshid.demo',
    displayName: 'Demo Admin',
    role: 'ADMIN',
    status: 'ACTIVE',
    courses: [],
  },
  'instructor@morshid.demo': {
    id: 'mock-instructor',
    email: 'instructor@morshid.demo',
    displayName: 'Demo Instructor',
    role: 'INSTRUCTOR',
    status: 'ACTIVE',
    courses: [],
  },
  'student1@morshid.demo': {
    id: 'mock-student-1',
    email: 'student1@morshid.demo',
    displayName: 'Demo Student',
    role: 'STUDENT',
    status: 'ACTIVE',
    courses: [],
  },
}

const disabledEmails = new Set(['disabled@morshid.demo'])

function createAuthApiError(
  code: AuthApiErrorCode,
  message: string,
): AuthApiError {
  return Object.assign(new Error(message), {
    code,
    name: 'AuthApiError',
  })
}

export function isAuthApiError(error: unknown): error is AuthApiError {
  return error instanceof Error && error.name === 'AuthApiError'
}

export async function loginApi(
  email: string,
  password: string,
): Promise<LoginApiResponse> {
  const normalizedEmail = email.trim().toLowerCase()

  if (password !== ACCEPTED_PASSWORD) {
    throw createAuthApiError('INVALID_CREDENTIALS', INVALID_CREDENTIALS_MESSAGE)
  }

  if (disabledEmails.has(normalizedEmail)) {
    throw createAuthApiError('ACCOUNT_DISABLED', DISABLED_ACCOUNT_MESSAGE)
  }

  const user = seededUsers[normalizedEmail]

  if (!user) {
    throw createAuthApiError('INVALID_CREDENTIALS', INVALID_CREDENTIALS_MESSAGE)
  }

  return {
    tokenType: 'Bearer',
    user,
    accessToken: `mock-access-token:${user.id}`,
    accessTokenExpiresAt: mockAccessTokenExpiresAt,
    refreshToken: `mock-refresh-token:${user.id}`,
    refreshTokenExpiresAt: mockRefreshTokenExpiresAt,
  }
}
