import { validateEnv } from './env.schema'

describe('validateEnv', () => {
  const validEnv = {
    NODE_ENV: 'test',
    PORT: '4000',
    CLIENT_ORIGIN: 'http://localhost:3000',
    DATABASE_URL:
      'postgresql://morshid:morshid_local_password@localhost:5432/morshid',
    REDIS_URL: 'redis://localhost:6379',
    PDF_STORAGE_PATH: ' ../storage/pdfs ',
    AUTH_ACCESS_TOKEN_SECRET:
      'test-access-token-secret-with-at-least-32-characters',
    AUTH_REFRESH_TOKEN_HASH_SECRET:
      'test-refresh-token-hash-secret-with-at-least-32-characters',
  }

  it('coerces and validates supported environment values', () => {
    expect(validateEnv(validEnv)).toMatchObject({
      NODE_ENV: 'test',
      PORT: 4000,
      CLIENT_ORIGIN: 'http://localhost:3000',
      DATABASE_URL:
        'postgresql://morshid:morshid_local_password@localhost:5432/morshid',
      REDIS_URL: 'redis://localhost:6379',
      PDF_STORAGE_PATH: '../storage/pdfs',
      AUTH_ACCESS_TOKEN_TTL_SECONDS: 900,
      AUTH_REFRESH_TOKEN_TTL_DAYS: 7,
    })
  })

  it('fails clearly when required service URLs are missing', () => {
    expect(() => validateEnv({ NODE_ENV: 'test' })).toThrow(
      /DATABASE_URL: Invalid input/,
    )
  })

  it('requires a non-blank PDF storage path', () => {
    const { PDF_STORAGE_PATH: _, ...withoutStoragePath } = validEnv

    expect(() => validateEnv(withoutStoragePath)).toThrow(
      /PDF_STORAGE_PATH: Invalid input/,
    )
    expect(() => validateEnv({ ...validEnv, PDF_STORAGE_PATH: '   ' })).toThrow(
      /PDF_STORAGE_PATH: Too small/,
    )
  })
})
