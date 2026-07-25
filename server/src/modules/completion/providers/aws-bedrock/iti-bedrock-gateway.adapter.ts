import { Logger } from '@nestjs/common'

import type {
  CompletionAdapter,
  PreparedCompletionRequest,
} from '../../completion-adapter'
import { assertPreparedMessageOrder } from '../../completion-adapter'
import {
  AWS_BEDROCK_COMPLETION_PROVIDER,
  MAX_ITI_BEDROCK_RESPONSE_BYTES,
  type AwsBedrockConfiguration,
  validateAwsBedrockConfiguration,
} from '../../completion-configuration'
import type { CompletionResult } from '../../completion-provider'
import { CompletionProviderError } from '../../completion-provider'
import {
  hasAtMostCodePoints,
  readAbortSignalAborted,
} from '../../completion-input'
import { GROUNDED_COMPLETION_PROMPT_VERSION } from '../../grounded-completion-envelope'
import { MAX_COMPLETION_OUTPUT_CODE_POINTS } from '../../validated-completion.provider'

type FetchImplementation = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>

interface ItiBedrockGatewayResponse {
  readonly output_text: string
}

// Every distinguishable upstream failure collapses into one public error code,
// so without these categories an operator cannot tell a revoked key from an
// unapproved model, an exhausted budget, or a DNS failure. The category is a
// server-log-only fact; it is never attached to the thrown error.
type ItiBedrockGatewayFailureCategory =
  | 'http_status'
  | 'transport'
  | 'oversized_response'
  | 'malformed_response'
  | 'invalid_output'
  | 'blank_output'
  | 'cancelled'

// Internal diagnostic carrier. It never escapes `complete`: the public error
// model stays fixed and cause-free so no status, body, or credential detail can
// reach a caller.
class ItiBedrockGatewayFailure extends Error {
  readonly category: ItiBedrockGatewayFailureCategory
  readonly status: number | undefined

  constructor(category: ItiBedrockGatewayFailureCategory, status?: number) {
    super('ITI Bedrock gateway failure')
    this.category = category
    this.status = status
  }
}

// ITI is the only AWS transport and owns the AWS credentials, budgets, account
// policy, and usage accounting. Without an idempotency contract, this adapter
// makes exactly one POST and never retries or falls back.
export class ItiBedrockGatewayAdapter implements CompletionAdapter {
  private readonly logger = new Logger(ItiBedrockGatewayAdapter.name)
  private readonly endpoint: string
  private readonly authorization: string
  private readonly modelId: string
  private readonly maxTokens: number

  constructor(
    configuration: AwsBedrockConfiguration,
    private readonly fetchImplementation: FetchImplementation = globalThis.fetch,
  ) {
    const snapshot = validateAwsBedrockConfiguration(configuration)
    this.endpoint = snapshot.endpoint
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

    assertPreparedMessageOrder(request)

    try {
      return await this.requestGatewayCompletion(request)
    } catch (error) {
      if (readAbortSignalAborted(request.signal)) {
        this.logGatewayFailure('cancelled', undefined)
        throw new CompletionProviderError('COMPLETION_CANCELLED')
      }

      if (error instanceof ItiBedrockGatewayFailure) {
        this.logGatewayFailure(error.category, error.status)
      } else {
        // Anything the adapter did not classify came out of `fetch` itself:
        // DNS resolution, TLS negotiation, a reset connection, or the
        // `redirect: 'error'` policy rejecting a redirect.
        this.logGatewayFailure('transport', undefined)
      }
      throw new CompletionProviderError('COMPLETION_PROVIDER_FAILURE')
    }
  }

  private async requestGatewayCompletion(
    request: PreparedCompletionRequest,
  ): Promise<CompletionResult> {
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
      // A redirect would replay the bearer-authenticated POST at an unvetted
      // origin, so a real `fetch` rejects before any 3xx `Response` can exist
      // and `Response.ok` already covers 3xx for every mocked transport.
      redirect: 'error',
      signal: request.signal,
    })

    if (!response.ok) {
      // The body is discarded, but it still has to be released: an undici
      // response body above the auto-dump threshold keeps its socket open
      // forever otherwise, and a proxy error page during an ITI outage is
      // exactly that shape.
      await discardResponseBody(response)
      throw new ItiBedrockGatewayFailure('http_status', response.status)
    }

    const responseBody = await readBoundedResponseBody(response)
    const gatewayResponse = parseGatewayResponse(responseBody)

    return Object.freeze({
      content: gatewayResponse.output_text,
      provider: AWS_BEDROCK_COMPLETION_PROVIDER,
      model: this.modelId,
      promptVersion: GROUNDED_COMPLETION_PROMPT_VERSION,
    })
  }

  // Diagnostics are deliberately limited to non-sensitive facts: the HTTP
  // status, the internal failure category, and the allow-listed model id. The
  // api key, the endpoint, the prompt, the student content, and every byte of
  // the gateway response are excluded by construction.
  private logGatewayFailure(
    category: ItiBedrockGatewayFailureCategory,
    status: number | undefined,
  ): void {
    const diagnostic = `ITI Bedrock gateway completion failed (category=${category}, status=${status === undefined ? 'none' : String(status)}, model=${this.modelId})`

    if (category === 'cancelled') {
      this.logger.warn(diagnostic)
      return
    }
    this.logger.error(diagnostic)
  }
}

async function readBoundedResponseBody(response: Response): Promise<string> {
  if (response.body === null) {
    throw new ItiBedrockGatewayFailure('malformed_response')
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let byteLength = 0
  let drained = false

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) {
        drained = true
        break
      }
      if (!(value instanceof Uint8Array)) {
        throw new ItiBedrockGatewayFailure('malformed_response')
      }

      byteLength += value.byteLength
      if (byteLength > MAX_ITI_BEDROCK_RESPONSE_BYTES) {
        throw new ItiBedrockGatewayFailure('oversized_response')
      }
      chunks.push(value)
    }
  } finally {
    // Uniform for every non-completing exit — invalid chunk, oversize, or a
    // stream error. Releasing the lock alone would leave the socket open.
    if (!drained) {
      await cancelSafely(reader)
    }
    reader.releaseLock()
  }

  const bytes = new Uint8Array(byteLength)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new ItiBedrockGatewayFailure('malformed_response')
  }
}

async function discardResponseBody(response: Response): Promise<void> {
  const body = response.body
  if (body === null) {
    return
  }
  await cancelSafely(body)
}

async function cancelSafely(cancellable: {
  cancel: () => Promise<void>
}): Promise<void> {
  try {
    await cancellable.cancel()
  } catch {
    // Discarding an already-failed body must not mask the original failure.
  }
}

function parseGatewayResponse(body: string): ItiBedrockGatewayResponse {
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    throw new ItiBedrockGatewayFailure('malformed_response')
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    Array.isArray(parsed) ||
    !Object.hasOwn(parsed, 'output_text')
  ) {
    throw new ItiBedrockGatewayFailure('malformed_response')
  }

  const outputText: unknown = Reflect.get(parsed, 'output_text')
  if (typeof outputText !== 'string') {
    throw new ItiBedrockGatewayFailure('malformed_response')
  }

  // HTTP 200 with a blank answer means ITI already accepted, billed, and
  // accounted the turn; it is not a transport or auth failure and must not read
  // like one in the log.
  if (outputText.trim() === '') {
    throw new ItiBedrockGatewayFailure('blank_output')
  }

  if (!hasAtMostCodePoints(outputText, MAX_COMPLETION_OUTPUT_CODE_POINTS)) {
    throw new ItiBedrockGatewayFailure('invalid_output')
  }

  return Object.freeze({ output_text: outputText })
}
