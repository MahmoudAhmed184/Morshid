import { isAbsolute } from 'node:path'

import { z } from 'zod'

// Rejects the committed `.env.example` placeholders so a fresh checkout cannot
// boot with a publicly known signing secret (see docker-compose `${VAR:?}`).
const SECRET_PLACEHOLDER_PREFIX = 'replace-with'
export const DEFAULT_PDF_MAX_UPLOAD_BYTES = 10 * 1024 * 1024

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
      .default(DEFAULT_PDF_MAX_UPLOAD_BYTES),
    // Only providers with a wired implementation are accepted so the factory
    // never has to reject a configured-but-unimplemented provider at runtime.
    // The deterministic default keeps CI and local work keyless and offline.
    EMBEDDING_PROVIDER: z.enum(['deterministic']).default('deterministic'),
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
