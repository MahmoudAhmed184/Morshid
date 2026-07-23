import type {
  CompletionAdapter,
  PreparedCompletionRequest,
} from './completion-adapter'
import type { CompletionResult } from './completion-provider'
import { CompletionProviderError } from './completion-provider'
import { hasAtMostCodePoints, readAbortSignalAborted } from './completion-input'
import { GROUNDED_COMPLETION_PROMPT_VERSION } from './grounded-completion-envelope'
import { MAX_COMPLETION_OUTPUT_CODE_POINTS } from './validated-completion.provider'

export const STUDENT_BEDROCK_GATEWAY_PROVIDER = 'student-bedrock-gateway'
export const DEFAULT_SBG_BASE_URL = 'https://apiaccess.iti.net.eg/api/v1'
export const DEFAULT_SBG_MODEL_ID = 'anthropic.claude-haiku-4-5-20251001-v1:0'
export const DEFAULT_SBG_MAX_TOKENS = 1_024
export const MIN_SBG_MAX_TOKENS = 1
export const MAX_SBG_MAX_TOKENS = 4_096
export const MAX_SBG_RESPONSE_BYTES = 64 * 1_024
export const MAX_SBG_API_KEY_LENGTH = 4_096
export const MAX_SBG_MODEL_ID_LENGTH = 120
export const MAX_SBG_BASE_URL_LENGTH = 2_048

const SBG_MODEL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u

export interface StudentBedrockGatewayConfiguration {
  readonly baseUrl: string
  readonly apiKey: string
  readonly modelId: string
  readonly maxTokens: number
}

type FetchImplementation = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>

interface StudentBedrockGatewayResponse {
  readonly output_text: string
}

// The ITI gateway, rather than AWS, is the only network boundary. It owns AWS
// credentials, allow-lists, budgets, and usage accounting. This adapter makes
// exactly one POST because the gateway documents no idempotency contract.
export class StudentBedrockGatewayCompletionProvider implements CompletionAdapter {
  private readonly endpoint: string
  private readonly authorization: string
  private readonly modelId: string
  private readonly maxTokens: number

  constructor(
    configuration: StudentBedrockGatewayConfiguration,
    private readonly fetchImplementation: FetchImplementation = globalThis.fetch,
  ) {
    const snapshot = validateConfiguration(configuration)
    this.endpoint = `${snapshot.baseUrl}/student/chat`
    this.authorization = `Bearer ${snapshot.apiKey}`
    this.modelId = snapshot.modelId
    this.maxTokens = snapshot.maxTokens
  }

  async complete(
    request: PreparedCompletionRequest,
  ): Promise<CompletionResult> {
    if (readAbortSignalAborted(request.signal)) {
      throw new CompletionProviderError('COMPLETION_CANCELLED')
    }

    try {
      const response = await this.fetchImplementation(this.endpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: this.authorization,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model_id: this.modelId,
          system_prompt: request.messages[0].content,
          messages: [
            {
              role: request.messages[1].role,
              content: request.messages[1].content,
            },
          ],
          max_tokens: this.maxTokens,
        }),
        redirect: 'error',
        signal: request.signal,
      })

      if ((response.status >= 300 && response.status < 400) || !response.ok) {
        throw new TypeError('Gateway request failed')
      }

      const responseBody = await readBoundedResponseBody(response)
      const gatewayResponse = parseGatewayResponse(responseBody)

      return Object.freeze({
        content: gatewayResponse.output_text,
        provider: STUDENT_BEDROCK_GATEWAY_PROVIDER,
        model: this.modelId,
        promptVersion: GROUNDED_COMPLETION_PROMPT_VERSION,
      })
    } catch {
      if (readAbortSignalAborted(request.signal)) {
        throw new CompletionProviderError('COMPLETION_CANCELLED')
      }
      throw new CompletionProviderError('COMPLETION_PROVIDER_FAILURE')
    }
  }
}

function validateConfiguration(
  configuration: unknown,
): StudentBedrockGatewayConfiguration {
  try {
    if (typeof configuration !== 'object' || configuration === null) {
      throw new TypeError('Invalid gateway configuration')
    }

    const configurationRecord = configuration as Record<PropertyKey, unknown>
    const baseUrl = Reflect.get(configurationRecord, 'baseUrl')
    const apiKey = Reflect.get(configurationRecord, 'apiKey')
    const modelId = Reflect.get(configurationRecord, 'modelId')
    const maxTokens = Reflect.get(configurationRecord, 'maxTokens')
    if (
      typeof baseUrl !== 'string' ||
      baseUrl.length > MAX_SBG_BASE_URL_LENGTH ||
      typeof apiKey !== 'string' ||
      apiKey.trim() === '' ||
      apiKey !== apiKey.trim() ||
      apiKey.length > MAX_SBG_API_KEY_LENGTH ||
      hasForbiddenHeaderCharacter(apiKey) ||
      typeof modelId !== 'string' ||
      modelId.length > MAX_SBG_MODEL_ID_LENGTH ||
      !SBG_MODEL_ID_PATTERN.test(modelId) ||
      typeof maxTokens !== 'number' ||
      !Number.isSafeInteger(maxTokens) ||
      maxTokens < MIN_SBG_MAX_TOKENS ||
      maxTokens > MAX_SBG_MAX_TOKENS
    ) {
      throw new TypeError('Invalid gateway configuration')
    }

    const url = new URL(baseUrl)
    if (
      url.protocol !== 'https:' ||
      url.username !== '' ||
      url.password !== '' ||
      url.search !== '' ||
      url.hash !== ''
    ) {
      throw new TypeError('Invalid gateway URL')
    }

    const normalizedBaseUrl = url.toString().replace(/\/+$/u, '')
    return Object.freeze({
      baseUrl: normalizedBaseUrl,
      apiKey,
      modelId,
      maxTokens,
    })
  } catch {
    throw new CompletionProviderError('COMPLETION_CONFIGURATION_INVALID')
  }
}

async function readBoundedResponseBody(response: Response): Promise<string> {
  if (response.body === null) {
    throw new TypeError('Gateway response has no body')
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let byteLength = 0

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }
      if (!(value instanceof Uint8Array)) {
        throw new TypeError('Invalid gateway response chunk')
      }

      byteLength += value.byteLength
      if (byteLength > MAX_SBG_RESPONSE_BYTES) {
        await reader.cancel()
        throw new TypeError('Gateway response is too large')
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const bytes = new Uint8Array(byteLength)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }

  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
}

function hasForbiddenHeaderCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0)
    if (codePoint !== undefined && (codePoint <= 0x1f || codePoint === 0x7f)) {
      return true
    }
  }
  return false
}

function parseGatewayResponse(body: string): StudentBedrockGatewayResponse {
  const parsed: unknown = JSON.parse(body)
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    Array.isArray(parsed) ||
    !Object.hasOwn(parsed, 'output_text')
  ) {
    throw new TypeError('Invalid gateway response')
  }

  const outputText: unknown = Reflect.get(parsed, 'output_text')
  if (
    typeof outputText !== 'string' ||
    outputText.trim() === '' ||
    !hasAtMostCodePoints(outputText, MAX_COMPLETION_OUTPUT_CODE_POINTS)
  ) {
    throw new TypeError('Invalid gateway output')
  }

  return Object.freeze({ output_text: outputText })
}
