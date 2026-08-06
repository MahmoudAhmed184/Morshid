import {
  DEFAULT_TUTOR_MODEL_BASE_URL,
  DEFAULT_TUTOR_MODEL_TIMEOUT_MS,
  MAX_TUTOR_MODEL_API_KEY_LENGTH,
  MAX_TUTOR_MODEL_BASE_URL_LENGTH,
  MAX_TUTOR_MODEL_NAME_LENGTH,
  MAX_TUTOR_MODEL_TIMEOUT_MS,
  isValidOptionalTutorApiKey,
  isValidTutorModelName,
} from './tutor-model.configuration'
import { normalizeOpenAICompatibleBaseUrl } from './analysis-model.configuration'
import {
  SEMANTIC_GUARD_ERROR_CODE,
  SemanticGuardModelError,
} from './semantic-guard.types'

export const DETERMINISTIC_SEMANTIC_GUARD_PROVIDER = 'deterministic'
export const OPENAI_COMPATIBLE_SEMANTIC_GUARD_PROVIDER = 'openai-compatible'

export const DEFAULT_SEMANTIC_GUARD_TIMEOUT_MS = DEFAULT_TUTOR_MODEL_TIMEOUT_MS
export const MAX_SEMANTIC_GUARD_TIMEOUT_MS = MAX_TUTOR_MODEL_TIMEOUT_MS
export const DEFAULT_SEMANTIC_GUARD_BASE_URL = DEFAULT_TUTOR_MODEL_BASE_URL
export const DEFAULT_SEMANTIC_GUARD_MODEL_NAME =
  'Qwen/Qwen2.5-7B-Instruct-Guard'
export const MAX_SEMANTIC_GUARD_BASE_URL_LENGTH =
  MAX_TUTOR_MODEL_BASE_URL_LENGTH
export const MAX_SEMANTIC_GUARD_MODEL_NAME_LENGTH = MAX_TUTOR_MODEL_NAME_LENGTH
export const MAX_SEMANTIC_GUARD_API_KEY_LENGTH = MAX_TUTOR_MODEL_API_KEY_LENGTH

export type SemanticGuardProviderName =
  | typeof DETERMINISTIC_SEMANTIC_GUARD_PROVIDER
  | typeof OPENAI_COMPATIBLE_SEMANTIC_GUARD_PROVIDER

export interface OpenAICompatibleSemanticGuardConfiguration {
  readonly baseUrl: string
  readonly endpoint?: string
  readonly modelName: string
  readonly apiKey: string | null
}

export type SemanticGuardConfiguration =
  | {
      readonly provider: typeof DETERMINISTIC_SEMANTIC_GUARD_PROVIDER
      readonly timeoutMs: number
    }
  | {
      readonly provider: typeof OPENAI_COMPATIBLE_SEMANTIC_GUARD_PROVIDER
      readonly timeoutMs: number
      readonly openAICompatible: OpenAICompatibleSemanticGuardConfiguration
    }

export function validateSemanticGuardConfiguration(
  configuration: unknown,
): SemanticGuardConfiguration {
  try {
    if (typeof configuration !== 'object' || configuration === null) {
      throw new TypeError('Invalid semantic guard configuration')
    }

    const record = configuration as Record<PropertyKey, unknown>
    const provider = Reflect.get(record, 'provider')
    const timeoutMs = Reflect.get(record, 'timeoutMs')

    if (!isSemanticGuardProviderName(provider) || !isValidTimeout(timeoutMs)) {
      throw new TypeError('Invalid semantic guard configuration')
    }

    if (provider === DETERMINISTIC_SEMANTIC_GUARD_PROVIDER) {
      return Object.freeze({ provider, timeoutMs })
    }

    return Object.freeze({
      provider,
      timeoutMs,
      openAICompatible: validateOpenAICompatibleSemanticGuardConfiguration(
        Reflect.get(record, 'openAICompatible'),
      ),
    })
  } catch (error) {
    if (error instanceof SemanticGuardModelError) {
      throw error
    }
    throw new SemanticGuardModelError(
      SEMANTIC_GUARD_ERROR_CODE.CONFIGURATION_INVALID,
    )
  }
}

export function validateOpenAICompatibleSemanticGuardConfiguration(
  value: unknown,
): OpenAICompatibleSemanticGuardConfiguration & { readonly endpoint: string } {
  if (typeof value !== 'object' || value === null) {
    throw new TypeError(
      'Invalid OpenAI-compatible semantic guard configuration',
    )
  }

  const record = value as Record<PropertyKey, unknown>
  const baseUrl = Reflect.get(record, 'baseUrl')
  const modelName = Reflect.get(record, 'modelName')
  const apiKey = Reflect.get(record, 'apiKey')

  if (
    typeof baseUrl !== 'string' ||
    !isValidSemanticGuardModelName(modelName) ||
    !isValidOptionalSemanticGuardApiKey(apiKey)
  ) {
    throw new TypeError(
      'Invalid OpenAI-compatible semantic guard configuration',
    )
  }

  const normalizedBaseUrl = normalizeOpenAICompatibleBaseUrl(baseUrl)

  return Object.freeze({
    baseUrl: normalizedBaseUrl,
    endpoint: `${normalizedBaseUrl}/chat/completions`,
    modelName,
    apiKey: apiKey === null || apiKey.trim() === '' ? null : apiKey,
  })
}

export function isValidSemanticGuardModelName(value: unknown): value is string {
  return isValidTutorModelName(value)
}

export function isValidOptionalSemanticGuardApiKey(
  value: unknown,
): value is string | null {
  return isValidOptionalTutorApiKey(value)
}

function isSemanticGuardProviderName(
  value: unknown,
): value is SemanticGuardProviderName {
  return (
    value === DETERMINISTIC_SEMANTIC_GUARD_PROVIDER ||
    value === OPENAI_COMPATIBLE_SEMANTIC_GUARD_PROVIDER
  )
}

function isValidTimeout(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 1 &&
    value <= MAX_SEMANTIC_GUARD_TIMEOUT_MS
  )
}
