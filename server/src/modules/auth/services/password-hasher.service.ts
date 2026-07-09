import {
  argon2Sync,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto'

import { Injectable } from '@nestjs/common'

@Injectable()
export class PasswordHasherService {
  createHash(password: string) {
    return createArgon2idPasswordHash(password)
  }

  verifyPassword(
    password: string,
    passwordHash: string | null | undefined,
  ): boolean {
    const normalizedHash = passwordHash ?? DUMMY_PASSWORD_HASH

    if (isLegacyScryptPasswordHash(normalizedHash)) {
      return verifyLegacyScryptPassword(password, normalizedHash)
    }

    return verifyArgon2idPassword(password, normalizedHash)
  }

  needsRehash(passwordHash: string) {
    return !isArgon2idPasswordHash(passwordHash)
  }
}

const ARGON2ID_OPTIONS = {
  memory: 19_456,
  parallelism: 1,
  passes: 2,
  saltLength: 16,
  tagLength: 32,
} as const

const DUMMY_PASSWORD_HASH = createDeterministicArgon2idPasswordHash(
  '__morshid_dummy_password__',
  'morshid-auth-dummy-password',
)

export function createDeterministicArgon2idPasswordHash(
  password: string,
  passwordSalt: string,
) {
  return createArgon2idPasswordHash(password, Buffer.from(passwordSalt))
}

function createArgon2idPasswordHash(password: string, passwordSalt?: Buffer) {
  const salt = normalizeSalt(passwordSalt)
  const hash = argon2Sync('argon2id', {
    memory: ARGON2ID_OPTIONS.memory,
    message: password,
    nonce: salt,
    parallelism: ARGON2ID_OPTIONS.parallelism,
    passes: ARGON2ID_OPTIONS.passes,
    tagLength: ARGON2ID_OPTIONS.tagLength,
  })

  return [
    'argon2id',
    'v1',
    `m=${ARGON2ID_OPTIONS.memory.toString()},t=${ARGON2ID_OPTIONS.passes.toString()},p=${ARGON2ID_OPTIONS.parallelism.toString()},keylen=${ARGON2ID_OPTIONS.tagLength.toString()}`,
    salt.toString('base64url'),
    hash.toString('base64url'),
  ].join(':')
}

function isArgon2idPasswordHash(passwordHash: string) {
  return passwordHash.startsWith('argon2id:v1:')
}

function isLegacyScryptPasswordHash(passwordHash: string) {
  return passwordHash.startsWith('scrypt:v1:')
}

function verifyArgon2idPassword(
  password: string,
  passwordHash: string,
): boolean {
  const parts = passwordHash.split(':')
  const [algorithm, version, options, salt, hash] = parts

  if (
    parts.length !== 5 ||
    algorithm !== 'argon2id' ||
    version !== 'v1' ||
    !options ||
    !salt ||
    !hash
  ) {
    return false
  }

  const argon2Options = parseArgon2idOptions(options)

  if (!argon2Options) {
    return false
  }

  try {
    const expected = Buffer.from(hash, 'base64url')
    const actual = argon2Sync('argon2id', {
      memory: argon2Options.memory,
      message: password,
      nonce: Buffer.from(salt, 'base64url'),
      parallelism: argon2Options.parallelism,
      passes: argon2Options.passes,
      tagLength: argon2Options.tagLength,
    })

    return (
      expected.length === actual.length && timingSafeEqual(actual, expected)
    )
  } catch {
    return false
  }
}

function verifyLegacyScryptPassword(
  password: string,
  passwordHash: string,
): boolean {
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

  const scryptOptions = parseLegacyScryptOptions(options)

  if (!scryptOptions) {
    return false
  }

  try {
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

    return (
      expected.length === actual.length && timingSafeEqual(actual, expected)
    )
  } catch {
    return false
  }
}

function normalizeSalt(passwordSalt: Buffer | undefined) {
  if (passwordSalt === undefined) {
    return randomBytes(ARGON2ID_OPTIONS.saltLength)
  }

  return Buffer.from(passwordSalt)
}

function parseArgon2idOptions(options: string) {
  const parsed = new Map(
    options.split(',').map((option) => {
      const [key, value] = option.split('=')
      return [key, Number(value)] as const
    }),
  )
  const memory = parsed.get('m')
  const passes = parsed.get('t')
  const parallelism = parsed.get('p')
  const tagLength = parsed.get('keylen')

  if (
    !isPositiveInteger(memory) ||
    !isPositiveInteger(passes) ||
    !isPositiveInteger(parallelism) ||
    !isPositiveInteger(tagLength)
  ) {
    return null
  }

  return {
    memory,
    parallelism,
    passes,
    tagLength,
  }
}

function parseLegacyScryptOptions(options: string) {
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
