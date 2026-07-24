import { isAbsolute } from 'node:path'

import { z } from 'zod'

import {
  AWS_BEDROCK_MODEL_ID_PATTERN,
  DEFAULT_AWS_BEDROCK_MAX_TOKENS,
  DEFAULT_ITI_BEDROCK_GATEWAY_BASE_URL,
  MAX_AWS_BEDROCK_ALLOWED_MODEL_IDS,
  MAX_AWS_BEDROCK_ALLOWED_MODEL_IDS_LENGTH,
  MAX_AWS_BEDROCK_MAX_TOKENS,
  MAX_AWS_BEDROCK_MODEL_ID_LENGTH,
  MAX_ITI_BEDROCK_API_KEY_LENGTH,
  MAX_ITI_BEDROCK_BASE_URL_LENGTH,
  MIN_AWS_BEDROCK_MAX_TOKENS,
  validateItiBedrockBaseUrl,
} from '../completion/completion-configuration'
import {
  DEFAULT_COMPLETION_TIMEOUT_MS,
  MAX_COMPLETION_TIMEOUT_MS,
} from '../completion/validated-completion.provider'
import { MAX_PDF_OBJECT_BYTES } from '../pdf-storage/pdf-storage'

// Rejects the committed `.env.example` placeholders so a fresh checkout cannot
// boot with a publicly known signing secret (see docker-compose `${VAR:?}`).
const SECRET_PLACEHOLDER_PREFIX = 'replace-with'
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
    // Only providers with a wired implementation are accepted so the factory
    // never has to reject a configured-but-unimplemented provider at runtime.
    // The deterministic default keeps CI and local work keyless and offline.
    EMBEDDING_PROVIDER: z.enum(['deterministic']).default('deterministic'),
    // Deterministic remains the committed keyless/offline default. Live
    // completion is selected explicitly and always goes through ITI's gateway.
    COMPLETION_PROVIDER: z
      .enum(['deterministic', 'aws-bedrock'])
      .default('deterministic'),
    COMPLETION_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .positive()
      .max(MAX_COMPLETION_TIMEOUT_MS)
      .default(DEFAULT_COMPLETION_TIMEOUT_MS),
    ITI_BEDROCK_GATEWAY_BASE_URL: z
      .url()
      .max(MAX_ITI_BEDROCK_BASE_URL_LENGTH)
      .default(DEFAULT_ITI_BEDROCK_GATEWAY_BASE_URL),
    ITI_BEDROCK_GATEWAY_API_KEY: z
      .string()
      .max(MAX_ITI_BEDROCK_API_KEY_LENGTH)
      .optional(),
    ITI_BEDROCK_ALLOW_INSECURE_HTTP: z
      .union([z.boolean(), z.enum(['true', 'false'])])
      .default(false)
      .transform((value) => value === true || value === 'true'),
    AWS_BEDROCK_MODEL_ID: z
      .string()
      .max(MAX_AWS_BEDROCK_MODEL_ID_LENGTH)
      .refine(
        (value) => value === '' || AWS_BEDROCK_MODEL_ID_PATTERN.test(value),
        'must be empty or a valid model ID',
      )
      .default(''),
    AWS_BEDROCK_ALLOWED_MODEL_IDS: z
      .string()
      .max(MAX_AWS_BEDROCK_ALLOWED_MODEL_IDS_LENGTH)
      .default('')
      .transform((value, ctx) => parseAllowedModelIds(value, ctx)),
    AWS_BEDROCK_MAX_TOKENS: z.coerce
      .number()
      .int()
      .min(MIN_AWS_BEDROCK_MAX_TOKENS)
      .max(MAX_AWS_BEDROCK_MAX_TOKENS)
      .default(DEFAULT_AWS_BEDROCK_MAX_TOKENS),
    // Retrieval knobs are validated configuration, never caller input: the
    // repository/service signatures expose no limit or threshold parameters.
    // The 0.70 floor may change only after the sprint 4.1 midpoint check
    // records results against locked fixtures.
    RETRIEVAL_TOP_K: z.coerce.number().int().min(1).max(50).default(5),
    RETRIEVAL_MIN_SIMILARITY: z.coerce.number().min(0).max(1).default(0.7),
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
      if (env[key].startsWith(SECRET_PLACEHOLDER_PREFIX)) {
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

    try {
      validateItiBedrockBaseUrl(
        env.ITI_BEDROCK_GATEWAY_BASE_URL,
        env.NODE_ENV,
        env.ITI_BEDROCK_ALLOW_INSECURE_HTTP,
      )
    } catch {
      ctx.addIssue({
        code: 'custom',
        path: ['ITI_BEDROCK_GATEWAY_BASE_URL'],
        message:
          'must use HTTPS without credentials, query, or fragment; HTTP is limited to the explicitly enabled ITI development endpoint',
      })
    }

    if (env.COMPLETION_PROVIDER === 'aws-bedrock') {
      const apiKey = env.ITI_BEDROCK_GATEWAY_API_KEY
      if (
        apiKey === undefined ||
        apiKey.trim() === '' ||
        apiKey !== apiKey.trim() ||
        hasControlCharacter(apiKey)
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['ITI_BEDROCK_GATEWAY_API_KEY'],
          message:
            'is required for aws-bedrock and must not contain surrounding whitespace or control characters',
        })
      }

      if (
        env.AWS_BEDROCK_MODEL_ID === '' ||
        !AWS_BEDROCK_MODEL_ID_PATTERN.test(env.AWS_BEDROCK_MODEL_ID)
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['AWS_BEDROCK_MODEL_ID'],
          message: 'must be an explicit valid model ID for aws-bedrock',
        })
      }

      if (env.AWS_BEDROCK_ALLOWED_MODEL_IDS.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['AWS_BEDROCK_ALLOWED_MODEL_IDS'],
          message: 'must contain at least one model ID for aws-bedrock',
        })
      } else if (
        !env.AWS_BEDROCK_ALLOWED_MODEL_IDS.includes(env.AWS_BEDROCK_MODEL_ID)
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['AWS_BEDROCK_MODEL_ID'],
          message: 'must be present in AWS_BEDROCK_ALLOWED_MODEL_IDS',
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

function parseAllowedModelIds(
  value: string,
  ctx: z.RefinementCtx,
): readonly string[] {
  if (value === '') {
    return Object.freeze([])
  }

  const modelIds = value.split(',').map((modelId) => modelId.trim())
  const seen = new Set<string>()
  for (const modelId of modelIds) {
    if (
      modelId === '' ||
      modelId.length > MAX_AWS_BEDROCK_MODEL_ID_LENGTH ||
      !AWS_BEDROCK_MODEL_ID_PATTERN.test(modelId)
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'must be a comma-separated list of valid model IDs',
      })
      return z.NEVER
    }
    if (seen.has(modelId)) {
      ctx.addIssue({
        code: 'custom',
        message: 'must not contain duplicate model IDs',
      })
      return z.NEVER
    }
    seen.add(modelId)
  }

  if (modelIds.length > MAX_AWS_BEDROCK_ALLOWED_MODEL_IDS) {
    ctx.addIssue({
      code: 'custom',
      message: `must contain at most ${String(MAX_AWS_BEDROCK_ALLOWED_MODEL_IDS)} model IDs`,
    })
    return z.NEVER
  }

  return Object.freeze(modelIds)
}

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0)
    if (codePoint !== undefined && (codePoint <= 0x1f || codePoint === 0x7f)) {
      return true
    }
  }
  return false
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
