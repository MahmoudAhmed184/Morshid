import {
  DEFAULT_AWS_BEDROCK_MAX_TOKENS,
  DEFAULT_ITI_BEDROCK_GATEWAY_BASE_URL,
  MAX_AWS_BEDROCK_ALLOWED_MODEL_IDS,
  MAX_AWS_BEDROCK_MAX_TOKENS,
  MIN_AWS_BEDROCK_MAX_TOKENS,
  isValidGeminiModelId,
} from '../completion/completion-configuration'
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

  // Every gateway rule is provider-gated, so gateway assertions start from a
  // fully configured aws-bedrock environment.
  const gatewayEnv = {
    ...validEnv,
    COMPLETION_PROVIDER: 'aws-bedrock',
    ITI_BEDROCK_GATEWAY_API_KEY: '<test-only-placeholder>',
    AWS_BEDROCK_MODEL_ID: 'openai.test-model-v1:0',
    AWS_BEDROCK_ALLOWED_MODEL_IDS: 'openai.test-model-v1:0',
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
      ITI_BEDROCK_GATEWAY_BASE_URL: DEFAULT_ITI_BEDROCK_GATEWAY_BASE_URL,
      ITI_BEDROCK_ALLOW_INSECURE_HTTP: false,
      AWS_BEDROCK_MODEL_ID: '',
      AWS_BEDROCK_ALLOWED_MODEL_IDS: [],
      AWS_BEDROCK_MAX_TOKENS: DEFAULT_AWS_BEDROCK_MAX_TOKENS,
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

  it('defaults the three embedding deadlines independently', () => {
    expect(validateEnv({ ...validEnv })).toMatchObject({
      EMBEDDING_QUERY_TIMEOUT_MS: 10_000,
      EMBEDDING_DOCUMENT_TIMEOUT_MS: 120_000,
      EMBEDDING_REQUEST_TIMEOUT_MS: 30_000,
    })
  })

  // The three budgets are deliberately independent: a longer ingest deadline
  // must not silently stretch an interactive chat turn's deadline.
  it('bounds each embedding deadline by its own ceiling', () => {
    expect(
      validateEnv({
        ...validEnv,
        EMBEDDING_QUERY_TIMEOUT_MS: '60000',
        EMBEDDING_DOCUMENT_TIMEOUT_MS: '900000',
        EMBEDDING_REQUEST_TIMEOUT_MS: '120000',
      }),
    ).toMatchObject({
      EMBEDDING_QUERY_TIMEOUT_MS: 60_000,
      EMBEDDING_DOCUMENT_TIMEOUT_MS: 900_000,
      EMBEDDING_REQUEST_TIMEOUT_MS: 120_000,
    })

    expect(() =>
      validateEnv({ ...validEnv, EMBEDDING_QUERY_TIMEOUT_MS: '60001' }),
    ).toThrow(/EMBEDDING_QUERY_TIMEOUT_MS/)
    expect(() =>
      validateEnv({ ...validEnv, EMBEDDING_DOCUMENT_TIMEOUT_MS: '900001' }),
    ).toThrow(/EMBEDDING_DOCUMENT_TIMEOUT_MS/)
    expect(() =>
      validateEnv({ ...validEnv, EMBEDDING_REQUEST_TIMEOUT_MS: '120001' }),
    ).toThrow(/EMBEDDING_REQUEST_TIMEOUT_MS/)
  })

  it.each([
    'EMBEDDING_QUERY_TIMEOUT_MS',
    'EMBEDDING_DOCUMENT_TIMEOUT_MS',
    'EMBEDDING_REQUEST_TIMEOUT_MS',
  ] as const)('rejects a non-positive %s', (key) => {
    expect(() => validateEnv({ ...validEnv, [key]: '0' })).toThrow(
      new RegExp(key),
    )
  })

  it('accepts only implemented completion providers', () => {
    expect(
      validateEnv({ ...validEnv, COMPLETION_PROVIDER: 'deterministic' }),
    ).toMatchObject({ COMPLETION_PROVIDER: 'deterministic' })
    expect(
      validateEnv({
        ...validEnv,
        COMPLETION_PROVIDER: 'aws-bedrock',
        ITI_BEDROCK_GATEWAY_API_KEY: '<test-only-placeholder>',
        AWS_BEDROCK_MODEL_ID: 'openai.test-model-v1:0',
        AWS_BEDROCK_ALLOWED_MODEL_IDS: 'openai.test-model-v1:0',
      }),
    ).toMatchObject({ COMPLETION_PROVIDER: 'aws-bedrock' })
    expect(
      validateEnv({
        ...validEnv,
        COMPLETION_PROVIDER: 'gemini',
        GEMINI_DEMO_ACKNOWLEDGED: 'true',
        GEMINI_API_KEY: 'authorization-key-with-sufficient-entropy',
        GEMINI_REQUESTS_PER_MINUTE: '9',
        GEMINI_INPUT_TOKENS_PER_MINUTE: '90000',
        GEMINI_REQUESTS_PER_HOUR: '90',
        GEMINI_REQUESTS_PER_DAY: '900',
        GEMINI_REQUESTS_PER_MONTH: '9000',
      }),
    ).toMatchObject({ COMPLETION_PROVIDER: 'gemini' })
    expect(() =>
      validateEnv({ ...validEnv, COMPLETION_PROVIDER: 'openai' }),
    ).toThrow(/COMPLETION_PROVIDER: Invalid option/)
    expect(() => validateEnv({ ...validEnv, COMPLETION_PROVIDER: '' })).toThrow(
      /COMPLETION_PROVIDER: Invalid option/,
    )
  })

  describe('Gemini completion configuration', () => {
    // Deliberately inherits `NODE_ENV: 'test'` from `validEnv`: the e2e suite
    // boots AppModule under jest, so a Gemini-configured `server/.env` must not
    // make every AppModule-booting spec fail validation.
    const validGeminiEnv = {
      ...validEnv,
      COMPLETION_PROVIDER: 'gemini',
      GEMINI_DEMO_ACKNOWLEDGED: 'true',
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
      ).toThrow(/GEMINI_MODEL: must be a valid Gemini model ID/)
      expect(() =>
        validateEnv({
          ...validGeminiEnv,
          GEMINI_MODEL: `gemini-${'x'.repeat(120)}`,
        }),
      ).toThrow(/GEMINI_MODEL: Too big/)
    })

    // The startup schema and the adapter's runtime configuration check must
    // both parse through `isValidGeminiModelId`, or a model ID that startup
    // rejects could still reach the provider through the factory.
    it('delegates model-ID vocabulary to the shared completion predicate', () => {
      const accepted = ['gemini-3.5-flash-lite', 'gemini-1.5-pro', 'g0']
      const rejected = ['', '-leading-dash', '.leading-dot', 'Gemini-Uppercase']

      for (const modelId of accepted) {
        expect(isValidGeminiModelId(modelId)).toBe(true)
        expect(
          validateEnv({ ...validGeminiEnv, GEMINI_MODEL: modelId }),
        ).toMatchObject({ GEMINI_MODEL: modelId })
      }

      for (const modelId of rejected) {
        expect(isValidGeminiModelId(modelId)).toBe(false)
        expect(() =>
          validateEnv({ ...validGeminiEnv, GEMINI_MODEL: modelId }),
        ).toThrow(/GEMINI_MODEL: must be a valid Gemini model ID/)
      }

      // Bedrock's `provider.model:revision` shape is not Gemini vocabulary, so
      // the two predicates must not be interchangeable.
      expect(isValidGeminiModelId('openai.test-model-v1:0')).toBe(false)
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

    // Selecting one live provider must never demand the other's configuration.
    it('does not require gateway configuration in Gemini mode', () => {
      expect(validateEnv(validGeminiEnv)).toMatchObject({
        COMPLETION_PROVIDER: 'gemini',
        AWS_BEDROCK_MODEL_ID: '',
        AWS_BEDROCK_ALLOWED_MODEL_IDS: [],
      })
    })

    it('does not require Gemini configuration in gateway mode', () => {
      expect(validateEnv(gatewayEnv)).toMatchObject({
        COMPLETION_PROVIDER: 'aws-bedrock',
      })
    })

    // One placeholder policy across all three secrets: exactly the prefix the
    // committed example files use. Broader guesses matched nothing this
    // repository ships and would only reject a legitimate credential.
    it('applies the same placeholder prefix to every secret', () => {
      expect(() =>
        validateEnv({
          ...gatewayEnv,
          ITI_BEDROCK_GATEWAY_API_KEY: 'replace-with-a-rotated-gateway-key',
        }),
      ).toThrow(
        /ITI_BEDROCK_GATEWAY_API_KEY: must not use the placeholder gateway key/,
      )

      // Re-casing a committed example value is still that example value.
      expect(() =>
        validateEnv({
          ...validGeminiEnv,
          GEMINI_API_KEY: 'REPLACE-WITH-NEW-AI-STUDIO-AUTHORIZATION-KEY',
        }),
      ).toThrow(/GEMINI_API_KEY: must be a non-placeholder authorization key/)

      // Values the removed over-broad patterns used to reject are legitimate.
      for (const apiKey of [
        'your-organisation-issued-authorization-key',
        'changeme-is-a-real-prefix-of-this-key',
        'placeholder-shaped-but-genuine-api-key',
      ]) {
        expect(
          validateEnv({ ...validGeminiEnv, GEMINI_API_KEY: apiKey }),
        ).toMatchObject({ GEMINI_API_KEY: apiKey })
      }
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

    // The only environment rule that is genuinely load-bearing: the free tier
    // may use submitted inputs and outputs to improve Google's products, so
    // gemini must never serve real users.
    it('rejects Gemini in production', () => {
      expect(() =>
        validateEnv({ ...validGeminiEnv, NODE_ENV: 'production' }),
      ).toThrow(/COMPLETION_PROVIDER: gemini must not serve production traffic/)
    })

    // Regression for the control that used to be expressed as "development
    // only": forcing NODE_ENV away from production downgraded the whole
    // server's posture (non-Secure refresh cookie, unauthenticated Swagger,
    // relative PDF root) and broke every AppModule-booting e2e spec, which
    // runs under NODE_ENV=test.
    it.each(['development', 'test'] as const)(
      'accepts Gemini in %s without changing NODE_ENV',
      (nodeEnv) => {
        expect(
          validateEnv({ ...validGeminiEnv, NODE_ENV: nodeEnv }),
        ).toMatchObject({ NODE_ENV: nodeEnv, COMPLETION_PROVIDER: 'gemini' })
      },
    )

    it('requires an explicit demo acknowledgement to select Gemini', () => {
      const acknowledgement =
        /GEMINI_DEMO_ACKNOWLEDGED: must be true to select gemini/

      for (const value of ['false', '', undefined]) {
        const { GEMINI_DEMO_ACKNOWLEDGED: _omitted, ...withoutFlag } =
          validGeminiEnv
        const candidate =
          value === undefined
            ? withoutFlag
            : { ...withoutFlag, GEMINI_DEMO_ACKNOWLEDGED: value }

        expect(() => validateEnv(candidate)).toThrow(acknowledgement)
      }

      expect(validateEnv(validGeminiEnv)).toMatchObject({
        COMPLETION_PROVIDER: 'gemini',
        GEMINI_DEMO_ACKNOWLEDGED: true,
      })
    })

    // The acknowledgement is only about Gemini, so it must never block the
    // keyless default or the gateway.
    it('never requires the acknowledgement for another provider', () => {
      expect(validateEnv(validEnv)).toMatchObject({
        COMPLETION_PROVIDER: 'deterministic',
        GEMINI_DEMO_ACKNOWLEDGED: false,
      })
      expect(validateEnv(gatewayEnv)).toMatchObject({
        COMPLETION_PROVIDER: 'aws-bedrock',
      })
    })

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

  it('keeps deterministic startup keyless and requires a key only for the gateway', () => {
    const deterministicEnv = validateEnv({
      ...validEnv,
      COMPLETION_PROVIDER: 'deterministic',
    })
    expect(deterministicEnv).toMatchObject({
      COMPLETION_PROVIDER: 'deterministic',
    })
    expect(deterministicEnv).not.toHaveProperty('ITI_BEDROCK_GATEWAY_API_KEY')

    expect(() =>
      validateEnv({
        ...validEnv,
        COMPLETION_PROVIDER: 'aws-bedrock',
      }),
    ).toThrow(/ITI_BEDROCK_GATEWAY_API_KEY: is required for aws-bedrock/)
    expect(() =>
      validateEnv({
        ...validEnv,
        COMPLETION_PROVIDER: 'aws-bedrock',
        ITI_BEDROCK_GATEWAY_API_KEY: '   ',
      }),
    ).toThrow(/ITI_BEDROCK_GATEWAY_API_KEY: is required for aws-bedrock/)

    expect(
      validateEnv({
        ...validEnv,
        COMPLETION_PROVIDER: 'aws-bedrock',
        ITI_BEDROCK_GATEWAY_API_KEY: '<test-only-placeholder>',
        AWS_BEDROCK_MODEL_ID: 'openai.test-model-v1:0',
        AWS_BEDROCK_ALLOWED_MODEL_IDS: 'openai.test-model-v1:0',
      }),
    ).toMatchObject({
      COMPLETION_PROVIDER: 'aws-bedrock',
      ITI_BEDROCK_GATEWAY_API_KEY: '<test-only-placeholder>',
    })
  })

  // A key outside printable ASCII cannot be put in an `Authorization` header:
  // the Headers constructor throws, so every completion would fail opaquely.
  it.each([
    ['Arabic text', 'مفتاح'],
    ['a smart quote', 'key’value'],
    ['a non-breaking space', 'key\u00a0value'],
    ['an emoji', 'key-🔑'],
    ['a control character', 'key\nvalue'],
    ['a leading space', ' key'],
  ])('rejects a gateway key containing %s', (_, apiKey) => {
    expect(() =>
      validateEnv({ ...gatewayEnv, ITI_BEDROCK_GATEWAY_API_KEY: apiKey }),
    ).toThrow(/ITI_BEDROCK_GATEWAY_API_KEY: is required for aws-bedrock/)
  })

  it('treats a blank insecure-HTTP flag as disabled', () => {
    expect(
      validateEnv({ ...validEnv, ITI_BEDROCK_ALLOW_INSECURE_HTTP: '' }),
    ).toMatchObject({ ITI_BEDROCK_ALLOW_INSECURE_HTTP: false })
    expect(() =>
      validateEnv({ ...validEnv, ITI_BEDROCK_ALLOW_INSECURE_HTTP: 'yes' }),
    ).toThrow(/ITI_BEDROCK_ALLOW_INSECURE_HTTP:/)
  })

  it('accepts HTTPS without credentials, query, or fragment', () => {
    expect(
      validateEnv({
        ...gatewayEnv,
        ITI_BEDROCK_GATEWAY_BASE_URL:
          'https://gateway.example.test/custom/base/',
      }),
    ).toMatchObject({
      ITI_BEDROCK_GATEWAY_BASE_URL: 'https://gateway.example.test/custom/base/',
    })

    expect(() =>
      validateEnv({
        ...gatewayEnv,
        ITI_BEDROCK_GATEWAY_BASE_URL:
          'https://user:password@gateway.example.test/api/v1',
      }),
    ).toThrow(/ITI_BEDROCK_GATEWAY_BASE_URL:/)
    expect(() =>
      validateEnv({
        ...gatewayEnv,
        ITI_BEDROCK_GATEWAY_BASE_URL:
          'https://gateway.example.test/api/v1?secret=value',
      }),
    ).toThrow(/ITI_BEDROCK_GATEWAY_BASE_URL:/)
    expect(() =>
      validateEnv({
        ...gatewayEnv,
        ITI_BEDROCK_GATEWAY_BASE_URL:
          'https://gateway.example.test/api/v1#fragment',
      }),
    ).toThrow(/ITI_BEDROCK_GATEWAY_BASE_URL:/)
  })

  // A bare delimiter leaves `search`/`hash` empty while the serialization keeps
  // it, which would silently rewrite the appended `/student/chat` path.
  it.each([
    ['bare query delimiter', 'https://gateway.example.test/api/v1?'],
    ['bare fragment delimiter', 'https://gateway.example.test/api/v1#'],
    ['both bare delimiters', 'https://gateway.example.test/api/v1?#'],
  ])('rejects a base URL with a %s', (_, baseUrl) => {
    expect(() =>
      validateEnv({ ...gatewayEnv, ITI_BEDROCK_GATEWAY_BASE_URL: baseUrl }),
    ).toThrow(/ITI_BEDROCK_GATEWAY_BASE_URL:/)
  })

  // Defence in depth against a stale value pointing the bearer-authenticated
  // POST at the local host or a cloud metadata service.
  it.each([
    ['loopback IPv4', 'https://127.0.0.1/api/v1'],
    ['shorthand loopback IPv4', 'https://127.1/api/v1'],
    ['IPv4 metadata address', 'https://169.254.169.254/latest/meta-data'],
    ['private 10/8 address', 'https://10.0.0.5/api/v1'],
    ['private 172.16/12 address', 'https://172.20.10.1/api/v1'],
    ['private 192.168/16 address', 'https://192.168.1.10/api/v1'],
    ['unspecified IPv4 address', 'https://0.0.0.0/api/v1'],
    ['loopback IPv6', 'https://[::1]/api/v1'],
    ['unique-local IPv6', 'https://[fd00::1]/api/v1'],
    ['link-local IPv6', 'https://[fe80::1]/api/v1'],
    ['localhost', 'https://localhost/api/v1'],
    ['localhost subdomain', 'https://gateway.localhost/api/v1'],
  ])('rejects an HTTPS base URL addressing a %s', (_, baseUrl) => {
    expect(() =>
      validateEnv({ ...gatewayEnv, ITI_BEDROCK_GATEWAY_BASE_URL: baseUrl }),
    ).toThrow(/ITI_BEDROCK_GATEWAY_BASE_URL:/)
  })

  it('keeps the HTTPS base URL configurable for a public staging gateway', () => {
    expect(
      validateEnv({
        ...gatewayEnv,
        ITI_BEDROCK_GATEWAY_BASE_URL: 'https://203.0.113.10/api/v1',
      }),
    ).toMatchObject({
      ITI_BEDROCK_GATEWAY_BASE_URL: 'https://203.0.113.10/api/v1',
    })
    expect(
      validateEnv({
        ...gatewayEnv,
        ITI_BEDROCK_GATEWAY_BASE_URL: 'https://staging.gateway.example/api/v1',
      }),
    ).toMatchObject({
      ITI_BEDROCK_GATEWAY_BASE_URL: 'https://staging.gateway.example/api/v1',
    })
  })

  it('ignores an unusable gateway base URL when the gateway is not selected', () => {
    expect(
      validateEnv({
        ...validEnv,
        COMPLETION_PROVIDER: 'deterministic',
        ITI_BEDROCK_GATEWAY_BASE_URL: 'http://stale.example.test/api/v1',
      }),
    ).toMatchObject({
      COMPLETION_PROVIDER: 'deterministic',
      ITI_BEDROCK_GATEWAY_BASE_URL: 'http://stale.example.test/api/v1',
    })
  })

  it('allows HTTP only for the exact explicitly enabled ITI development endpoint', () => {
    const httpBase = {
      ...gatewayEnv,
      NODE_ENV: 'development',
      ITI_BEDROCK_ALLOW_INSECURE_HTTP: 'true',
      ITI_BEDROCK_GATEWAY_BASE_URL: 'http://apiaccess.iti.net.eg/api/v1',
    }
    expect(validateEnv(httpBase)).toMatchObject({
      ITI_BEDROCK_ALLOW_INSECURE_HTTP: true,
      ITI_BEDROCK_GATEWAY_BASE_URL: 'http://apiaccess.iti.net.eg/api/v1',
    })

    const invalidOverrides = [
      { ITI_BEDROCK_ALLOW_INSECURE_HTTP: 'false' },
      { NODE_ENV: 'production' },
      {
        ITI_BEDROCK_GATEWAY_BASE_URL: 'http://other.example.test/api/v1',
      },
      {
        ITI_BEDROCK_GATEWAY_BASE_URL: 'http://apiaccess.iti.net.eg/other',
      },
      {
        ITI_BEDROCK_GATEWAY_BASE_URL: 'http://apiaccess.iti.net.eg:8080/api/v1',
      },
      {
        ITI_BEDROCK_GATEWAY_BASE_URL:
          'http://user:password@apiaccess.iti.net.eg/api/v1',
      },
      {
        ITI_BEDROCK_GATEWAY_BASE_URL:
          'http://apiaccess.iti.net.eg/api/v1?query=value',
      },
      {
        ITI_BEDROCK_GATEWAY_BASE_URL:
          'http://apiaccess.iti.net.eg/api/v1#fragment',
      },
    ]
    for (const override of invalidOverrides) {
      expect(() => validateEnv({ ...httpBase, ...override })).toThrow(
        /ITI_BEDROCK_GATEWAY_BASE_URL:/,
      )
    }
  })

  it('requires an explicit locally allowed model for aws-bedrock', () => {
    const awsBedrockEnv = {
      ...validEnv,
      COMPLETION_PROVIDER: 'aws-bedrock',
      ITI_BEDROCK_GATEWAY_API_KEY: '<test-only-placeholder>',
    }
    expect(() => validateEnv(awsBedrockEnv)).toThrow(
      /AWS_BEDROCK_MODEL_ID: must be an explicit valid model ID/,
    )
    expect(() =>
      validateEnv({
        ...awsBedrockEnv,
        AWS_BEDROCK_MODEL_ID: 'openai.test-model-v1:0',
      }),
    ).toThrow(/AWS_BEDROCK_ALLOWED_MODEL_IDS: must contain at least one/)
    expect(() =>
      validateEnv({
        ...awsBedrockEnv,
        AWS_BEDROCK_MODEL_ID: 'openai.test-model-v1:0',
        AWS_BEDROCK_ALLOWED_MODEL_IDS: 'anthropic.other-model-v1:0',
      }),
    ).toThrow(/AWS_BEDROCK_MODEL_ID: must be present/)
  })

  it('parses a bounded comma-separated allow-list and rejects duplicates', () => {
    expect(
      validateEnv({
        ...validEnv,
        AWS_BEDROCK_ALLOWED_MODEL_IDS:
          'openai.first-v1:0, anthropic.second-v1:0',
      }),
    ).toMatchObject({
      AWS_BEDROCK_ALLOWED_MODEL_IDS: [
        'openai.first-v1:0',
        'anthropic.second-v1:0',
      ],
    })
    expect(() =>
      validateEnv({
        ...validEnv,
        AWS_BEDROCK_ALLOWED_MODEL_IDS:
          'openai.duplicate-v1:0,openai.duplicate-v1:0',
      }),
    ).toThrow(/AWS_BEDROCK_ALLOWED_MODEL_IDS: must not contain duplicate/)
    expect(() =>
      validateEnv({
        ...validEnv,
        AWS_BEDROCK_ALLOWED_MODEL_IDS: Array.from(
          { length: MAX_AWS_BEDROCK_ALLOWED_MODEL_IDS + 1 },
          (_, index) => `test.model-${String(index)}`,
        ).join(','),
      }),
    ).toThrow(/AWS_BEDROCK_ALLOWED_MODEL_IDS: must contain at most/)
  })

  it('accepts model overrides and bounds max tokens', () => {
    const configured = validateEnv({
      ...validEnv,
      AWS_BEDROCK_MODEL_ID: 'global.anthropic.approved-model-v1:0',
      AWS_BEDROCK_MAX_TOKENS: String(MAX_AWS_BEDROCK_MAX_TOKENS),
    })

    expect(configured).toMatchObject({
      AWS_BEDROCK_MODEL_ID: 'global.anthropic.approved-model-v1:0',
      AWS_BEDROCK_MAX_TOKENS: MAX_AWS_BEDROCK_MAX_TOKENS,
    })

    for (const invalidTokens of [
      String(MIN_AWS_BEDROCK_MAX_TOKENS - 1),
      '1.5',
      String(MAX_AWS_BEDROCK_MAX_TOKENS + 1),
      'many',
    ]) {
      expect(() =>
        validateEnv({ ...validEnv, AWS_BEDROCK_MAX_TOKENS: invalidTokens }),
      ).toThrow(/AWS_BEDROCK_MAX_TOKENS:/)
    }
    expect(() =>
      validateEnv({
        ...validEnv,
        COMPLETION_PROVIDER: 'aws-bedrock',
        ITI_BEDROCK_GATEWAY_API_KEY: '<test-only-placeholder>',
        AWS_BEDROCK_MODEL_ID: 'invalid/model',
        AWS_BEDROCK_ALLOWED_MODEL_IDS: 'invalid/model',
      }),
    ).toThrow(/AWS_BEDROCK_/)
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
