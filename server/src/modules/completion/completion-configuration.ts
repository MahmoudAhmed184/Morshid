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

// The single ITI-operated gateway. HTTPS deployments stay configurable so a
// staging gateway can be pointed at, but the insecure HTTP exception is pinned
// to exactly this host and path.
export const ITI_BEDROCK_GATEWAY_HOST = 'apiaccess.iti.net.eg'
export const ITI_BEDROCK_GATEWAY_PATH = '/api/v1'
export const DEFAULT_ITI_BEDROCK_GATEWAY_BASE_URL = `https://${ITI_BEDROCK_GATEWAY_HOST}${ITI_BEDROCK_GATEWAY_PATH}`

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

export const MAX_ITI_BEDROCK_API_KEY_LENGTH = 4_096
export const MAX_ITI_BEDROCK_BASE_URL_LENGTH = 2_048
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

export const AWS_BEDROCK_MODEL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u

// Gemini model codes are published lower-case with dots, dashes, and digits
// (`gemini-3.5-flash-lite`). No colon: unlike Bedrock there is no `:0` revision
// suffix in a Gemini model ID.
export const GEMINI_MODEL_ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/u

// The key is sent as an `Authorization` header value on every request, and the
// Headers constructor throws on anything outside Latin-1. Requiring printable
// ASCII keeps that failure at startup instead of once per completion, and
// subsumes the control-character and surrounding-whitespace rules.
const MIN_PRINTABLE_ASCII_CODE_POINT = 0x21
const MAX_PRINTABLE_ASCII_CODE_POINT = 0x7e

export type CompletionEnvironment = 'development' | 'test' | 'production'

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

export function validateItiBedrockBaseUrl(
  value: string,
  environment: CompletionEnvironment,
  allowInsecureHttp: boolean,
): URL {
  const url = new URL(value)
  // WHATWG sets `search`/`hash` to '' for a *bare* `?` or `#` while keeping the
  // delimiter in the serialization, so a base URL of `https://host/collect#`
  // would turn the endpoint into `https://host/collect#/student/chat` and send
  // the bearer-authenticated POST to the wrong path. Reject on the
  // serialization instead of the components.
  const serialized = url.toString()
  if (
    url.username !== '' ||
    url.password !== '' ||
    serialized.includes('?') ||
    serialized.includes('#')
  ) {
    throw new TypeError('Invalid gateway URL')
  }

  // Defence in depth: the gateway URL must stay configurable for staging, but
  // it may never address the local host or a private/link-local network, or a
  // stale value would ship the bearer key to a metadata service.
  if (isPrivateNetworkHostname(url.hostname)) {
    throw new TypeError('Invalid gateway URL')
  }

  if (url.protocol === 'https:') {
    return url
  }

  const normalizedPath = url.pathname.replace(/\/+$/u, '')
  if (
    !isInsecureItiBedrockBaseUrl(serialized) ||
    environment === 'production' ||
    !allowInsecureHttp ||
    url.hostname !== ITI_BEDROCK_GATEWAY_HOST ||
    url.port !== '' ||
    normalizedPath !== ITI_BEDROCK_GATEWAY_PATH
  ) {
    throw new TypeError('Invalid gateway URL')
  }

  return url
}

// The single owner of "is this transport insecure?", shared by the base-URL
// policy above and by the module that emits the startup warning. `new URL()`
// lower-cases the scheme, so `HTTP://apiaccess.iti.net.eg/api/v1` — which
// `z.url()` accepts verbatim and which really does put the bearer key on the
// wire in plaintext — is recognized here, unlike a raw string prefix test.
export function isInsecureItiBedrockBaseUrl(baseUrl: string): boolean {
  try {
    return new URL(baseUrl).protocol === 'http:'
  } catch {
    // An unparseable value never reaches a request: startup validation rejects
    // it, so there is no insecure transport to warn about.
    return false
  }
}

export function isValidItiBedrockApiKey(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_ITI_BEDROCK_API_KEY_LENGTH &&
    isPrintableAscii(value)
  )
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

export function isValidAwsBedrockMaxTokens(value: unknown): value is number {
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

function isPrintableAscii(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0)
    if (
      codePoint === undefined ||
      codePoint < MIN_PRINTABLE_ASCII_CODE_POINT ||
      codePoint > MAX_PRINTABLE_ASCII_CODE_POINT
    ) {
      return false
    }
  }
  return true
}

function isPrivateNetworkHostname(hostname: string): boolean {
  const host = hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost')) {
    return true
  }
  if (host.startsWith('[') && host.endsWith(']')) {
    return isPrivateIpv6Address(host.slice(1, -1))
  }

  const octets = parseIpv4Address(host)
  return octets !== undefined && isPrivateIpv4Address(octets)
}

function parseIpv4Address(
  host: string,
): readonly [number, number, number, number] | undefined {
  // `URL` normalizes every accepted IPv4 spelling (`127.1`, `0x7f.0.0.1`) into
  // dotted-decimal, so matching the normalized hostname is sufficient.
  const parts = host.split('.')
  if (parts.length !== 4) {
    return undefined
  }

  const octets: number[] = []
  for (const part of parts) {
    if (!/^\d{1,3}$/u.test(part)) {
      return undefined
    }
    const octet = Number.parseInt(part, 10)
    if (octet > 255) {
      return undefined
    }
    octets.push(octet)
  }

  return [octets[0], octets[1], octets[2], octets[3]] as const
}

function isPrivateIpv4Address(
  octets: readonly [number, number, number, number],
): boolean {
  const [first, second] = octets
  return (
    first === 0 || // 0.0.0.0/8, including the unspecified address
    first === 10 || // 10.0.0.0/8
    first === 127 || // 127.0.0.0/8 loopback
    (first === 169 && second === 254) || // 169.254.0.0/16 link-local metadata
    (first === 172 && second >= 16 && second <= 31) || // 172.16.0.0/12
    (first === 192 && second === 168) // 192.168.0.0/16
  )
}

const IPV6_UNIQUE_LOCAL_MASK = 0xfe00
const IPV6_UNIQUE_LOCAL_PREFIX = 0xfc00
const IPV6_LINK_LOCAL_MASK = 0xffc0
const IPV6_LINK_LOCAL_PREFIX = 0xfe80

function isPrivateIpv6Address(address: string): boolean {
  // `URL` emits the canonical compressed lower-case form, so an address that
  // still compresses from the front is unspecified (`::`), loopback (`::1`),
  // IPv4-compatible, or IPv4-mapped — never a public gateway.
  if (address.startsWith('::')) {
    return true
  }

  const [firstGroupText] = address.split(':')
  const firstGroup = Number.parseInt(firstGroupText, 16)
  if (!Number.isInteger(firstGroup)) {
    return true
  }

  return (
    (firstGroup & IPV6_UNIQUE_LOCAL_MASK) === IPV6_UNIQUE_LOCAL_PREFIX || // fc00::/7
    (firstGroup & IPV6_LINK_LOCAL_MASK) === IPV6_LINK_LOCAL_PREFIX // fe80::/10
  )
}
