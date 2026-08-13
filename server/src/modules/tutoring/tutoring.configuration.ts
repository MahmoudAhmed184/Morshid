import type { ConfigService } from '@nestjs/config'
import { z } from 'zod'

import {
  DEFAULT_TUTORING_REQUEST_TIMEOUT_MS,
  MAX_TUTORING_REQUEST_TIMEOUT_MS,
} from '../../common/http/request-deadline'
import {
  inspectGeminiChatProjects,
  isGeminiOpenAICompatibleBaseUrl,
} from '../../platform/ai/upstream/gemini-chat-project-pool'
import type { AppEnvironment } from '../../platform/config/env.schema'
import {
  DEFAULT_ANALYSIS_CONFIDENCE_THRESHOLD,
  isValidConfidenceThreshold,
} from './socratic-workflow/analysis/analysis-confidence-policy'
import {
  DEFAULT_ANALYSIS_MODEL_MAX_RETRIES,
  MAX_ANALYSIS_MODEL_MAX_RETRIES,
} from './socratic-workflow/analysis/analysis-retry-policy'
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
} from './infrastructure/analysis-model.configuration'
import {
  DEFAULT_TUTOR_MODEL_MAX_INFRASTRUCTURE_RETRIES,
  MAX_TUTOR_MODEL_MAX_INFRASTRUCTURE_RETRIES,
} from './socratic-workflow/generation/tutor-infrastructure-retry.policy'
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
} from './infrastructure/tutor-model.configuration'
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
} from './infrastructure/semantic-guard.configuration'

const SECRET_PLACEHOLDER_PREFIX = 'replace-with'

function blankAsUndefined(value: unknown): unknown {
  return typeof value === 'string' && value.trim() === '' ? undefined : value
}

function parseGeminiChatProjectsJson(value: unknown): unknown {
  if (
    value === undefined ||
    (typeof value === 'string' && value.trim() === '')
  ) {
    return []
  }
  if (typeof value !== 'string') {
    return value
  }
  try {
    return JSON.parse(value) as unknown
  } catch {
    return value
  }
}

const geminiChatProjectsSchema = z.unknown().transform((value, ctx) => {
  const validation = inspectGeminiChatProjects(value, { allowEmpty: true })
  if (!validation.success) {
    for (const issue of validation.issues) {
      ctx.addIssue({
        code: 'custom',
        path: [...issue.path],
        message: issue.message,
      })
    }
    return z.NEVER
  }
  return validation.projects
})

const tutoringConfigurationSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    TUTORING_REQUEST_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .positive()
      .max(MAX_TUTORING_REQUEST_TIMEOUT_MS)
      .default(DEFAULT_TUTORING_REQUEST_TIMEOUT_MS),
    GEMINI_CHAT_PROJECTS_JSON: z.preprocess(
      parseGeminiChatProjectsJson,
      geminiChatProjectsSchema,
    ),
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
  })
  .superRefine((configuration, ctx) => {
    for (const [
      index,
      project,
    ] of configuration.GEMINI_CHAT_PROJECTS_JSON.entries()) {
      if (isPlaceholderSecret(project.apiKey)) {
        ctx.addIssue({
          code: 'custom',
          path: ['GEMINI_CHAT_PROJECTS_JSON', index, 'apiKey'],
          message: 'must not use a placeholder Gemini API key',
        })
      }
    }

    for (const [key, value, label] of [
      [
        'ANALYSIS_MODEL_API_KEY',
        configuration.ANALYSIS_MODEL_API_KEY,
        'analysis model',
      ],
      ['TUTOR_MODEL_API_KEY', configuration.TUTOR_MODEL_API_KEY, 'tutor model'],
      [
        'SEMANTIC_GUARD_API_KEY',
        configuration.SEMANTIC_GUARD_API_KEY,
        'semantic guard',
      ],
    ] as const) {
      if (value !== '' && isPlaceholderSecret(value)) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: `must not use a placeholder ${label} key`,
        })
      }
    }

    const liveModels = [
      [
        'ANALYSIS_MODEL_PROVIDER',
        configuration.ANALYSIS_MODEL_PROVIDER,
        OPENAI_COMPATIBLE_ANALYSIS_MODEL_PROVIDER,
      ],
      [
        'TUTOR_MODEL_PROVIDER',
        configuration.TUTOR_MODEL_PROVIDER,
        OPENAI_COMPATIBLE_TUTOR_MODEL_PROVIDER,
      ],
    ] as const

    for (const [path, provider, liveProvider] of liveModels) {
      if (provider === liveProvider) {
        const baseUrl =
          path === 'ANALYSIS_MODEL_PROVIDER'
            ? configuration.ANALYSIS_MODEL_BASE_URL
            : configuration.TUTOR_MODEL_BASE_URL
        try {
          normalizeOpenAICompatibleBaseUrl(baseUrl)
        } catch {
          ctx.addIssue({
            code: 'custom',
            path: [
              path === 'ANALYSIS_MODEL_PROVIDER'
                ? 'ANALYSIS_MODEL_BASE_URL'
                : 'TUTOR_MODEL_BASE_URL',
            ],
            message:
              'must be HTTP localhost or HTTPS without credentials, query, or fragment',
          })
        }
      }
    }

    const geminiRoles = [
      {
        provider: configuration.ANALYSIS_MODEL_PROVIDER,
        liveProvider: OPENAI_COMPATIBLE_ANALYSIS_MODEL_PROVIDER,
        baseUrl: configuration.ANALYSIS_MODEL_BASE_URL,
        apiKey: configuration.ANALYSIS_MODEL_API_KEY,
        apiKeyPath: 'ANALYSIS_MODEL_API_KEY',
      },
      {
        provider: configuration.TUTOR_MODEL_PROVIDER,
        liveProvider: OPENAI_COMPATIBLE_TUTOR_MODEL_PROVIDER,
        baseUrl: configuration.TUTOR_MODEL_BASE_URL,
        apiKey: configuration.TUTOR_MODEL_API_KEY,
        apiKeyPath: 'TUTOR_MODEL_API_KEY',
      },
      {
        provider: configuration.SEMANTIC_GUARD_PROVIDER,
        liveProvider: OPENAI_COMPATIBLE_SEMANTIC_GUARD_PROVIDER,
        baseUrl: configuration.SEMANTIC_GUARD_BASE_URL,
        apiKey: configuration.SEMANTIC_GUARD_API_KEY,
        apiKeyPath: 'SEMANTIC_GUARD_API_KEY',
      },
    ] as const
    const selectedGeminiRoles = geminiRoles.filter(
      (role) =>
        role.provider === role.liveProvider &&
        isGeminiOpenAICompatibleBaseUrl(role.baseUrl),
    )
    if (
      selectedGeminiRoles.length > 0 &&
      configuration.GEMINI_CHAT_PROJECTS_JSON.length === 0
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['GEMINI_CHAT_PROJECTS_JSON'],
        message:
          'must contain at least one project when a role uses the Gemini OpenAI-compatible endpoint',
      })
    }
    if (
      selectedGeminiRoles.length === 0 &&
      configuration.GEMINI_CHAT_PROJECTS_JSON.length > 0
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['GEMINI_CHAT_PROJECTS_JSON'],
        message:
          'must be empty unless an openai-compatible role uses the Gemini endpoint',
      })
    }
    for (const role of selectedGeminiRoles) {
      if (role.apiKey !== '') {
        ctx.addIssue({
          code: 'custom',
          path: [role.apiKeyPath],
          message: 'must be blank when the role uses GEMINI_CHAT_PROJECTS_JSON',
        })
      }
    }

    if (
      configuration.SEMANTIC_GUARD_PROVIDER ===
      OPENAI_COMPATIBLE_SEMANTIC_GUARD_PROVIDER
    ) {
      try {
        normalizeOpenAICompatibleBaseUrl(configuration.SEMANTIC_GUARD_BASE_URL)
      } catch {
        ctx.addIssue({
          code: 'custom',
          path: ['SEMANTIC_GUARD_BASE_URL'],
          message:
            'must be HTTP localhost or HTTPS without credentials, query, or fragment',
        })
      }
    }

    const productionModels = [
      [
        'ANALYSIS_MODEL_PROVIDER',
        configuration.ANALYSIS_MODEL_PROVIDER,
        DETERMINISTIC_ANALYSIS_MODEL_PROVIDER,
        'analysis model',
      ],
      [
        'TUTOR_MODEL_PROVIDER',
        configuration.TUTOR_MODEL_PROVIDER,
        DETERMINISTIC_TUTOR_MODEL_PROVIDER,
        'tutor model',
      ],
    ] as const
    for (const [
      path,
      provider,
      deterministicProvider,
      role,
    ] of productionModels) {
      if (
        configuration.NODE_ENV === 'production' &&
        provider === deterministicProvider
      ) {
        ctx.addIssue({
          code: 'custom',
          path: [path],
          message: `production requires a live ${role} provider`,
        })
      }
    }

    if (
      configuration.ANALYSIS_MODEL_PROVIDER ===
        OPENAI_COMPATIBLE_ANALYSIS_MODEL_PROVIDER &&
      configuration.TUTOR_MODEL_PROVIDER ===
        OPENAI_COMPATIBLE_TUTOR_MODEL_PROVIDER &&
      configuration.ANALYSIS_MODEL_NAME === configuration.TUTOR_MODEL_NAME
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['TUTOR_MODEL_NAME'],
        message:
          'must differ from ANALYSIS_MODEL_NAME so tutor and analysis model roles cannot alias the same production model identifier',
      })
    }

    if (
      configuration.SEMANTIC_GUARD_PROVIDER ===
        OPENAI_COMPATIBLE_SEMANTIC_GUARD_PROVIDER &&
      configuration.ANALYSIS_MODEL_PROVIDER ===
        OPENAI_COMPATIBLE_ANALYSIS_MODEL_PROVIDER &&
      configuration.SEMANTIC_GUARD_MODEL_NAME ===
        configuration.ANALYSIS_MODEL_NAME
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['SEMANTIC_GUARD_MODEL_NAME'],
        message:
          'must differ from ANALYSIS_MODEL_NAME so semantic guard and analysis roles cannot alias the same production model identifier',
      })
    }

    if (
      configuration.SEMANTIC_GUARD_PROVIDER ===
        OPENAI_COMPATIBLE_SEMANTIC_GUARD_PROVIDER &&
      configuration.TUTOR_MODEL_PROVIDER ===
        OPENAI_COMPATIBLE_TUTOR_MODEL_PROVIDER &&
      configuration.SEMANTIC_GUARD_MODEL_NAME === configuration.TUTOR_MODEL_NAME
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['SEMANTIC_GUARD_MODEL_NAME'],
        message:
          'must differ from TUTOR_MODEL_NAME so semantic guard and tutor roles cannot alias the same production model identifier',
      })
    }
  })

export type TutoringConfiguration = z.infer<typeof tutoringConfigurationSchema>

export const TUTORING_CONFIGURATION = Symbol('TutoringConfiguration')

export function readTutoringConfiguration(
  configService: ConfigService<AppEnvironment, true>,
): TutoringConfiguration {
  const result = tutoringConfigurationSchema.safeParse({
    NODE_ENV: configService.get('NODE_ENV', { infer: true }),
    TUTORING_REQUEST_TIMEOUT_MS: configService.get(
      'TUTORING_REQUEST_TIMEOUT_MS',
      {
        infer: true,
      },
    ),
    GEMINI_CHAT_PROJECTS_JSON: configService.get('GEMINI_CHAT_PROJECTS_JSON', {
      infer: true,
    }),
    ANALYSIS_MODEL_PROVIDER: configService.get('ANALYSIS_MODEL_PROVIDER', {
      infer: true,
    }),
    ANALYSIS_MODEL_BASE_URL: configService.get('ANALYSIS_MODEL_BASE_URL', {
      infer: true,
    }),
    ANALYSIS_MODEL_NAME: configService.get('ANALYSIS_MODEL_NAME', {
      infer: true,
    }),
    ANALYSIS_MODEL_API_KEY: configService.get('ANALYSIS_MODEL_API_KEY', {
      infer: true,
    }),
    ANALYSIS_MODEL_TIMEOUT_MS: configService.get('ANALYSIS_MODEL_TIMEOUT_MS', {
      infer: true,
    }),
    ANALYSIS_MODEL_MAX_COMPLETION_TOKENS: configService.get(
      'ANALYSIS_MODEL_MAX_COMPLETION_TOKENS',
      { infer: true },
    ),
    ANALYSIS_CONFIDENCE_THRESHOLD: configService.get(
      'ANALYSIS_CONFIDENCE_THRESHOLD',
      { infer: true },
    ),
    ANALYSIS_MODEL_MAX_RETRIES: configService.get(
      'ANALYSIS_MODEL_MAX_RETRIES',
      {
        infer: true,
      },
    ),
    TUTOR_MODEL_PROVIDER: configService.get('TUTOR_MODEL_PROVIDER', {
      infer: true,
    }),
    TUTOR_MODEL_BASE_URL: configService.get('TUTOR_MODEL_BASE_URL', {
      infer: true,
    }),
    TUTOR_MODEL_NAME: configService.get('TUTOR_MODEL_NAME', { infer: true }),
    TUTOR_MODEL_API_KEY: configService.get('TUTOR_MODEL_API_KEY', {
      infer: true,
    }),
    TUTOR_MODEL_TIMEOUT_MS: configService.get('TUTOR_MODEL_TIMEOUT_MS', {
      infer: true,
    }),
    TUTOR_MODEL_MAX_COMPLETION_TOKENS: configService.get(
      'TUTOR_MODEL_MAX_COMPLETION_TOKENS',
      { infer: true },
    ),
    TUTOR_MODEL_MAX_INFRASTRUCTURE_RETRIES: configService.get(
      'TUTOR_MODEL_MAX_INFRASTRUCTURE_RETRIES',
      { infer: true },
    ),
    SEMANTIC_GUARD_PROVIDER: configService.get('SEMANTIC_GUARD_PROVIDER', {
      infer: true,
    }),
    SEMANTIC_GUARD_BASE_URL: configService.get('SEMANTIC_GUARD_BASE_URL', {
      infer: true,
    }),
    SEMANTIC_GUARD_MODEL_NAME: configService.get('SEMANTIC_GUARD_MODEL_NAME', {
      infer: true,
    }),
    SEMANTIC_GUARD_API_KEY: configService.get('SEMANTIC_GUARD_API_KEY', {
      infer: true,
    }),
    SEMANTIC_GUARD_TIMEOUT_MS: configService.get('SEMANTIC_GUARD_TIMEOUT_MS', {
      infer: true,
    }),
    SEMANTIC_GUARD_MAX_COMPLETION_TOKENS: configService.get(
      'SEMANTIC_GUARD_MAX_COMPLETION_TOKENS',
      { infer: true },
    ),
  })

  if (!result.success) {
    throw new Error(
      `Invalid tutoring configuration: ${result.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ')}`,
    )
  }

  return result.data
}

export function parseTutoringConfiguration(
  value: Record<string, unknown>,
): TutoringConfiguration {
  const result = tutoringConfigurationSchema.safeParse(value)
  if (!result.success) {
    throw new Error(
      `Invalid tutoring configuration: ${result.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ')}`,
    )
  }
  return result.data
}

function isPlaceholderSecret(value: string): boolean {
  return value.toLowerCase().startsWith(SECRET_PLACEHOLDER_PREFIX)
}
