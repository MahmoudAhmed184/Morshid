import {
  DEFAULT_MODEL_TIMEOUT_MS,
  MAX_MODEL_TIMEOUT_MS,
} from './model-boundary'
import {
  isValidAnalysisModelName,
  isValidOptionalAnalysisApiKey,
  normalizeOpenAICompatibleBaseUrl,
} from './analysis-model.configuration'
import {
  TUTOR_MODEL_ERROR_CODE,
  TutorModelError,
} from './tutor-generation.types'

export const DETERMINISTIC_TUTOR_MODEL_PROVIDER = 'deterministic'
export const OPENAI_COMPATIBLE_TUTOR_MODEL_PROVIDER = 'openai-compatible'

export const DEFAULT_TUTOR_MODEL_TIMEOUT_MS = DEFAULT_MODEL_TIMEOUT_MS
export const MAX_TUTOR_MODEL_TIMEOUT_MS = MAX_MODEL_TIMEOUT_MS
export const DEFAULT_TUTOR_MODEL_BASE_URL = 'http://localhost:8000/v1'
export const DEFAULT_TUTOR_MODEL_NAME = 'Qwen/Qwen2.5-7B-Instruct'
export const DEFAULT_TUTOR_MODEL_MAX_COMPLETION_TOKENS = 768
export const MIN_TUTOR_MODEL_MAX_COMPLETION_TOKENS = 64
export const MAX_TUTOR_MODEL_MAX_COMPLETION_TOKENS = 2_048
export const MAX_TUTOR_MODEL_BASE_URL_LENGTH = 2_048
export const MAX_TUTOR_MODEL_NAME_LENGTH = 200
export const MAX_TUTOR_MODEL_API_KEY_LENGTH = 4_096

export type TutorModelProviderName =
  | typeof DETERMINISTIC_TUTOR_MODEL_PROVIDER
  | typeof OPENAI_COMPATIBLE_TUTOR_MODEL_PROVIDER

export interface OpenAICompatibleTutorConfiguration {
  readonly baseUrl: string
  readonly endpoint?: string
  readonly modelName: string
  readonly apiKey: string | null
  readonly maxCompletionTokens: number
}

export type TutorModelConfiguration =
  | {
      readonly provider: typeof DETERMINISTIC_TUTOR_MODEL_PROVIDER
      readonly timeoutMs: number
    }
  | {
      readonly provider: typeof OPENAI_COMPATIBLE_TUTOR_MODEL_PROVIDER
      readonly timeoutMs: number
      readonly openAICompatible: OpenAICompatibleTutorConfiguration
    }

export function validateTutorModelConfiguration(
  configuration: unknown,
): TutorModelConfiguration {
  try {
    if (typeof configuration !== 'object' || configuration === null) {
      throw new TypeError('Invalid tutor model configuration')
    }

    const record = configuration as Record<PropertyKey, unknown>
    const provider = Reflect.get(record, 'provider')
    const timeoutMs = Reflect.get(record, 'timeoutMs')

    if (!isTutorModelProviderName(provider) || !isValidTimeout(timeoutMs)) {
      throw new TypeError('Invalid tutor model configuration')
    }

    if (provider === DETERMINISTIC_TUTOR_MODEL_PROVIDER) {
      return Object.freeze({ provider, timeoutMs })
    }

    return Object.freeze({
      provider,
      timeoutMs,
      openAICompatible: validateOpenAICompatibleTutorConfiguration(
        Reflect.get(record, 'openAICompatible'),
      ),
    })
  } catch (error) {
    if (error instanceof TutorModelError) {
      throw error
    }
    throw new TutorModelError(TUTOR_MODEL_ERROR_CODE.CONFIGURATION_INVALID)
  }
}

export function validateOpenAICompatibleTutorConfiguration(
  value: unknown,
): OpenAICompatibleTutorConfiguration & { readonly endpoint: string } {
  if (typeof value !== 'object' || value === null) {
    throw new TypeError('Invalid OpenAI-compatible tutor configuration')
  }

  const record = value as Record<PropertyKey, unknown>
  const baseUrl = Reflect.get(record, 'baseUrl')
  const modelName = Reflect.get(record, 'modelName')
  const apiKey = Reflect.get(record, 'apiKey')
  const maxCompletionTokens = Reflect.get(record, 'maxCompletionTokens')

  if (
    typeof baseUrl !== 'string' ||
    !isValidTutorModelName(modelName) ||
    !isValidOptionalTutorApiKey(apiKey) ||
    !isValidTutorModelMaxCompletionTokens(maxCompletionTokens)
  ) {
    throw new TypeError('Invalid OpenAI-compatible tutor configuration')
  }

  const normalizedBaseUrl = normalizeOpenAICompatibleBaseUrl(baseUrl)

  return Object.freeze({
    baseUrl: normalizedBaseUrl,
    endpoint: `${normalizedBaseUrl}/chat/completions`,
    modelName,
    apiKey: apiKey === null || apiKey.trim() === '' ? null : apiKey,
    maxCompletionTokens,
  })
}

export function isValidTutorModelMaxCompletionTokens(
  value: unknown,
): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= MIN_TUTOR_MODEL_MAX_COMPLETION_TOKENS &&
    value <= MAX_TUTOR_MODEL_MAX_COMPLETION_TOKENS
  )
}

export function isValidTutorModelName(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= MAX_TUTOR_MODEL_NAME_LENGTH &&
    isValidAnalysisModelName(value)
  )
}

export function isValidOptionalTutorApiKey(
  value: unknown,
): value is string | null {
  return isValidOptionalAnalysisApiKey(value)
}

function isTutorModelProviderName(
  value: unknown,
): value is TutorModelProviderName {
  return (
    value === DETERMINISTIC_TUTOR_MODEL_PROVIDER ||
    value === OPENAI_COMPATIBLE_TUTOR_MODEL_PROVIDER
  )
}

function isValidTimeout(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 1 &&
    value <= MAX_TUTOR_MODEL_TIMEOUT_MS
  )
}
