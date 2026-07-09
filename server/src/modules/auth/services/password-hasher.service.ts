import { scryptSync, timingSafeEqual } from 'node:crypto'

import { Injectable } from '@nestjs/common'

@Injectable()
export class PasswordHasherService {
  createHash(password: string, passwordSalt: string) {
    return createScryptPasswordHash(password, passwordSalt)
  }

  verifyPassword(
    password: string,
    passwordHash: string | null | undefined,
  ): boolean {
    return verifyScryptPassword(password, passwordHash ?? DUMMY_PASSWORD_HASH)
  }
}

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

function verifyScryptPassword(password: string, passwordHash: string): boolean {
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
