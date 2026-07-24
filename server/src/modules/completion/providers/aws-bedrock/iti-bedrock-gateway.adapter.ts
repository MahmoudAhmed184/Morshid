import type {
  CompletionAdapter,
  PreparedCompletionRequest,
} from '../../completion-adapter'
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

// ITI is the only AWS transport and owns the AWS credentials, budgets, account
// policy, and usage accounting. Without an idempotency contract, this adapter
// makes exactly one POST and never retries or falls back.
export class ItiBedrockGatewayAdapter implements CompletionAdapter {
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
        provider: AWS_BEDROCK_COMPLETION_PROVIDER,
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
      if (byteLength > MAX_ITI_BEDROCK_RESPONSE_BYTES) {
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

function parseGatewayResponse(body: string): ItiBedrockGatewayResponse {
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
