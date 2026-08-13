import {
  DEFAULT_MODEL_TIMEOUT_MS,
  MAX_MODEL_TIMEOUT_MS,
} from './model-boundary'
import {
  ANALYSIS_MODEL_ERROR_CODE,
  AnalysisModelError,
} from '../socratic-workflow/analysis/analysis-model.port'

export const DETERMINISTIC_ANALYSIS_MODEL_PROVIDER = 'deterministic'
export const OPENAI_COMPATIBLE_ANALYSIS_MODEL_PROVIDER = 'openai-compatible'

export const DEFAULT_ANALYSIS_MODEL_TIMEOUT_MS = DEFAULT_MODEL_TIMEOUT_MS
export const MAX_ANALYSIS_MODEL_TIMEOUT_MS = MAX_MODEL_TIMEOUT_MS
export const DEFAULT_ANALYSIS_MODEL_BASE_URL = 'http://localhost:8000/v1'
export const DEFAULT_ANALYSIS_MODEL_NAME = 'Qwen/Qwen2.5-14B-Instruct'
export const DEFAULT_ANALYSIS_MODEL_MAX_COMPLETION_TOKENS = 2_048
export const MIN_ANALYSIS_MODEL_MAX_COMPLETION_TOKENS = 64
export const MAX_ANALYSIS_MODEL_MAX_COMPLETION_TOKENS = 2_048
export const MAX_ANALYSIS_MODEL_BASE_URL_LENGTH = 2_048
export const MAX_ANALYSIS_MODEL_NAME_LENGTH = 200
export const MAX_ANALYSIS_MODEL_API_KEY_LENGTH = 4_096

const ANALYSIS_MODEL_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/u

export type AnalysisModelProviderName =
  | typeof DETERMINISTIC_ANALYSIS_MODEL_PROVIDER
  | typeof OPENAI_COMPATIBLE_ANALYSIS_MODEL_PROVIDER

export interface OpenAICompatibleAnalysisConfiguration {
  readonly baseUrl: string
  readonly endpoint?: string
  readonly modelName: string
  readonly apiKey: string | null
  readonly maxCompletionTokens: number
}

export type AnalysisModelConfiguration =
  | {
      readonly provider: typeof DETERMINISTIC_ANALYSIS_MODEL_PROVIDER
      readonly timeoutMs: number
    }
  | {
      readonly provider: typeof OPENAI_COMPATIBLE_ANALYSIS_MODEL_PROVIDER
      readonly timeoutMs: number
      readonly openAICompatible: OpenAICompatibleAnalysisConfiguration
    }

export function validateAnalysisModelConfiguration(
  configuration: unknown,
): AnalysisModelConfiguration {
  try {
    if (typeof configuration !== 'object' || configuration === null) {
      throw new TypeError('Invalid analysis model configuration')
    }

    const record = configuration as Record<PropertyKey, unknown>
    const provider = Reflect.get(record, 'provider')
    const timeoutMs = Reflect.get(record, 'timeoutMs')

    if (!isAnalysisModelProviderName(provider) || !isValidTimeout(timeoutMs)) {
      throw new TypeError('Invalid analysis model configuration')
    }

    if (provider === DETERMINISTIC_ANALYSIS_MODEL_PROVIDER) {
      return Object.freeze({ provider, timeoutMs })
    }

    return Object.freeze({
      provider,
      timeoutMs,
      openAICompatible: validateOpenAICompatibleAnalysisConfiguration(
        Reflect.get(record, 'openAICompatible'),
      ),
    })
  } catch (error) {
    if (error instanceof AnalysisModelError) {
      throw error
    }
    throw new AnalysisModelError(
      ANALYSIS_MODEL_ERROR_CODE.CONFIGURATION_INVALID,
    )
  }
}

export function validateOpenAICompatibleAnalysisConfiguration(
  value: unknown,
): OpenAICompatibleAnalysisConfiguration & { readonly endpoint: string } {
  if (typeof value !== 'object' || value === null) {
    throw new TypeError('Invalid OpenAI-compatible analysis configuration')
  }

  const record = value as Record<PropertyKey, unknown>
  const baseUrl = Reflect.get(record, 'baseUrl')
  const modelName = Reflect.get(record, 'modelName')
  const apiKey = Reflect.get(record, 'apiKey')
  const maxCompletionTokens = Reflect.get(record, 'maxCompletionTokens')

  if (
    typeof baseUrl !== 'string' ||
    !isValidAnalysisModelName(modelName) ||
    !isValidOptionalAnalysisApiKey(apiKey) ||
    !isValidAnalysisModelMaxCompletionTokens(maxCompletionTokens)
  ) {
    throw new TypeError('Invalid OpenAI-compatible analysis configuration')
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

export function isValidAnalysisModelMaxCompletionTokens(
  value: unknown,
): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= MIN_ANALYSIS_MODEL_MAX_COMPLETION_TOKENS &&
    value <= MAX_ANALYSIS_MODEL_MAX_COMPLETION_TOKENS
  )
}

export function isValidAnalysisModelName(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim() === value &&
    value.length > 0 &&
    value.length <= MAX_ANALYSIS_MODEL_NAME_LENGTH &&
    ANALYSIS_MODEL_NAME_PATTERN.test(value)
  )
}

export function isValidOptionalAnalysisApiKey(
  value: unknown,
): value is string | null {
  if (value === null) {
    return true
  }

  if (typeof value !== 'string') {
    return false
  }

  if (value === '') {
    return true
  }

  return (
    value.trim() === value &&
    value.length <= MAX_ANALYSIS_MODEL_API_KEY_LENGTH &&
    /^[\x21-\x7e]+$/u.test(value)
  )
}

export function normalizeOpenAICompatibleBaseUrl(value: string): string {
  if (value.length === 0 || value.length > MAX_ANALYSIS_MODEL_BASE_URL_LENGTH) {
    throw new TypeError('Invalid analysis model base URL')
  }

  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new TypeError('Invalid analysis model base URL')
  }

  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.username !== '' ||
    url.password !== '' ||
    url.search !== '' ||
    url.hash !== ''
  ) {
    throw new TypeError('Invalid analysis model base URL')
  }

  if (url.protocol === 'http:' && !isLocalhost(url.hostname)) {
    throw new TypeError('HTTP analysis model base URL must be local')
  }

  return url.toString().replace(/\/+$/u, '')
}

function isAnalysisModelProviderName(
  value: unknown,
): value is AnalysisModelProviderName {
  return (
    value === DETERMINISTIC_ANALYSIS_MODEL_PROVIDER ||
    value === OPENAI_COMPATIBLE_ANALYSIS_MODEL_PROVIDER
  )
}

function isValidTimeout(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 1 &&
    value <= MAX_ANALYSIS_MODEL_TIMEOUT_MS
  )
}

function isLocalhost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname === '::1'
  )
}
