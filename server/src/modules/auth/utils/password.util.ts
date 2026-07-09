import { argon2Sync, randomBytes, timingSafeEqual } from 'node:crypto'

const ARGON2ID_OPTIONS = {
  memory: 19_456,
  parallelism: 1,
  passes: 2,
  saltLength: 16,
  tagLength: 32,
} as const

interface HashPasswordOptions {
  salt?: Buffer | string
}

export function hashPassword(
  password: string,
  options: HashPasswordOptions = {},
): string {
  const salt = normalizeSalt(options.salt)
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

export function verifyPassword(
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

  const argon2Options = parseArgon2Options(options)

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

function normalizeSalt(salt: Buffer | string | undefined) {
  if (salt === undefined) {
    return randomBytes(ARGON2ID_OPTIONS.saltLength)
  }

  return Buffer.isBuffer(salt) ? Buffer.from(salt) : Buffer.from(salt)
}

function parseArgon2Options(options: string) {
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

function isPositiveInteger(value: number | undefined): value is number {
  return value !== undefined && Number.isInteger(value) && value > 0
}
