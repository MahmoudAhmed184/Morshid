import {
  DEFAULT_SBG_BASE_URL,
  DEFAULT_SBG_MAX_TOKENS,
  DEFAULT_SBG_MODEL_ID,
  MAX_SBG_MAX_TOKENS,
  MIN_SBG_MAX_TOKENS,
} from '../completion/student-bedrock-gateway-completion.provider'
import { MAX_PDF_UPLOAD_BYTES, validateEnv } from './env.schema'

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
      PDF_MAX_UPLOAD_BYTES: 10 * 1024 * 1024,
      AUTH_ACCESS_TOKEN_TTL_SECONDS: 900,
      AUTH_REFRESH_TOKEN_TTL_DAYS: 7,
      EMBEDDING_PROVIDER: 'deterministic',
      COMPLETION_PROVIDER: 'deterministic',
      COMPLETION_TIMEOUT_MS: 30_000,
      SBG_BASE_URL: DEFAULT_SBG_BASE_URL,
      SBG_MODEL_ID: DEFAULT_SBG_MODEL_ID,
      SBG_MAX_TOKENS: DEFAULT_SBG_MAX_TOKENS,
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

  it('accepts only implemented completion providers', () => {
    expect(
      validateEnv({ ...validEnv, COMPLETION_PROVIDER: 'deterministic' }),
    ).toMatchObject({ COMPLETION_PROVIDER: 'deterministic' })
    expect(() =>
      validateEnv({ ...validEnv, COMPLETION_PROVIDER: 'openai' }),
    ).toThrow(/COMPLETION_PROVIDER: Invalid option/)
    expect(() => validateEnv({ ...validEnv, COMPLETION_PROVIDER: '' })).toThrow(
      /COMPLETION_PROVIDER: Invalid option/,
    )
  })

  it('keeps deterministic startup keyless and requires a key only for the gateway', () => {
    const deterministicEnv = validateEnv({
      ...validEnv,
      COMPLETION_PROVIDER: 'deterministic',
    })
    expect(deterministicEnv).toMatchObject({
      COMPLETION_PROVIDER: 'deterministic',
    })
    expect(deterministicEnv).not.toHaveProperty('SBG_API_KEY')

    expect(() =>
      validateEnv({
        ...validEnv,
        COMPLETION_PROVIDER: 'student-bedrock-gateway',
      }),
    ).toThrow(/SBG_API_KEY: is required for student-bedrock-gateway/)
    expect(() =>
      validateEnv({
        ...validEnv,
        COMPLETION_PROVIDER: 'student-bedrock-gateway',
        SBG_API_KEY: '   ',
      }),
    ).toThrow(/SBG_API_KEY: is required for student-bedrock-gateway/)

    expect(
      validateEnv({
        ...validEnv,
        COMPLETION_PROVIDER: 'student-bedrock-gateway',
        SBG_API_KEY: '<test-only-placeholder>',
      }),
    ).toMatchObject({
      COMPLETION_PROVIDER: 'student-bedrock-gateway',
      SBG_API_KEY: '<test-only-placeholder>',
    })
  })

  it('requires an HTTPS gateway base URL without embedded credentials', () => {
    expect(() =>
      validateEnv({
        ...validEnv,
        SBG_BASE_URL: 'http://apiaccess.iti.net.eg/student/integration',
      }),
    ).toThrow(/SBG_BASE_URL: must be an HTTPS URL/)
    expect(() =>
      validateEnv({
        ...validEnv,
        SBG_BASE_URL: 'https://user:password@gateway.example.test/api/v1',
      }),
    ).toThrow(/SBG_BASE_URL: must be an HTTPS URL/)
    expect(() =>
      validateEnv({
        ...validEnv,
        SBG_BASE_URL: 'https://gateway.example.test/api/v1?secret=value',
      }),
    ).toThrow(/SBG_BASE_URL: must be an HTTPS URL/)
  })

  it('accepts approved model overrides and bounds max tokens', () => {
    const configured = validateEnv({
      ...validEnv,
      SBG_MODEL_ID: 'global.anthropic.approved-model-v1:0',
      SBG_MAX_TOKENS: String(MAX_SBG_MAX_TOKENS),
    })

    expect(configured).toMatchObject({
      SBG_MODEL_ID: 'global.anthropic.approved-model-v1:0',
      SBG_MAX_TOKENS: MAX_SBG_MAX_TOKENS,
    })

    for (const invalidTokens of [
      String(MIN_SBG_MAX_TOKENS - 1),
      '1.5',
      String(MAX_SBG_MAX_TOKENS + 1),
      'many',
    ]) {
      expect(() =>
        validateEnv({ ...validEnv, SBG_MAX_TOKENS: invalidTokens }),
      ).toThrow(/SBG_MAX_TOKENS:/)
    }
    expect(() =>
      validateEnv({ ...validEnv, SBG_MODEL_ID: 'invalid/model' }),
    ).toThrow(/SBG_MODEL_ID:/)
  })

  it('coerces and bounds the completion timeout', () => {
    expect(
      validateEnv({ ...validEnv, COMPLETION_TIMEOUT_MS: '45000' }),
    ).toMatchObject({ COMPLETION_TIMEOUT_MS: 45_000 })
    expect(
      validateEnv({ ...validEnv, COMPLETION_TIMEOUT_MS: '120000' }),
    ).toMatchObject({ COMPLETION_TIMEOUT_MS: 120_000 })

    for (const invalidTimeout of ['0', '-1', '1.5', '120001', 'never']) {
      expect(() =>
        validateEnv({
          ...validEnv,
          COMPLETION_TIMEOUT_MS: invalidTimeout,
        }),
      ).toThrow(/COMPLETION_TIMEOUT_MS:/)
    }
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

  it('coerces and bounds the PDF max upload size', () => {
    expect(
      validateEnv({ ...validEnv, PDF_MAX_UPLOAD_BYTES: '5242880' }),
    ).toMatchObject({
      PDF_MAX_UPLOAD_BYTES: 5 * 1024 * 1024,
    })
    expect(() =>
      validateEnv({ ...validEnv, PDF_MAX_UPLOAD_BYTES: '0' }),
    ).toThrow(/PDF_MAX_UPLOAD_BYTES: Too small/)
    expect(() =>
      validateEnv({ ...validEnv, PDF_MAX_UPLOAD_BYTES: '10.5' }),
    ).toThrow(/PDF_MAX_UPLOAD_BYTES: Invalid input/)
    expect(() =>
      validateEnv({
        ...validEnv,
        PDF_MAX_UPLOAD_BYTES: String(MAX_PDF_UPLOAD_BYTES + 1),
      }),
    ).toThrow(/PDF_MAX_UPLOAD_BYTES: Too big/)
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
