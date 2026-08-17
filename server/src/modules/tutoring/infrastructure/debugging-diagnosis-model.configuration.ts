import {
  DEFAULT_ANALYSIS_MODEL_BASE_URL,
  DEFAULT_ANALYSIS_MODEL_TIMEOUT_MS,
  MAX_ANALYSIS_MODEL_API_KEY_LENGTH,
  MAX_ANALYSIS_MODEL_BASE_URL_LENGTH,
  MAX_ANALYSIS_MODEL_NAME_LENGTH,
  MAX_ANALYSIS_MODEL_TIMEOUT_MS,
  isValidAnalysisModelName,
  isValidOptionalAnalysisApiKey,
  normalizeOpenAICompatibleBaseUrl,
} from './analysis-model.configuration'
import {
  DEBUGGING_DIAGNOSIS_MODEL_ERROR_CODE,
  DebuggingDiagnosisModelError,
} from '../socratic-workflow/debugging-guidance/debugging-diagnosis-model.port'

export const DETERMINISTIC_DEBUGGING_DIAGNOSIS_MODEL_PROVIDER = 'deterministic'
export const OPENAI_COMPATIBLE_DEBUGGING_DIAGNOSIS_MODEL_PROVIDER =
  'openai-compatible'

export const DEFAULT_DEBUGGING_DIAGNOSIS_MODEL_TIMEOUT_MS =
  DEFAULT_ANALYSIS_MODEL_TIMEOUT_MS
export const MAX_DEBUGGING_DIAGNOSIS_MODEL_TIMEOUT_MS =
  MAX_ANALYSIS_MODEL_TIMEOUT_MS
export const DEFAULT_DEBUGGING_DIAGNOSIS_MODEL_BASE_URL =
  DEFAULT_ANALYSIS_MODEL_BASE_URL
export const DEFAULT_DEBUGGING_DIAGNOSIS_MODEL_NAME =
  'Qwen/Qwen2.5-7B-Instruct-Diagnosis'
export const DEFAULT_DEBUGGING_DIAGNOSIS_MODEL_MAX_COMPLETION_TOKENS = 1_024
export const MIN_DEBUGGING_DIAGNOSIS_MODEL_MAX_COMPLETION_TOKENS = 64
export const MAX_DEBUGGING_DIAGNOSIS_MODEL_MAX_COMPLETION_TOKENS = 2_048
export const MAX_DEBUGGING_DIAGNOSIS_MODEL_BASE_URL_LENGTH =
  MAX_ANALYSIS_MODEL_BASE_URL_LENGTH
export const MAX_DEBUGGING_DIAGNOSIS_MODEL_NAME_LENGTH =
  MAX_ANALYSIS_MODEL_NAME_LENGTH
export const MAX_DEBUGGING_DIAGNOSIS_MODEL_API_KEY_LENGTH =
  MAX_ANALYSIS_MODEL_API_KEY_LENGTH

export type DebuggingDiagnosisModelProviderName =
  | typeof DETERMINISTIC_DEBUGGING_DIAGNOSIS_MODEL_PROVIDER
  | typeof OPENAI_COMPATIBLE_DEBUGGING_DIAGNOSIS_MODEL_PROVIDER

export interface OpenAICompatibleDebuggingDiagnosisConfiguration {
  readonly baseUrl: string
  readonly endpoint?: string
  readonly modelName: string
  readonly apiKey: string | null
  readonly maxCompletionTokens: number
}

export type DebuggingDiagnosisModelConfiguration =
  | {
      readonly provider: typeof DETERMINISTIC_DEBUGGING_DIAGNOSIS_MODEL_PROVIDER
      readonly timeoutMs: number
    }
  | {
      readonly provider: typeof OPENAI_COMPATIBLE_DEBUGGING_DIAGNOSIS_MODEL_PROVIDER
      readonly timeoutMs: number
      readonly openAICompatible: OpenAICompatibleDebuggingDiagnosisConfiguration
    }

export function validateDebuggingDiagnosisModelConfiguration(
  configuration: unknown,
): DebuggingDiagnosisModelConfiguration {
  try {
    if (typeof configuration !== 'object' || configuration === null) {
      throw new TypeError('Invalid debugging diagnosis model configuration')
    }

    const record = configuration as Record<PropertyKey, unknown>
    const provider = Reflect.get(record, 'provider')
    const timeoutMs = Reflect.get(record, 'timeoutMs')

    if (
      !isDebuggingDiagnosisModelProviderName(provider) ||
      !isValidTimeout(timeoutMs)
    ) {
      throw new TypeError('Invalid debugging diagnosis model configuration')
    }

    if (provider === DETERMINISTIC_DEBUGGING_DIAGNOSIS_MODEL_PROVIDER) {
      return Object.freeze({ provider, timeoutMs })
    }

    return Object.freeze({
      provider,
      timeoutMs,
      openAICompatible: validateOpenAICompatibleDebuggingDiagnosisConfiguration(
        Reflect.get(record, 'openAICompatible'),
      ),
    })
  } catch (error) {
    if (error instanceof DebuggingDiagnosisModelError) {
      throw error
    }
    throw new DebuggingDiagnosisModelError(
      DEBUGGING_DIAGNOSIS_MODEL_ERROR_CODE.CONFIGURATION_INVALID,
    )
  }
}

export function validateOpenAICompatibleDebuggingDiagnosisConfiguration(
  value: unknown,
): OpenAICompatibleDebuggingDiagnosisConfiguration & {
  readonly endpoint: string
} {
  if (typeof value !== 'object' || value === null) {
    throw new TypeError(
      'Invalid OpenAI-compatible debugging diagnosis configuration',
    )
  }

  const record = value as Record<PropertyKey, unknown>
  const baseUrl = Reflect.get(record, 'baseUrl')
  const modelName = Reflect.get(record, 'modelName')
  const apiKey = Reflect.get(record, 'apiKey')
  const maxCompletionTokens = Reflect.get(record, 'maxCompletionTokens')

  if (
    typeof baseUrl !== 'string' ||
    !isValidDebuggingDiagnosisModelName(modelName) ||
    !isValidOptionalDebuggingDiagnosisApiKey(apiKey) ||
    !isValidDebuggingDiagnosisModelMaxCompletionTokens(maxCompletionTokens)
  ) {
    throw new TypeError(
      'Invalid OpenAI-compatible debugging diagnosis configuration',
    )
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

export function isValidDebuggingDiagnosisModelMaxCompletionTokens(
  value: unknown,
): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= MIN_DEBUGGING_DIAGNOSIS_MODEL_MAX_COMPLETION_TOKENS &&
    value <= MAX_DEBUGGING_DIAGNOSIS_MODEL_MAX_COMPLETION_TOKENS
  )
}

export function isValidDebuggingDiagnosisModelName(
  value: unknown,
): value is string {
  return isValidAnalysisModelName(value)
}

export function isValidOptionalDebuggingDiagnosisApiKey(
  value: unknown,
): value is string | null {
  return isValidOptionalAnalysisApiKey(value)
}

function isDebuggingDiagnosisModelProviderName(
  value: unknown,
): value is DebuggingDiagnosisModelProviderName {
  return (
    value === DETERMINISTIC_DEBUGGING_DIAGNOSIS_MODEL_PROVIDER ||
    value === OPENAI_COMPATIBLE_DEBUGGING_DIAGNOSIS_MODEL_PROVIDER
  )
}

function isValidTimeout(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 1 &&
    value <= MAX_DEBUGGING_DIAGNOSIS_MODEL_TIMEOUT_MS
  )
}
