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
      GEMINI_MODEL: 'gemini-3.5-flash-lite',
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

  describe('Gemini completion configuration', () => {
    const validGeminiEnv = {
      ...validEnv,
      NODE_ENV: 'development',
      COMPLETION_PROVIDER: 'gemini',
      GEMINI_API_KEY: 'authorization-key-with-sufficient-entropy',
      GEMINI_REQUESTS_PER_MINUTE: '9',
      GEMINI_INPUT_TOKENS_PER_MINUTE: '90000',
      GEMINI_REQUESTS_PER_HOUR: '90',
      GEMINI_REQUESTS_PER_DAY: '900',
      GEMINI_REQUESTS_PER_MONTH: '9000',
    }

    it('accepts Gemini only with a key and every positive quota cap', () => {
      expect(validateEnv(validGeminiEnv)).toMatchObject({
        COMPLETION_PROVIDER: 'gemini',
        GEMINI_API_KEY: 'authorization-key-with-sufficient-entropy',
        GEMINI_MODEL: 'gemini-3.5-flash-lite',
        GEMINI_REQUESTS_PER_MINUTE: 9,
        GEMINI_INPUT_TOKENS_PER_MINUTE: 90_000,
        GEMINI_REQUESTS_PER_HOUR: 90,
        GEMINI_REQUESTS_PER_DAY: 900,
        GEMINI_REQUESTS_PER_MONTH: 9_000,
      })
    })

    it('accepts a bounded explicit model ID', () => {
      expect(
        validateEnv({
          ...validGeminiEnv,
          GEMINI_MODEL: 'gemini-custom-model-001',
        }),
      ).toMatchObject({ GEMINI_MODEL: 'gemini-custom-model-001' })

      expect(() =>
        validateEnv({
          ...validGeminiEnv,
          GEMINI_MODEL: 'invalid model/id',
        }),
      ).toThrow(/GEMINI_MODEL: Invalid string/)
      expect(() =>
        validateEnv({
          ...validGeminiEnv,
          GEMINI_MODEL: `gemini-${'x'.repeat(120)}`,
        }),
      ).toThrow(/GEMINI_MODEL: Too big/)
    })

    it('requires the key and all caps only in Gemini mode', () => {
      const conditionalKeys = [
        'GEMINI_API_KEY',
        'GEMINI_REQUESTS_PER_MINUTE',
        'GEMINI_INPUT_TOKENS_PER_MINUTE',
        'GEMINI_REQUESTS_PER_HOUR',
        'GEMINI_REQUESTS_PER_DAY',
        'GEMINI_REQUESTS_PER_MONTH',
      ] as const

      for (const key of conditionalKeys) {
        const incomplete = Object.fromEntries(
          Object.entries(validGeminiEnv).filter(
            ([entryKey]) => entryKey !== key,
          ),
        )

        expect(() => validateEnv(incomplete)).toThrow(
          new RegExp(`${key}: is required`),
        )
      }

      expect(validateEnv(validEnv)).toMatchObject({
        COMPLETION_PROVIDER: 'deterministic',
      })
    })

    it('rejects placeholders without including secret values in errors', () => {
      const privatePlaceholder =
        'replace-with-private-gemini-key-value-that-must-not-leak'
      let failure: unknown

      try {
        validateEnv({
          ...validGeminiEnv,
          GEMINI_API_KEY: privatePlaceholder,
        })
      } catch (error) {
        failure = error
      }

      expect(failure).toBeInstanceOf(Error)
      expect((failure as Error).message).toContain(
        'GEMINI_API_KEY: must be a non-placeholder authorization key',
      )
      expect((failure as Error).message).not.toContain(privatePlaceholder)
    })

    it.each(['test', 'production'] as const)(
      'rejects Gemini in %s',
      (nodeEnv) => {
        expect(() =>
          validateEnv({ ...validGeminiEnv, NODE_ENV: nodeEnv }),
        ).toThrow(
          /COMPLETION_PROVIDER: gemini is restricted to access-controlled development\/demo environments/,
        )
      },
    )

    it('requires monotonic request caps', () => {
      expect(() =>
        validateEnv({
          ...validGeminiEnv,
          GEMINI_REQUESTS_PER_MINUTE: '10',
          GEMINI_REQUESTS_PER_HOUR: '9',
        }),
      ).toThrow(
        /GEMINI_REQUESTS_PER_MONTH: request caps must satisfy minute <= hour <= day <= month/,
      )
      expect(() =>
        validateEnv({
          ...validGeminiEnv,
          GEMINI_REQUESTS_PER_HOUR: '1000',
          GEMINI_REQUESTS_PER_DAY: '999',
        }),
      ).toThrow(
        /GEMINI_REQUESTS_PER_MONTH: request caps must satisfy minute <= hour <= day <= month/,
      )
    })

    it.each(['0', '-1', '1.5', 'unlimited'])(
      'rejects invalid quota cap %s',
      (cap) => {
        expect(() =>
          validateEnv({
            ...validGeminiEnv,
            GEMINI_REQUESTS_PER_MONTH: cap,
          }),
        ).toThrow(/GEMINI_REQUESTS_PER_MONTH:/)
      },
    )
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
