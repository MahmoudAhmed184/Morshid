import { CompletionProviderError } from './completion-provider'
import { hasAtMostCodePoints } from './completion-input'

export const AWS_BEDROCK_COMPLETION_PROVIDER = 'aws-bedrock'
export const DETERMINISTIC_COMPLETION_PROVIDER = 'deterministic'

export const DEFAULT_ITI_BEDROCK_GATEWAY_BASE_URL =
  'https://apiaccess.iti.net.eg/api/v1'
export const ITI_BEDROCK_HTTP_GATEWAY_BASE_URL =
  'http://apiaccess.iti.net.eg/api/v1'
export const DEFAULT_AWS_BEDROCK_MAX_TOKENS = 1_024
export const MIN_AWS_BEDROCK_MAX_TOKENS = 1
export const MAX_AWS_BEDROCK_MAX_TOKENS = 4_096
export const MAX_ITI_BEDROCK_RESPONSE_BYTES = 64 * 1_024
export const MAX_ITI_BEDROCK_API_KEY_LENGTH = 4_096
export const MAX_ITI_BEDROCK_BASE_URL_LENGTH = 2_048
export const MAX_AWS_BEDROCK_MODEL_ID_LENGTH = 120
export const MAX_AWS_BEDROCK_ALLOWED_MODEL_IDS = 50
export const MAX_AWS_BEDROCK_ALLOWED_MODEL_IDS_LENGTH =
  MAX_AWS_BEDROCK_ALLOWED_MODEL_IDS * (MAX_AWS_BEDROCK_MODEL_ID_LENGTH + 1)

export const ITI_BEDROCK_INSECURE_HTTP_WARNING =
  'AWS Bedrock completion is using the explicitly configured insecure ITI development transport.'

export const AWS_BEDROCK_MODEL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u

export type CompletionEnvironment = 'development' | 'test' | 'production'

export interface AwsBedrockConfiguration {
  readonly baseUrl: string
  readonly apiKey: string
  readonly modelId: string
  readonly allowedModelIds: readonly string[]
  readonly maxTokens: number
  readonly allowInsecureHttp: boolean
  readonly environment: CompletionEnvironment
}

export interface ValidatedAwsBedrockConfiguration extends AwsBedrockConfiguration {
  readonly endpoint: string
  readonly insecureHttp: boolean
}

export function validateAwsBedrockConfiguration(
  configuration: unknown,
): ValidatedAwsBedrockConfiguration {
  try {
    if (typeof configuration !== 'object' || configuration === null) {
      throw new TypeError('Invalid configuration')
    }

    const record = configuration as Record<PropertyKey, unknown>
    const baseUrl = Reflect.get(record, 'baseUrl')
    const apiKey = Reflect.get(record, 'apiKey')
    const modelId = Reflect.get(record, 'modelId')
    const allowedModelIds = Reflect.get(record, 'allowedModelIds')
    const maxTokens = Reflect.get(record, 'maxTokens')
    const allowInsecureHttp = Reflect.get(record, 'allowInsecureHttp')
    const environment = Reflect.get(record, 'environment')

    if (
      typeof baseUrl !== 'string' ||
      baseUrl.length === 0 ||
      baseUrl.length > MAX_ITI_BEDROCK_BASE_URL_LENGTH ||
      typeof apiKey !== 'string' ||
      apiKey.length === 0 ||
      apiKey.length > MAX_ITI_BEDROCK_API_KEY_LENGTH ||
      apiKey !== apiKey.trim() ||
      hasControlCharacter(apiKey) ||
      typeof modelId !== 'string' ||
      modelId.length > MAX_AWS_BEDROCK_MODEL_ID_LENGTH ||
      !AWS_BEDROCK_MODEL_ID_PATTERN.test(modelId) ||
      !Array.isArray(allowedModelIds) ||
      allowedModelIds.length === 0 ||
      allowedModelIds.length > MAX_AWS_BEDROCK_ALLOWED_MODEL_IDS ||
      typeof maxTokens !== 'number' ||
      !Number.isSafeInteger(maxTokens) ||
      maxTokens < MIN_AWS_BEDROCK_MAX_TOKENS ||
      maxTokens > MAX_AWS_BEDROCK_MAX_TOKENS ||
      typeof allowInsecureHttp !== 'boolean' ||
      !isCompletionEnvironment(environment)
    ) {
      throw new TypeError('Invalid configuration')
    }

    const allowedModelSnapshot = validateAllowedModelIds(allowedModelIds)
    if (!allowedModelSnapshot.includes(modelId)) {
      throw new TypeError('Selected model is not allowed')
    }

    const url = validateItiBedrockBaseUrl(
      baseUrl,
      environment,
      allowInsecureHttp,
    )
    const normalizedBaseUrl = url.toString().replace(/\/+$/u, '')

    return Object.freeze({
      baseUrl: normalizedBaseUrl,
      endpoint: `${normalizedBaseUrl}/student/chat`,
      apiKey,
      modelId,
      allowedModelIds: allowedModelSnapshot,
      maxTokens,
      allowInsecureHttp,
      environment,
      insecureHttp: url.protocol === 'http:',
    })
  } catch {
    throw new CompletionProviderError('COMPLETION_CONFIGURATION_INVALID')
  }
}

export function validateItiBedrockBaseUrl(
  value: string,
  environment: CompletionEnvironment,
  allowInsecureHttp: boolean,
): URL {
  const url = new URL(value)
  if (
    url.username !== '' ||
    url.password !== '' ||
    url.search !== '' ||
    url.hash !== ''
  ) {
    throw new TypeError('Invalid gateway URL')
  }

  if (url.protocol === 'https:') {
    return url
  }

  const normalizedPath = url.pathname.replace(/\/+$/u, '')
  if (
    url.protocol !== 'http:' ||
    environment === 'production' ||
    !allowInsecureHttp ||
    url.hostname !== 'apiaccess.iti.net.eg' ||
    url.port !== '' ||
    normalizedPath !== '/api/v1'
  ) {
    throw new TypeError('Invalid gateway URL')
  }

  return url
}

function validateAllowedModelIds(value: readonly unknown[]): readonly string[] {
  const snapshot: string[] = []
  const seen = new Set<string>()

  for (const modelId of value) {
    if (
      typeof modelId !== 'string' ||
      modelId.length > MAX_AWS_BEDROCK_MODEL_ID_LENGTH ||
      !AWS_BEDROCK_MODEL_ID_PATTERN.test(modelId) ||
      seen.has(modelId)
    ) {
      throw new TypeError('Invalid allowed model')
    }
    seen.add(modelId)
    snapshot.push(modelId)
  }

  return Object.freeze(snapshot)
}

function isCompletionEnvironment(
  value: unknown,
): value is CompletionEnvironment {
  return value === 'development' || value === 'test' || value === 'production'
}

function hasControlCharacter(value: string): boolean {
  return (
    !hasAtMostCodePoints(value, MAX_ITI_BEDROCK_API_KEY_LENGTH) ||
    Array.from(value).some((character) => {
      const codePoint = character.codePointAt(0)
      return (
        codePoint !== undefined && (codePoint <= 0x1f || codePoint === 0x7f)
      )
    })
  )
}
