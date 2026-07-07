import type {
  AuthApiError,
  AuthApiErrorCode,
  AuthUser,
  LoginApiResponse,
} from '@/features/auth/types/auth.types'

export const MOCK_LOGIN_DELAY_MS = 350
export const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password.'
export const DISABLED_ACCOUNT_MESSAGE =
  'Your account is disabled. Please contact the administrator.'

const ACCEPTED_PASSWORD = 'password'

const seededUsers: Partial<Record<string, AuthUser>> = {
  'admin@morshid.demo': {
    id: 'mock-admin',
    email: 'admin@morshid.demo',
    name: 'Demo Admin',
    role: 'admin',
  },
  'instructor@morshid.demo': {
    id: 'mock-instructor',
    email: 'instructor@morshid.demo',
    name: 'Demo Instructor',
    role: 'instructor',
  },
  'student1@morshid.demo': {
    id: 'mock-student-1',
    email: 'student1@morshid.demo',
    name: 'Demo Student',
    role: 'student',
  },
}

const disabledEmails = new Set(['disabled@morshid.demo'])

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

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
  await delay(MOCK_LOGIN_DELAY_MS)

  const normalizedEmail = email.trim().toLowerCase()

  if (password !== ACCEPTED_PASSWORD) {
    throw createAuthApiError('invalid_credentials', INVALID_CREDENTIALS_MESSAGE)
  }

  if (disabledEmails.has(normalizedEmail)) {
    throw createAuthApiError('account_disabled', DISABLED_ACCOUNT_MESSAGE)
  }

  const user = seededUsers[normalizedEmail]

  if (!user) {
    throw createAuthApiError('invalid_credentials', INVALID_CREDENTIALS_MESSAGE)
  }

  return {
    user,
    accessToken: `mock-access-token:${user.id}`,
    refreshToken: `mock-refresh-token:${user.id}`,
  }
}
