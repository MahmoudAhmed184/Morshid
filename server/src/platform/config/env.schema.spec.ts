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

  it('coerces platform values and applies infrastructure defaults', () => {
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
      EMBEDDING_QUERY_TIMEOUT_MS: 10_000,
      EMBEDDING_DOCUMENT_TIMEOUT_MS: 120_000,
      EMBEDDING_REQUEST_TIMEOUT_MS: 30_000,
      GEMINI_EMBEDDING_DEMO_ACKNOWLEDGED: false,
    })
  })

  it('rejects placeholder or reused auth secrets', () => {
    expect(() =>
      validateEnv({
        ...validEnv,
        AUTH_ACCESS_TOKEN_SECRET: 'replace-with-access-secret',
      }),
    ).toThrow(/AUTH_ACCESS_TOKEN_SECRET/)

    expect(() =>
      validateEnv({
        ...validEnv,
        AUTH_REFRESH_TOKEN_HASH_SECRET: validEnv.AUTH_ACCESS_TOKEN_SECRET,
      }),
    ).toThrow(/AUTH_REFRESH_TOKEN_HASH_SECRET/)
  })

  it('requires an explicit safe embedding configuration for Gemini', () => {
    expect(() =>
      validateEnv({
        ...validEnv,
        EMBEDDING_PROVIDER: 'gemini',
        GEMINI_EMBEDDING_API_KEY: 'test-embedding-key-that-is-long-enough',
        GEMINI_EMBEDDING_QUOTA_PROJECT_ID: 'embedding-project-01',
        GEMINI_EMBEDDING_REQUESTS_PER_MINUTE: '10',
        GEMINI_EMBEDDING_INPUT_TOKENS_PER_MINUTE: '100000',
        GEMINI_EMBEDDING_REQUESTS_PER_DAY: '500',
        GEMINI_EMBEDDING_LOCAL_REQUESTS_PER_HOUR: '200',
        GEMINI_EMBEDDING_LOCAL_REQUESTS_PER_30_DAYS: '5000',
      }),
    ).toThrow(/GEMINI_EMBEDDING_DEMO_ACKNOWLEDGED/)
  })

  it('keeps the Gemini embedding credential outside the chat project pool', () => {
    const sharedKey = 'shared-gemini-api-key-that-is-long-enough'

    expect(() =>
      validateEnv({
        ...validEnv,
        EMBEDDING_PROVIDER: 'gemini',
        GEMINI_EMBEDDING_API_KEY: sharedKey,
        GEMINI_EMBEDDING_QUOTA_PROJECT_ID: 'embedding-project-01',
        GEMINI_EMBEDDING_DEMO_ACKNOWLEDGED: 'true',
        GEMINI_EMBEDDING_REQUESTS_PER_MINUTE: '10',
        GEMINI_EMBEDDING_INPUT_TOKENS_PER_MINUTE: '100000',
        GEMINI_EMBEDDING_REQUESTS_PER_DAY: '500',
        GEMINI_EMBEDDING_LOCAL_REQUESTS_PER_HOUR: '200',
        GEMINI_EMBEDDING_LOCAL_REQUESTS_PER_30_DAYS: '5000',
        GEMINI_CHAT_PROJECTS_JSON: JSON.stringify([
          { id: 'chat-project-01', apiKey: sharedKey },
        ]),
      }),
    ).toThrow(/GEMINI_EMBEDDING_API_KEY/)
  })

  it('requires an absolute PDF storage path in production', () => {
    expect(() =>
      validateEnv({
        ...validEnv,
        NODE_ENV: 'production',
        PDF_STORAGE_PATH: '../storage/pdfs',
      }),
    ).toThrow(/PDF_STORAGE_PATH/)
  })
})
