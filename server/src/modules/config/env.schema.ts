import { z } from 'zod'

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  CLIENT_ORIGIN: z.url().default('http://localhost:3000'),
  DATABASE_URL: z.url().startsWith('postgresql://'),
  REDIS_URL: z.url().startsWith('redis://'),
  PDF_STORAGE_PATH: z.string().min(1).default('/workspace/storage/pdfs'),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRATION: z.string().default('3d'),
  JWT_REFRESH_EXPIRATION_DAYS: z.coerce.number().int().min(1).default(14),
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
