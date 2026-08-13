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
} from '../ai/embedding/embedding-configuration'
import { inspectGeminiChatProjectsJson } from '../ai/upstream/gemini-chat-project-pool'

const GEMINI_EMBEDDING_QUOTA_KEYS = [
  'GEMINI_EMBEDDING_REQUESTS_PER_MINUTE',
  'GEMINI_EMBEDDING_INPUT_TOKENS_PER_MINUTE',
  'GEMINI_EMBEDDING_REQUESTS_PER_DAY',
  'GEMINI_EMBEDDING_LOCAL_REQUESTS_PER_HOUR',
  'GEMINI_EMBEDDING_LOCAL_REQUESTS_PER_30_DAYS',
] as const

function blankAsUndefined(value: unknown): unknown {
  return typeof value === 'string' && value.trim() === '' ? undefined : value
}

const SECRET_PLACEHOLDER_PREFIX = 'replace-with'

const environmentSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
    CLIENT_ORIGIN: z.url().default('http://localhost:3000'),
    DATABASE_URL: z.url().startsWith('postgresql://'),
    REDIS_URL: z.url().startsWith('redis://'),
    PDF_STORAGE_PATH: z.string().trim().min(1),
    AUTH_ACCESS_TOKEN_SECRET: z.string().min(32),
    AUTH_REFRESH_TOKEN_HASH_SECRET: z.string().min(32),
    AUTH_ACCESS_TOKEN_TTL_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(900),
    AUTH_REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),

    // AI embedding is a platform adapter. Its provider identity, upstream
    // credentials, quota budget, and request deadlines are validated here;
    // product retrieval and tutoring policy remains in those capabilities.
    EMBEDDING_PROVIDER: z
      .enum([DETERMINISTIC_EMBEDDING_PROVIDER, GEMINI_EMBEDDING_PROVIDER])
      .default(DETERMINISTIC_EMBEDDING_PROVIDER),
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
    GEMINI_EMBEDDING_API_KEY: z.preprocess(
      blankAsUndefined,
      z
        .string()
        .trim()
        .min(20)
        .max(MAX_GEMINI_EMBEDDING_API_KEY_LENGTH)
        .optional(),
    ),
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
    GEMINI_EMBEDDING_LOCAL_REQUESTS_PER_HOUR: z.preprocess(
      blankAsUndefined,
      z.coerce.number().int().positive().optional(),
    ),
    GEMINI_EMBEDDING_LOCAL_REQUESTS_PER_30_DAYS: z.preprocess(
      blankAsUndefined,
      z.coerce.number().int().positive().optional(),
    ),

    // These are deliberately unopinionated transport values. Their defaults,
    // bounds, cross-field rules, and provider semantics belong to Materials or
    // Tutoring, not to platform configuration.
    PDF_MAX_UPLOAD_BYTES: z.coerce.number().int().positive().optional(),
    RETRIEVAL_TOP_K: z.coerce.number().int().positive().optional(),
    RETRIEVAL_MIN_SIMILARITY: z.coerce.number().optional(),
    TUTORING_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
    GEMINI_CHAT_PROJECTS_JSON: z.string().optional(),
    ANALYSIS_MODEL_PROVIDER: z.string().optional(),
    ANALYSIS_MODEL_BASE_URL: z.string().optional(),
    ANALYSIS_MODEL_NAME: z.string().optional(),
    ANALYSIS_MODEL_API_KEY: z.string().optional(),
    ANALYSIS_MODEL_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
    ANALYSIS_MODEL_MAX_COMPLETION_TOKENS: z.coerce
      .number()
      .int()
      .positive()
      .optional(),
    ANALYSIS_CONFIDENCE_THRESHOLD: z.coerce.number().optional(),
    ANALYSIS_MODEL_MAX_RETRIES: z.coerce
      .number()
      .int()
      .nonnegative()
      .optional(),
    TUTOR_MODEL_PROVIDER: z.string().optional(),
    TUTOR_MODEL_BASE_URL: z.string().optional(),
    TUTOR_MODEL_NAME: z.string().optional(),
    TUTOR_MODEL_API_KEY: z.string().optional(),
    TUTOR_MODEL_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
    TUTOR_MODEL_MAX_COMPLETION_TOKENS: z.coerce
      .number()
      .int()
      .positive()
      .optional(),
    TUTOR_MODEL_MAX_INFRASTRUCTURE_RETRIES: z.coerce
      .number()
      .int()
      .nonnegative()
      .optional(),
    SEMANTIC_GUARD_PROVIDER: z.string().optional(),
    SEMANTIC_GUARD_BASE_URL: z.string().optional(),
    SEMANTIC_GUARD_MODEL_NAME: z.string().optional(),
    SEMANTIC_GUARD_API_KEY: z.string().optional(),
    SEMANTIC_GUARD_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
    SEMANTIC_GUARD_MAX_COMPLETION_TOKENS: z.coerce
      .number()
      .int()
      .positive()
      .optional(),
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

    if (env.EMBEDDING_PROVIDER === GEMINI_EMBEDDING_PROVIDER) {
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

      const chatProjects = inspectGeminiChatProjectsJson(
        env.GEMINI_CHAT_PROJECTS_JSON,
        { allowEmpty: true },
      )
      if (
        chatProjects.success &&
        env.GEMINI_EMBEDDING_API_KEY !== undefined &&
        chatProjects.projects.some(
          (project) => project.apiKey === env.GEMINI_EMBEDDING_API_KEY,
        )
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['GEMINI_EMBEDDING_API_KEY'],
          message: 'must differ from every Gemini chat project API key',
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

export type AppEnvironment = z.infer<typeof environmentSchema>

export function formatEnvIssues(error: z.ZodError) {
  return error.issues
    .map((issue) => {
      const path = issue.path.join('.') || 'environment'
      return `${path}: ${issue.message}`
    })
    .join('\n')
}

export function validateEnv(config: Record<string, unknown>) {
  const result = environmentSchema.safeParse(config)

  if (!result.success) {
    throw new Error(
      `Invalid environment configuration:\n${formatEnvIssues(result.error)}`,
    )
  }

  return result.data
}

function isPlaceholderSecret(value: string): boolean {
  return value.toLowerCase().startsWith(SECRET_PLACEHOLDER_PREFIX)
}
