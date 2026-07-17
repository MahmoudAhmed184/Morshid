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
      EMBEDDING_PROVIDER: 'deterministic',
      RETRIEVAL_TOP_K: 5,
      RETRIEVAL_MIN_SIMILARITY: 0.7,
    })
  })

  it('coerces and bounds the retrieval top-k value', () => {
    expect(validateEnv({ ...validEnv, RETRIEVAL_TOP_K: '10' })).toMatchObject({
      RETRIEVAL_TOP_K: 10,
    })
    expect(() => validateEnv({ ...validEnv, RETRIEVAL_TOP_K: '0' })).toThrow(
      /RETRIEVAL_TOP_K: Too small/,
    )
    expect(() => validateEnv({ ...validEnv, RETRIEVAL_TOP_K: '51' })).toThrow(
      /RETRIEVAL_TOP_K: Too big/,
    )
    expect(() => validateEnv({ ...validEnv, RETRIEVAL_TOP_K: '2.5' })).toThrow(
      /RETRIEVAL_TOP_K: Invalid input/,
    )
  })

  it('coerces and bounds the retrieval similarity threshold', () => {
    expect(
      validateEnv({ ...validEnv, RETRIEVAL_MIN_SIMILARITY: '0.85' }),
    ).toMatchObject({ RETRIEVAL_MIN_SIMILARITY: 0.85 })
    expect(() =>
      validateEnv({ ...validEnv, RETRIEVAL_MIN_SIMILARITY: '-0.1' }),
    ).toThrow(/RETRIEVAL_MIN_SIMILARITY: Too small/)
    expect(() =>
      validateEnv({ ...validEnv, RETRIEVAL_MIN_SIMILARITY: '1.1' }),
    ).toThrow(/RETRIEVAL_MIN_SIMILARITY: Too big/)
    expect(() =>
      validateEnv({ ...validEnv, RETRIEVAL_MIN_SIMILARITY: 'high' }),
    ).toThrow(/RETRIEVAL_MIN_SIMILARITY: Invalid input/)
  })

  it('accepts only implemented embedding providers', () => {
    expect(
      validateEnv({ ...validEnv, EMBEDDING_PROVIDER: 'deterministic' }),
    ).toMatchObject({ EMBEDDING_PROVIDER: 'deterministic' })
    expect(() =>
      validateEnv({ ...validEnv, EMBEDDING_PROVIDER: 'openai' }),
    ).toThrow(/EMBEDDING_PROVIDER: Invalid input/)
    expect(() => validateEnv({ ...validEnv, EMBEDDING_PROVIDER: '' })).toThrow(
      /EMBEDDING_PROVIDER: Invalid input/,
    )
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

  it('rejects the committed placeholder signing secrets', () => {
    expect(() =>
      validateEnv({
        ...validEnv,
        AUTH_ACCESS_TOKEN_SECRET: 'replace-with-at-least-32-random-characters',
      }),
    ).toThrow(/AUTH_ACCESS_TOKEN_SECRET: must not use the placeholder secret/)
    expect(() =>
      validateEnv({
        ...validEnv,
        AUTH_REFRESH_TOKEN_HASH_SECRET:
          'replace-with-at-least-32-random-characters',
      }),
    ).toThrow(
      /AUTH_REFRESH_TOKEN_HASH_SECRET: must not use the placeholder secret/,
    )
  })

  it('rejects identical access and refresh secrets', () => {
    const sharedSecret = 'shared-secret-value-with-at-least-32-characters'

    expect(() =>
      validateEnv({
        ...validEnv,
        AUTH_ACCESS_TOKEN_SECRET: sharedSecret,
        AUTH_REFRESH_TOKEN_HASH_SECRET: sharedSecret,
      }),
    ).toThrow(
      /AUTH_REFRESH_TOKEN_HASH_SECRET: must differ from AUTH_ACCESS_TOKEN_SECRET/,
    )
  })

  it('requires an absolute PDF storage path in production', () => {
    expect(() =>
      validateEnv({
        ...validEnv,
        NODE_ENV: 'production',
        PDF_STORAGE_PATH: '../storage/pdfs',
      }),
    ).toThrow(/PDF_STORAGE_PATH: must be an absolute path in production/)
    expect(
      validateEnv({
        ...validEnv,
        NODE_ENV: 'production',
        PDF_STORAGE_PATH: '/workspace/storage/pdfs',
      }),
    ).toMatchObject({ PDF_STORAGE_PATH: '/workspace/storage/pdfs' })
  })
})
