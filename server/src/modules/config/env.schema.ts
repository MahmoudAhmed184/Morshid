import { isAbsolute } from 'node:path'

import { z } from 'zod'

import {
  DEFAULT_EMBEDDING_DOCUMENT_TIMEOUT_MS,
  DEFAULT_EMBEDDING_QUERY_TIMEOUT_MS,
  DEFAULT_EMBEDDING_REQUEST_TIMEOUT_MS,
  DETERMINISTIC_EMBEDDING_PROVIDER,
  GEMINI_EMBEDDING_PROVIDER,
  MAX_EMBEDDING_DOCUMENT_TIMEOUT_MS,
  MAX_EMBEDDING_QUERY_TIMEOUT_MS,
  MAX_EMBEDDING_REQUEST_TIMEOUT_MS,
  MAX_GEMINI_EMBEDDING_API_KEY_LENGTH,
  MAX_GEMINI_EMBEDDING_QUOTA_PROJECT_ID_LENGTH,
  isValidGeminiEmbeddingQuotaProjectId,
} from '../embedding/embedding-configuration'
import { MAX_PDF_OBJECT_BYTES } from '../pdf-storage/pdf-storage'
import {
  DEFAULT_TUTORING_REQUEST_TIMEOUT_MS,
  MAX_TUTORING_REQUEST_TIMEOUT_MS,
} from '../../common/http/request-deadline'
import {
  DEFAULT_ANALYSIS_CONFIDENCE_THRESHOLD,
  isValidConfidenceThreshold,
} from '../tutoring/socratic-workflow/analysis-confidence-policy'
import {
  DEFAULT_ANALYSIS_MODEL_MAX_RETRIES,
  MAX_ANALYSIS_MODEL_MAX_RETRIES,
} from '../tutoring/socratic-workflow/analysis-retry-policy'
import {
  DEFAULT_ANALYSIS_MODEL_BASE_URL,
  DEFAULT_ANALYSIS_MODEL_MAX_COMPLETION_TOKENS,
  DEFAULT_ANALYSIS_MODEL_NAME,
  DEFAULT_ANALYSIS_MODEL_TIMEOUT_MS,
  DETERMINISTIC_ANALYSIS_MODEL_PROVIDER,
  MAX_ANALYSIS_MODEL_API_KEY_LENGTH,
  MAX_ANALYSIS_MODEL_BASE_URL_LENGTH,
  MAX_ANALYSIS_MODEL_MAX_COMPLETION_TOKENS,
  MAX_ANALYSIS_MODEL_NAME_LENGTH,
  MAX_ANALYSIS_MODEL_TIMEOUT_MS,
  MIN_ANALYSIS_MODEL_MAX_COMPLETION_TOKENS,
  OPENAI_COMPATIBLE_ANALYSIS_MODEL_PROVIDER,
  isValidAnalysisModelName,
  isValidOptionalAnalysisApiKey,
  normalizeOpenAICompatibleBaseUrl,
} from '../tutoring/socratic-workflow/analysis-model.configuration'
import {
  DEFAULT_TUTOR_MODEL_MAX_INFRASTRUCTURE_RETRIES,
  MAX_TUTOR_MODEL_MAX_INFRASTRUCTURE_RETRIES,
} from '../tutoring/socratic-workflow/tutor-infrastructure-retry.policy'
import {
  DEFAULT_TUTOR_MODEL_BASE_URL,
  DEFAULT_TUTOR_MODEL_MAX_COMPLETION_TOKENS,
  DEFAULT_TUTOR_MODEL_NAME,
  DEFAULT_TUTOR_MODEL_TIMEOUT_MS,
  DETERMINISTIC_TUTOR_MODEL_PROVIDER,
  MAX_TUTOR_MODEL_API_KEY_LENGTH,
  MAX_TUTOR_MODEL_BASE_URL_LENGTH,
  MAX_TUTOR_MODEL_MAX_COMPLETION_TOKENS,
  MAX_TUTOR_MODEL_NAME_LENGTH,
  MAX_TUTOR_MODEL_TIMEOUT_MS,
  MIN_TUTOR_MODEL_MAX_COMPLETION_TOKENS,
  OPENAI_COMPATIBLE_TUTOR_MODEL_PROVIDER,
  isValidOptionalTutorApiKey,
  isValidTutorModelName,
} from '../tutoring/socratic-workflow/tutor-model.configuration'
import {
  DEFAULT_SEMANTIC_GUARD_BASE_URL,
  DEFAULT_SEMANTIC_GUARD_MAX_COMPLETION_TOKENS,
  DEFAULT_SEMANTIC_GUARD_MODEL_NAME,
  DEFAULT_SEMANTIC_GUARD_TIMEOUT_MS,
  DETERMINISTIC_SEMANTIC_GUARD_PROVIDER,
  MAX_SEMANTIC_GUARD_API_KEY_LENGTH,
  MAX_SEMANTIC_GUARD_BASE_URL_LENGTH,
  MAX_SEMANTIC_GUARD_MAX_COMPLETION_TOKENS,
  MAX_SEMANTIC_GUARD_MODEL_NAME_LENGTH,
  MAX_SEMANTIC_GUARD_TIMEOUT_MS,
  MIN_SEMANTIC_GUARD_MAX_COMPLETION_TOKENS,
  OPENAI_COMPATIBLE_SEMANTIC_GUARD_PROVIDER,
  isValidOptionalSemanticGuardApiKey,
  isValidSemanticGuardModelName,
} from '../tutoring/socratic-workflow/semantic-guard.configuration'

// The one placeholder policy for every secret this schema accepts, so a fresh
// checkout cannot boot with a publicly known value. It is exactly the prefix the
// committed `.env.example` files use; broader guesses (`your-`, `changeme`,
// `placeholder`) match nothing this repository ships and would only reject a
// legitimate credential that happens to start with one of them.
const SECRET_PLACEHOLDER_PREFIX = 'replace-with'
const GEMINI_EMBEDDING_QUOTA_KEYS = [
  'GEMINI_EMBEDDING_REQUESTS_PER_MINUTE',
  'GEMINI_EMBEDDING_INPUT_TOKENS_PER_MINUTE',
  'GEMINI_EMBEDDING_REQUESTS_PER_DAY',
  'GEMINI_EMBEDDING_LOCAL_REQUESTS_PER_HOUR',
  'GEMINI_EMBEDDING_LOCAL_REQUESTS_PER_30_DAYS',
] as const
// `.env.example` ships these blank and Compose passes an unset variable through
// as `${VAR:-}`, so a blank value must mean "not configured" rather than
// "configured with an empty string". Without this, a fresh checkout copying the
// example file fails to boot with `expected string to have >=20 characters`
// instead of the provider gate's actual "is required when ..." message — and a
// blank numeric would coerce to 0 and be rejected as non-positive.
function blankAsUndefined(value: unknown): unknown {
  return typeof value === 'string' && value.trim() === '' ? undefined : value
}

const PDF_UPLOAD_OPERATIONAL_CEILING_BYTES = 10 * 1024 * 1024
export const MAX_PDF_UPLOAD_BYTES = Math.min(
  PDF_UPLOAD_OPERATIONAL_CEILING_BYTES,
  MAX_PDF_OBJECT_BYTES,
)
export const DEFAULT_PDF_MAX_UPLOAD_BYTES = MAX_PDF_UPLOAD_BYTES

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
    CLIENT_ORIGIN: z.url().default('http://localhost:3000'),
    DATABASE_URL: z.url().startsWith('postgresql://'),
    REDIS_URL: z.url().startsWith('redis://'),
    PDF_STORAGE_PATH: z.string().trim().min(1),
    PDF_MAX_UPLOAD_BYTES: z.coerce
      .number()
      .int()
      .positive()
      .max(MAX_PDF_UPLOAD_BYTES)
      .default(DEFAULT_PDF_MAX_UPLOAD_BYTES),
    TUTORING_REQUEST_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .positive()
      .max(MAX_TUTORING_REQUEST_TIMEOUT_MS)
      .default(DEFAULT_TUTORING_REQUEST_TIMEOUT_MS),
    // Only providers with a wired implementation are accepted so the factory
    // never has to reject a configured-but-unimplemented provider at runtime.
    // The deterministic default keeps CI and local work keyless and offline.
    EMBEDDING_PROVIDER: z
      .enum([DETERMINISTIC_EMBEDDING_PROVIDER, GEMINI_EMBEDDING_PROVIDER])
      .default(DETERMINISTIC_EMBEDDING_PROVIDER),
    // Three budgets rather than one: an interactive chat turn embeds a single
    // query and must fail fast, while a PDF ingest embeds hundreds of chunks
    // across many sub-requests and legitimately takes far longer. One shared
    // value would either abort ingests that were working or leave a student
    // waiting on a dead provider. The per-request budget is additionally capped
    // by whatever remains of the whole-call budget, so the last sub-request of
    // a long ingest cannot outlive the ingest's own deadline.
    EMBEDDING_QUERY_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .positive()
      .max(MAX_EMBEDDING_QUERY_TIMEOUT_MS)
      .default(DEFAULT_EMBEDDING_QUERY_TIMEOUT_MS),
    EMBEDDING_DOCUMENT_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .positive()
      .max(MAX_EMBEDDING_DOCUMENT_TIMEOUT_MS)
      .default(DEFAULT_EMBEDDING_DOCUMENT_TIMEOUT_MS),
    EMBEDDING_REQUEST_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .positive()
      .max(MAX_EMBEDDING_REQUEST_TIMEOUT_MS)
      .default(DEFAULT_EMBEDDING_REQUEST_TIMEOUT_MS),
    ANALYSIS_MODEL_PROVIDER: z
      .enum([
        DETERMINISTIC_ANALYSIS_MODEL_PROVIDER,
        OPENAI_COMPATIBLE_ANALYSIS_MODEL_PROVIDER,
      ])
      .default(DETERMINISTIC_ANALYSIS_MODEL_PROVIDER),
    ANALYSIS_MODEL_BASE_URL: z
      .string()
      .trim()
      .max(MAX_ANALYSIS_MODEL_BASE_URL_LENGTH)
      .default(DEFAULT_ANALYSIS_MODEL_BASE_URL),
    ANALYSIS_MODEL_NAME: z
      .string()
      .trim()
      .max(MAX_ANALYSIS_MODEL_NAME_LENGTH)
      .refine(isValidAnalysisModelName, 'must be a valid model name')
      .default(DEFAULT_ANALYSIS_MODEL_NAME),
    ANALYSIS_MODEL_API_KEY: z.preprocess(
      blankAsUndefined,
      z
        .string()
        .max(MAX_ANALYSIS_MODEL_API_KEY_LENGTH)
        .refine(
          isValidOptionalAnalysisApiKey,
          'must be blank or a printable API key without whitespace',
        )
        .default(''),
    ),
    ANALYSIS_MODEL_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .positive()
      .max(MAX_ANALYSIS_MODEL_TIMEOUT_MS)
      .default(DEFAULT_ANALYSIS_MODEL_TIMEOUT_MS),
    ANALYSIS_MODEL_MAX_COMPLETION_TOKENS: z.coerce
      .number()
      .int()
      .min(MIN_ANALYSIS_MODEL_MAX_COMPLETION_TOKENS)
      .max(MAX_ANALYSIS_MODEL_MAX_COMPLETION_TOKENS)
      .default(DEFAULT_ANALYSIS_MODEL_MAX_COMPLETION_TOKENS),
    ANALYSIS_CONFIDENCE_THRESHOLD: z.coerce
      .number()
      .refine(
        isValidConfidenceThreshold,
        'must be a confidence threshold between 0 and 1',
      )
      .default(DEFAULT_ANALYSIS_CONFIDENCE_THRESHOLD),
    ANALYSIS_MODEL_MAX_RETRIES: z.coerce
      .number()
      .int()
      .min(0)
      .max(MAX_ANALYSIS_MODEL_MAX_RETRIES)
      .default(DEFAULT_ANALYSIS_MODEL_MAX_RETRIES),
    TUTOR_MODEL_PROVIDER: z
      .enum([
        DETERMINISTIC_TUTOR_MODEL_PROVIDER,
        OPENAI_COMPATIBLE_TUTOR_MODEL_PROVIDER,
      ])
      .default(DETERMINISTIC_TUTOR_MODEL_PROVIDER),
    TUTOR_MODEL_BASE_URL: z
      .string()
      .trim()
      .max(MAX_TUTOR_MODEL_BASE_URL_LENGTH)
      .default(DEFAULT_TUTOR_MODEL_BASE_URL),
    TUTOR_MODEL_NAME: z
      .string()
      .trim()
      .max(MAX_TUTOR_MODEL_NAME_LENGTH)
      .refine(isValidTutorModelName, 'must be a valid model name')
      .default(DEFAULT_TUTOR_MODEL_NAME),
    TUTOR_MODEL_API_KEY: z.preprocess(
      blankAsUndefined,
      z
        .string()
        .max(MAX_TUTOR_MODEL_API_KEY_LENGTH)
        .refine(
          isValidOptionalTutorApiKey,
          'must be blank or a printable API key without whitespace',
        )
        .default(''),
    ),
    TUTOR_MODEL_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .positive()
      .max(MAX_TUTOR_MODEL_TIMEOUT_MS)
      .default(DEFAULT_TUTOR_MODEL_TIMEOUT_MS),
    TUTOR_MODEL_MAX_COMPLETION_TOKENS: z.coerce
      .number()
      .int()
      .min(MIN_TUTOR_MODEL_MAX_COMPLETION_TOKENS)
      .max(MAX_TUTOR_MODEL_MAX_COMPLETION_TOKENS)
      .default(DEFAULT_TUTOR_MODEL_MAX_COMPLETION_TOKENS),
    TUTOR_MODEL_MAX_INFRASTRUCTURE_RETRIES: z.coerce
      .number()
      .int()
      .min(0)
      .max(MAX_TUTOR_MODEL_MAX_INFRASTRUCTURE_RETRIES)
      .default(DEFAULT_TUTOR_MODEL_MAX_INFRASTRUCTURE_RETRIES),
    SEMANTIC_GUARD_PROVIDER: z
      .enum([
        DETERMINISTIC_SEMANTIC_GUARD_PROVIDER,
        OPENAI_COMPATIBLE_SEMANTIC_GUARD_PROVIDER,
      ])
      .default(DETERMINISTIC_SEMANTIC_GUARD_PROVIDER),
    SEMANTIC_GUARD_BASE_URL: z
      .string()
      .trim()
      .max(MAX_SEMANTIC_GUARD_BASE_URL_LENGTH)
      .default(DEFAULT_SEMANTIC_GUARD_BASE_URL),
    SEMANTIC_GUARD_MODEL_NAME: z
      .string()
      .trim()
      .max(MAX_SEMANTIC_GUARD_MODEL_NAME_LENGTH)
      .refine(isValidSemanticGuardModelName, 'must be a valid model name')
      .default(DEFAULT_SEMANTIC_GUARD_MODEL_NAME),
    SEMANTIC_GUARD_API_KEY: z.preprocess(
      blankAsUndefined,
      z
        .string()
        .max(MAX_SEMANTIC_GUARD_API_KEY_LENGTH)
        .refine(
          isValidOptionalSemanticGuardApiKey,
          'must be blank or a printable API key without whitespace',
        )
        .default(''),
    ),
    SEMANTIC_GUARD_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .positive()
      .max(MAX_SEMANTIC_GUARD_TIMEOUT_MS)
      .default(DEFAULT_SEMANTIC_GUARD_TIMEOUT_MS),
    SEMANTIC_GUARD_MAX_COMPLETION_TOKENS: z.coerce
      .number()
      .int()
      .min(MIN_SEMANTIC_GUARD_MAX_COMPLETION_TOKENS)
      .max(MAX_SEMANTIC_GUARD_MAX_COMPLETION_TOKENS)
      .default(DEFAULT_SEMANTIC_GUARD_MAX_COMPLETION_TOKENS),
    // A dedicated key under a separate Google Cloud project. Gemini rate limits
    // are per project, so a shared key would let one PDF ingest starve student
    // chat. The embedding model is part of the persisted document profile.
    GEMINI_EMBEDDING_API_KEY: z.preprocess(
      blankAsUndefined,
      z
        .string()
        .trim()
        .min(20)
        .max(MAX_GEMINI_EMBEDDING_API_KEY_LENGTH)
        .optional(),
    ),
    // An opaque deployment label (e.g. `embedding-project-01`), NOT the real
    // Google project name. Every replica on one Google project shares the
    // label, so they share one budget; a credential rotation never changes it,
    // so a rotation never mints a fresh day or month window.
    GEMINI_EMBEDDING_QUOTA_PROJECT_ID: z.preprocess(
      blankAsUndefined,
      z
        .string()
        .trim()
        .max(MAX_GEMINI_EMBEDDING_QUOTA_PROJECT_ID_LENGTH)
        .optional(),
    ),
    GEMINI_EMBEDDING_DEMO_ACKNOWLEDGED: z
      .union([z.boolean(), z.enum(['true', 'false', ''])])
      .default(false)
      .transform((value) => value === true || value === 'true'),
    // Provider-informed caps.
    GEMINI_EMBEDDING_REQUESTS_PER_MINUTE: z.preprocess(
      blankAsUndefined,
      z.coerce.number().int().positive().optional(),
    ),
    GEMINI_EMBEDDING_INPUT_TOKENS_PER_MINUTE: z.preprocess(
      blankAsUndefined,
      z.coerce.number().int().positive().optional(),
    ),
    GEMINI_EMBEDDING_REQUESTS_PER_DAY: z.preprocess(
      blankAsUndefined,
      z.coerce.number().int().positive().optional(),
    ),
    // Morshid-owned policy caps with no provider counterpart at all.
    GEMINI_EMBEDDING_LOCAL_REQUESTS_PER_HOUR: z.preprocess(
      blankAsUndefined,
      z.coerce.number().int().positive().optional(),
    ),
    GEMINI_EMBEDDING_LOCAL_REQUESTS_PER_30_DAYS: z.preprocess(
      blankAsUndefined,
      z.coerce.number().int().positive().optional(),
    ),
    // Retrieval knobs are validated configuration, never caller input: the
    // repository/service signatures expose no limit or threshold parameters.
    // Calibrated against the Python MVP corpus after the retrieval-threshold
    // diagnostic showed relevant Gemini matches below the previous 0.70 floor.
    RETRIEVAL_TOP_K: z.coerce.number().int().min(1).max(50).default(5),
    RETRIEVAL_MIN_SIMILARITY: z.coerce.number().min(0).max(1).default(0.62),
    AUTH_ACCESS_TOKEN_SECRET: z.string().min(32),
    AUTH_REFRESH_TOKEN_HASH_SECRET: z.string().min(32),
    AUTH_ACCESS_TOKEN_TTL_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(900),
    AUTH_REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  })
  .superRefine((env, ctx) => {
    for (const key of [
      'AUTH_ACCESS_TOKEN_SECRET',
      'AUTH_REFRESH_TOKEN_HASH_SECRET',
    ] as const) {
      if (isPlaceholderSecret(env[key])) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message:
            'must not use the placeholder secret; set a unique random value with at least 32 characters',
        })
      }
    }

    if (env.AUTH_ACCESS_TOKEN_SECRET === env.AUTH_REFRESH_TOKEN_HASH_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['AUTH_REFRESH_TOKEN_HASH_SECRET'],
        message:
          'must differ from AUTH_ACCESS_TOKEN_SECRET so the access and refresh secrets are independent',
      })
    }

    if (
      env.ANALYSIS_MODEL_PROVIDER === OPENAI_COMPATIBLE_ANALYSIS_MODEL_PROVIDER
    ) {
      try {
        normalizeOpenAICompatibleBaseUrl(env.ANALYSIS_MODEL_BASE_URL)
      } catch {
        ctx.addIssue({
          code: 'custom',
          path: ['ANALYSIS_MODEL_BASE_URL'],
          message:
            'must be HTTP localhost or HTTPS without credentials, query, or fragment',
        })
      }

      if (
        env.ANALYSIS_MODEL_API_KEY !== '' &&
        isPlaceholderSecret(env.ANALYSIS_MODEL_API_KEY)
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['ANALYSIS_MODEL_API_KEY'],
          message: 'must not use a placeholder analysis model key',
        })
      }
    }

    if (env.TUTOR_MODEL_PROVIDER === OPENAI_COMPATIBLE_TUTOR_MODEL_PROVIDER) {
      try {
        normalizeOpenAICompatibleBaseUrl(env.TUTOR_MODEL_BASE_URL)
      } catch {
        ctx.addIssue({
          code: 'custom',
          path: ['TUTOR_MODEL_BASE_URL'],
          message:
            'must be HTTP localhost or HTTPS without credentials, query, or fragment',
        })
      }

      if (
        env.TUTOR_MODEL_API_KEY !== '' &&
        isPlaceholderSecret(env.TUTOR_MODEL_API_KEY)
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['TUTOR_MODEL_API_KEY'],
          message: 'must not use a placeholder tutor model key',
        })
      }
    }

    if (
      env.SEMANTIC_GUARD_PROVIDER === OPENAI_COMPATIBLE_SEMANTIC_GUARD_PROVIDER
    ) {
      try {
        normalizeOpenAICompatibleBaseUrl(env.SEMANTIC_GUARD_BASE_URL)
      } catch {
        ctx.addIssue({
          code: 'custom',
          path: ['SEMANTIC_GUARD_BASE_URL'],
          message:
            'must be HTTP localhost or HTTPS without credentials, query, or fragment',
        })
      }

      if (
        env.SEMANTIC_GUARD_API_KEY !== '' &&
        isPlaceholderSecret(env.SEMANTIC_GUARD_API_KEY)
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['SEMANTIC_GUARD_API_KEY'],
          message: 'must not use a placeholder semantic guard key',
        })
      }
    }

    if (
      env.NODE_ENV === 'production' &&
      env.SEMANTIC_GUARD_PROVIDER === DETERMINISTIC_SEMANTIC_GUARD_PROVIDER
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['SEMANTIC_GUARD_PROVIDER'],
        message:
          'deterministic is restricted to tests and local development; production requires an independent semantic guard model',
      })
    }

    const productionDeterministicProviders = [
      [
        'ANALYSIS_MODEL_PROVIDER',
        env.ANALYSIS_MODEL_PROVIDER,
        DETERMINISTIC_ANALYSIS_MODEL_PROVIDER,
        'analysis model',
      ],
      [
        'TUTOR_MODEL_PROVIDER',
        env.TUTOR_MODEL_PROVIDER,
        DETERMINISTIC_TUTOR_MODEL_PROVIDER,
        'tutor model',
      ],
    ] as const
    if (env.NODE_ENV === 'production') {
      for (const [
        path,
        provider,
        deterministicProvider,
        role,
      ] of productionDeterministicProviders) {
        if (provider === deterministicProvider) {
          ctx.addIssue({
            code: 'custom',
            path: [path],
            message: `deterministic is restricted to tests and local development; production requires a live ${role} provider`,
          })
        }
      }
    }

    if (
      env.ANALYSIS_MODEL_PROVIDER ===
        OPENAI_COMPATIBLE_ANALYSIS_MODEL_PROVIDER &&
      env.TUTOR_MODEL_PROVIDER === OPENAI_COMPATIBLE_TUTOR_MODEL_PROVIDER &&
      env.ANALYSIS_MODEL_NAME === env.TUTOR_MODEL_NAME
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['TUTOR_MODEL_NAME'],
        message:
          'must differ from ANALYSIS_MODEL_NAME so tutor and analysis model roles cannot alias the same production model identifier',
      })
    }

    if (
      env.SEMANTIC_GUARD_PROVIDER ===
        OPENAI_COMPATIBLE_SEMANTIC_GUARD_PROVIDER &&
      env.ANALYSIS_MODEL_PROVIDER ===
        OPENAI_COMPATIBLE_ANALYSIS_MODEL_PROVIDER &&
      env.SEMANTIC_GUARD_MODEL_NAME === env.ANALYSIS_MODEL_NAME
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['SEMANTIC_GUARD_MODEL_NAME'],
        message:
          'must differ from ANALYSIS_MODEL_NAME so semantic guard and analysis roles cannot alias the same production model identifier',
      })
    }

    if (
      env.SEMANTIC_GUARD_PROVIDER ===
        OPENAI_COMPATIBLE_SEMANTIC_GUARD_PROVIDER &&
      env.TUTOR_MODEL_PROVIDER === OPENAI_COMPATIBLE_TUTOR_MODEL_PROVIDER &&
      env.SEMANTIC_GUARD_MODEL_NAME === env.TUTOR_MODEL_NAME
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['SEMANTIC_GUARD_MODEL_NAME'],
        message:
          'must differ from TUTOR_MODEL_NAME so semantic guard and tutor roles cannot alias the same production model identifier',
      })
    }

    // Selecting one live provider must never demand another provider's
    // configuration.
    if (env.EMBEDDING_PROVIDER === GEMINI_EMBEDDING_PROVIDER) {
      // Morshid's free-tier data-governance policy, not an API constraint: the
      // Gemini free tier lets Google use submitted inputs to improve its
      // products, and course material is not ours to donate. Deliberately NOT
      // expressed as "development only" — that would force NODE_ENV away from
      // production for its unrelated side effects.
      if (env.NODE_ENV === 'production') {
        ctx.addIssue({
          code: 'custom',
          path: ['EMBEDDING_PROVIDER'],
          message:
            'gemini must not embed production material: free-tier inputs may be used to improve Google products',
        })
      }

      if (!env.GEMINI_EMBEDDING_DEMO_ACKNOWLEDGED) {
        ctx.addIssue({
          code: 'custom',
          path: ['GEMINI_EMBEDDING_DEMO_ACKNOWLEDGED'],
          message:
            'must be true to select gemini embedding, acknowledging that free-tier inputs may be used to improve Google products and that only synthetic, permission-safe material may be embedded',
        })
      }

      if (env.GEMINI_EMBEDDING_API_KEY === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['GEMINI_EMBEDDING_API_KEY'],
          message: 'is required when EMBEDDING_PROVIDER is gemini',
        })
      } else if (isPlaceholderSecret(env.GEMINI_EMBEDDING_API_KEY)) {
        ctx.addIssue({
          code: 'custom',
          path: ['GEMINI_EMBEDDING_API_KEY'],
          message: 'must be a non-placeholder authorization key',
        })
      }

      if (
        !isValidGeminiEmbeddingQuotaProjectId(
          env.GEMINI_EMBEDDING_QUOTA_PROJECT_ID,
        )
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['GEMINI_EMBEDDING_QUOTA_PROJECT_ID'],
          message:
            'is required when EMBEDDING_PROVIDER is gemini and must be a lowercase opaque deployment label of at least three characters, not the real Google project name',
        })
      }

      for (const key of GEMINI_EMBEDDING_QUOTA_KEYS) {
        if (env[key] === undefined) {
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: 'is required when EMBEDDING_PROVIDER is gemini',
          })
        }
      }

      // A local consistency rule over local admission-control caps. It says
      // nothing about Google's enforcement: provider-side 429 RESOURCE_EXHAUSTED
      // responses remain authoritative.
      const perMinute = env.GEMINI_EMBEDDING_REQUESTS_PER_MINUTE
      const perHour = env.GEMINI_EMBEDDING_LOCAL_REQUESTS_PER_HOUR
      const perDay = env.GEMINI_EMBEDDING_REQUESTS_PER_DAY
      const per30Days = env.GEMINI_EMBEDDING_LOCAL_REQUESTS_PER_30_DAYS
      if (
        perMinute !== undefined &&
        perHour !== undefined &&
        perDay !== undefined &&
        per30Days !== undefined &&
        !(perMinute <= perHour && perHour <= perDay && perDay <= per30Days)
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['GEMINI_EMBEDDING_LOCAL_REQUESTS_PER_30_DAYS'],
          message: 'request caps must satisfy minute <= hour <= day <= 30-days',
        })
      }
    }

    if (env.NODE_ENV === 'production' && !isAbsolute(env.PDF_STORAGE_PATH)) {
      ctx.addIssue({
        code: 'custom',
        path: ['PDF_STORAGE_PATH'],
        message:
          'must be an absolute path in production so PDFs do not depend on the process working directory',
      })
    }
  })

export type AppEnvironment = z.infer<typeof envSchema>

// Case-insensitive so a re-cased copy of a committed example value is still
// recognized as the placeholder it is.
function isPlaceholderSecret(value: string): boolean {
  return value.toLowerCase().startsWith(SECRET_PLACEHOLDER_PREFIX)
}

export function formatEnvIssues(error: z.ZodError) {
  return error.issues
    .map((issue) => {
      const path = issue.path.join('.') || 'environment'
      return `${path}: ${issue.message}`
    })
    .join('\n')
}

export function validateEnv(config: Record<string, unknown>) {
  const result = envSchema.safeParse(config)

  if (!result.success) {
    throw new Error(
      `Invalid environment configuration:\n${formatEnvIssues(result.error)}`,
    )
  }

  return result.data
}
