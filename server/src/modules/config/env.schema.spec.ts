import {
  DEFAULT_ANALYSIS_MODEL_BASE_URL,
  DEFAULT_ANALYSIS_MODEL_NAME,
} from '../tutoring/socratic-workflow/analysis-model.configuration'
import {
  DEFAULT_SEMANTIC_GUARD_BASE_URL,
  DEFAULT_SEMANTIC_GUARD_MODEL_NAME,
} from '../tutoring/socratic-workflow/semantic-guard.configuration'
import {
  DEFAULT_TUTOR_MODEL_BASE_URL,
  DEFAULT_TUTOR_MODEL_NAME,
} from '../tutoring/socratic-workflow/tutor-model.configuration'
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
    TUTORING_REQUEST_TIMEOUT_MS: 120_000,
    AUTH_ACCESS_TOKEN_SECRET:
      'test-access-token-secret-with-at-least-32-characters',
    AUTH_REFRESH_TOKEN_HASH_SECRET:
      'test-refresh-token-hash-secret-with-at-least-32-characters',
  }

  it('coerces supported values and applies final-architecture defaults', () => {
    expect(validateEnv(validEnv)).toMatchObject({
      NODE_ENV: 'test',
      PORT: 4000,
      CLIENT_ORIGIN: 'http://localhost:3000',
      DATABASE_URL:
        'postgresql://morshid:morshid_local_password@localhost:5432/morshid',
      REDIS_URL: 'redis://localhost:6379',
      PDF_STORAGE_PATH: '../storage/pdfs',
      PDF_MAX_UPLOAD_BYTES: MAX_PDF_UPLOAD_BYTES,
      TUTORING_REQUEST_TIMEOUT_MS: 120_000,
      AUTH_ACCESS_TOKEN_TTL_SECONDS: 900,
      AUTH_REFRESH_TOKEN_TTL_DAYS: 7,
      EMBEDDING_PROVIDER: 'deterministic',
      ANALYSIS_MODEL_PROVIDER: 'deterministic',
      ANALYSIS_MODEL_BASE_URL: DEFAULT_ANALYSIS_MODEL_BASE_URL,
      ANALYSIS_MODEL_NAME: DEFAULT_ANALYSIS_MODEL_NAME,
      ANALYSIS_MODEL_API_KEY: '',
      ANALYSIS_MODEL_TIMEOUT_MS: 30_000,
      ANALYSIS_MODEL_MAX_COMPLETION_TOKENS: 768,
      ANALYSIS_CONFIDENCE_THRESHOLD: 0.6,
      ANALYSIS_MODEL_MAX_RETRIES: 1,
      TUTOR_MODEL_PROVIDER: 'deterministic',
      TUTOR_MODEL_BASE_URL: DEFAULT_TUTOR_MODEL_BASE_URL,
      TUTOR_MODEL_NAME: DEFAULT_TUTOR_MODEL_NAME,
      TUTOR_MODEL_API_KEY: '',
      TUTOR_MODEL_TIMEOUT_MS: 30_000,
      TUTOR_MODEL_MAX_COMPLETION_TOKENS: 768,
      TUTOR_MODEL_MAX_INFRASTRUCTURE_RETRIES: 1,
      SEMANTIC_GUARD_PROVIDER: 'deterministic',
      SEMANTIC_GUARD_BASE_URL: DEFAULT_SEMANTIC_GUARD_BASE_URL,
      SEMANTIC_GUARD_MODEL_NAME: DEFAULT_SEMANTIC_GUARD_MODEL_NAME,
      SEMANTIC_GUARD_API_KEY: '',
      SEMANTIC_GUARD_TIMEOUT_MS: 30_000,
      SEMANTIC_GUARD_MAX_COMPLETION_TOKENS: 256,
      GEMINI_EMBEDDING_DEMO_ACKNOWLEDGED: false,
      RETRIEVAL_TOP_K: 5,
      RETRIEVAL_MIN_SIMILARITY: 0.62,
    })
  })

  it('validates independent model budgets', () => {
    expect(
      validateEnv({
        ...validEnv,
        ANALYSIS_MODEL_MAX_COMPLETION_TOKENS: '1024',
        TUTOR_MODEL_MAX_COMPLETION_TOKENS: '1024',
        SEMANTIC_GUARD_MAX_COMPLETION_TOKENS: '512',
      }),
    ).toMatchObject({
      ANALYSIS_MODEL_MAX_COMPLETION_TOKENS: 1024,
      TUTOR_MODEL_MAX_COMPLETION_TOKENS: 1024,
      SEMANTIC_GUARD_MAX_COMPLETION_TOKENS: 512,
    })

    expect(() =>
      validateEnv({ ...validEnv, ANALYSIS_MODEL_MAX_COMPLETION_TOKENS: '63' }),
    ).toThrow(/ANALYSIS_MODEL_MAX_COMPLETION_TOKENS/)
    expect(() =>
      validateEnv({ ...validEnv, TUTOR_MODEL_MAX_COMPLETION_TOKENS: '2049' }),
    ).toThrow(/TUTOR_MODEL_MAX_COMPLETION_TOKENS/)
    expect(() =>
      validateEnv({
        ...validEnv,
        SEMANTIC_GUARD_MAX_COMPLETION_TOKENS: '1025',
      }),
    ).toThrow(/SEMANTIC_GUARD_MAX_COMPLETION_TOKENS/)
  })

  it('requires safe, distinct live model roles', () => {
    expect(() =>
      validateEnv({
        ...validEnv,
        ANALYSIS_MODEL_PROVIDER: 'openai-compatible',
        ANALYSIS_MODEL_BASE_URL: 'https://models.example.test/v1',
        ANALYSIS_MODEL_NAME: 'analysis-model',
        TUTOR_MODEL_PROVIDER: 'openai-compatible',
        TUTOR_MODEL_BASE_URL: 'https://models.example.test/v1',
        TUTOR_MODEL_NAME: 'tutor-model',
        SEMANTIC_GUARD_PROVIDER: 'openai-compatible',
        SEMANTIC_GUARD_BASE_URL: 'https://models.example.test/v1',
        SEMANTIC_GUARD_MODEL_NAME: 'guard-model',
        ANALYSIS_MODEL_API_KEY: 'replace-with-analysis-key',
      }),
    ).toThrow(/ANALYSIS_MODEL_API_KEY/)

    expect(() =>
      validateEnv({
        ...validEnv,
        ANALYSIS_MODEL_PROVIDER: 'openai-compatible',
        ANALYSIS_MODEL_BASE_URL: 'https://models.example.test/v1',
        ANALYSIS_MODEL_NAME: 'same-model',
        TUTOR_MODEL_PROVIDER: 'openai-compatible',
        TUTOR_MODEL_BASE_URL: 'https://models.example.test/v1',
        TUTOR_MODEL_NAME: 'same-model',
      }),
    ).toThrow(/TUTOR_MODEL_NAME/)
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

  it('requires an absolute PDF storage path in production', () => {
    expect(() =>
      validateEnv({
        ...validEnv,
        NODE_ENV: 'production',
        PDF_STORAGE_PATH: '../storage/pdfs',
        ANALYSIS_MODEL_PROVIDER: 'openai-compatible',
        ANALYSIS_MODEL_BASE_URL: 'https://models.example.test/v1',
        ANALYSIS_MODEL_NAME: 'analysis-model',
        TUTOR_MODEL_PROVIDER: 'openai-compatible',
        TUTOR_MODEL_BASE_URL: 'https://models.example.test/v1',
        TUTOR_MODEL_NAME: 'tutor-model',
        SEMANTIC_GUARD_PROVIDER: 'openai-compatible',
        SEMANTIC_GUARD_BASE_URL: 'https://models.example.test/v1',
        SEMANTIC_GUARD_MODEL_NAME: 'guard-model',
      }),
    ).toThrow(/PDF_STORAGE_PATH/)
  })
})
