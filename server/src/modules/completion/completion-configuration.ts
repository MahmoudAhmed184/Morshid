import {
  DEFAULT_ITI_GATEWAY_BASE_URL,
  ITI_GATEWAY_HOST,
  ITI_GATEWAY_PATH,
  MAX_ITI_GATEWAY_API_KEY_LENGTH,
  MAX_ITI_GATEWAY_BASE_URL_LENGTH,
  type UpstreamEnvironment,
  isInsecureItiGatewayBaseUrl,
  isValidItiGatewayApiKey,
  validateItiGatewayBaseUrl,
} from '../../common/upstream/iti-gateway-transport'
import { CompletionProviderError } from './completion-provider'
import {
  DEFAULT_GEMINI_MODEL,
  MAX_GEMINI_API_KEY_LENGTH,
  MAX_GEMINI_MODEL_ID_LENGTH,
} from './providers/gemini/gemini-completion.constants'
import {
  MAX_COMPLETION_MODEL_LENGTH,
  MAX_COMPLETION_OUTPUT_CODE_POINTS,
} from './validated-completion.provider'

// Gemini's raw constants are declared next to its adapter, which is their other
// consumer. They are re-exported here so this file stays the single completion
// vocabulary surface, exactly as it already is for aws-bedrock: nothing outside
// `completion/` reaches into `completion/providers/`.
export {
  DEFAULT_GEMINI_MODEL,
  MAX_GEMINI_API_KEY_LENGTH,
  MAX_GEMINI_MODEL_ID_LENGTH,
}

export const AWS_BEDROCK_COMPLETION_PROVIDER = 'aws-bedrock'
export const DETERMINISTIC_COMPLETION_PROVIDER = 'deterministic'
export const GEMINI_COMPLETION_PROVIDER = 'gemini'

// The gateway URL and credential policy lives in `common/upstream`, because
// embedding addresses the same host with the same bearer key and an SSRF guard
// may not exist in two copies that can drift. These aliases keep this module's
// existing `ITI_BEDROCK_*` vocabulary — and every call site — unchanged.
export const ITI_BEDROCK_GATEWAY_HOST = ITI_GATEWAY_HOST
export const ITI_BEDROCK_GATEWAY_PATH = ITI_GATEWAY_PATH
export const DEFAULT_ITI_BEDROCK_GATEWAY_BASE_URL = DEFAULT_ITI_GATEWAY_BASE_URL
export const validateItiBedrockBaseUrl = validateItiGatewayBaseUrl
export const isInsecureItiBedrockBaseUrl = isInsecureItiGatewayBaseUrl
export const isValidItiBedrockApiKey = isValidItiGatewayApiKey

export const DEFAULT_AWS_BEDROCK_MAX_TOKENS = 1_024
// docs/aws-bedrock-iti-gateway-research.md records `max_tokens=16` answering
// HTTP 200 with a zero-length output while still emitting a usage event, so a
// too-small budget bills every turn and returns nothing. The floor is set well
// above the probed blank-output ceiling.
export const MIN_AWS_BEDROCK_MAX_TOKENS = 256
export const MAX_AWS_BEDROCK_MAX_TOKENS = 4_096

// The gateway answer is bounded in code points, not bytes, and this is an
// Arabic-facing product: Arabic costs 2 UTF-8 bytes per code point and emoji
// cost 4. Deriving the byte cap from the code-point cap keeps a legitimate
// maximum-length Arabic answer from being rejected as a provider failure.
const MAX_UTF8_BYTES_PER_CODE_POINT = 4
const ITI_BEDROCK_RESPONSE_ENVELOPE_SLACK_BYTES = 8 * 1_024
const ITI_BEDROCK_RESPONSE_FLOOR_BYTES = 256 * 1_024
export const MAX_ITI_BEDROCK_RESPONSE_BYTES = Math.max(
  ITI_BEDROCK_RESPONSE_FLOOR_BYTES,
  MAX_COMPLETION_OUTPUT_CODE_POINTS * MAX_UTF8_BYTES_PER_CODE_POINT +
    ITI_BEDROCK_RESPONSE_ENVELOPE_SLACK_BYTES,
)

export const MAX_ITI_BEDROCK_API_KEY_LENGTH = MAX_ITI_GATEWAY_API_KEY_LENGTH
export const MAX_ITI_BEDROCK_BASE_URL_LENGTH = MAX_ITI_GATEWAY_BASE_URL_LENGTH
// The model string is echoed back in every completion result, where
// ValidatedCompletionProvider bounds it. Deriving the inbound bound from the
// outbound one keeps a raised gateway cap from turning into an opaque
// COMPLETION_INVALID_RESULT on every request.
export const MAX_AWS_BEDROCK_MODEL_ID_LENGTH = MAX_COMPLETION_MODEL_LENGTH
export const MAX_AWS_BEDROCK_ALLOWED_MODEL_IDS = 50
export const MAX_AWS_BEDROCK_ALLOWED_MODEL_IDS_LENGTH =
  MAX_AWS_BEDROCK_ALLOWED_MODEL_IDS * (MAX_AWS_BEDROCK_MODEL_ID_LENGTH + 1)

export const ITI_BEDROCK_INSECURE_HTTP_WARNING =
  'AWS Bedrock completion is using the explicitly configured insecure ITI development transport.'

// Internal to the model-ID predicate below: callers validate through
// isValidAwsBedrockModelId so the rule has exactly one entry point.
const AWS_BEDROCK_MODEL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u

// Gemini model codes are published lower-case with dots, dashes, and digits
// (`gemini-3.5-flash-lite`). No colon: unlike Bedrock there is no `:0` revision
// suffix in a Gemini model ID.
// Internal to the model-ID predicate below, matching the Bedrock pattern above:
// callers validate through isValidGeminiModelId so the rule has one entry point.
const GEMINI_MODEL_ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/u

export type CompletionEnvironment = UpstreamEnvironment

export type AwsBedrockAllowedModelIdsRejection =
  'invalid-model-id' | 'duplicate-model-id' | 'too-many-model-ids'

export type AwsBedrockAllowedModelIdsResult =
  | { readonly ok: true; readonly modelIds: readonly string[] }
  | {
      readonly ok: false
      readonly rejection: AwsBedrockAllowedModelIdsRejection
    }

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
      !isValidItiBedrockApiKey(apiKey) ||
      !isValidAwsBedrockModelId(modelId) ||
      !Array.isArray(allowedModelIds) ||
      allowedModelIds.length === 0 ||
      !isValidAwsBedrockMaxTokens(maxTokens) ||
      typeof allowInsecureHttp !== 'boolean' ||
      !isCompletionEnvironment(environment)
    ) {
      throw new TypeError('Invalid configuration')
    }

    const allowedModels = parseAwsBedrockAllowedModelIds(allowedModelIds)
    if (!allowedModels.ok) {
      throw new TypeError('Invalid allowed models')
    }
    if (!allowedModels.modelIds.includes(modelId)) {
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
      allowedModelIds: allowedModels.modelIds,
      maxTokens,
      allowInsecureHttp,
      environment,
    })
  } catch {
    throw new CompletionProviderError('COMPLETION_CONFIGURATION_INVALID')
  }
}

export function isValidAwsBedrockModelId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_AWS_BEDROCK_MODEL_ID_LENGTH &&
    AWS_BEDROCK_MODEL_ID_PATTERN.test(value)
  )
}

// The single owner of Gemini model-ID vocabulary, mirroring
// `isValidAwsBedrockModelId` above. The startup environment schema and the
// adapter's runtime configuration check must both parse through this, or the
// two entry points drift apart — a startup-only regex would let a model ID that
// the schema rejects still reach the provider through the factory.
export function isValidGeminiModelId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_GEMINI_MODEL_ID_LENGTH &&
    GEMINI_MODEL_ID_PATTERN.test(value)
  )
}

// Internal: the environment schema enforces the same bounds through the shared
// MIN/MAX constants, so this is the runtime-side half of one rule, not a second.
function isValidAwsBedrockMaxTokens(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= MIN_AWS_BEDROCK_MAX_TOKENS &&
    value <= MAX_AWS_BEDROCK_MAX_TOKENS
  )
}

// The single owner of allow-list vocabulary: both the startup environment
// schema and the runtime gateway configuration parse through this, so the two
// entry points cannot drift apart.
export function parseAwsBedrockAllowedModelIds(
  values: readonly unknown[],
): AwsBedrockAllowedModelIdsResult {
  const modelIds: string[] = []
  const seen = new Set<string>()

  for (const value of values) {
    if (!isValidAwsBedrockModelId(value)) {
      return Object.freeze({ ok: false, rejection: 'invalid-model-id' })
    }
    if (seen.has(value)) {
      return Object.freeze({ ok: false, rejection: 'duplicate-model-id' })
    }
    seen.add(value)
    modelIds.push(value)
  }

  if (modelIds.length > MAX_AWS_BEDROCK_ALLOWED_MODEL_IDS) {
    return Object.freeze({ ok: false, rejection: 'too-many-model-ids' })
  }

  return Object.freeze({ ok: true, modelIds: Object.freeze(modelIds) })
}

function isCompletionEnvironment(
  value: unknown,
): value is CompletionEnvironment {
  return value === 'development' || value === 'test' || value === 'production'
}
