import { Logger } from '@nestjs/common'

import type { PreparedCompletionRequest } from '../../completion-adapter'
import {
  AWS_BEDROCK_COMPLETION_PROVIDER,
  DEFAULT_AWS_BEDROCK_MAX_TOKENS,
  ITI_BEDROCK_GATEWAY_HOST,
  ITI_BEDROCK_GATEWAY_PATH,
  MAX_AWS_BEDROCK_ALLOWED_MODEL_IDS,
  MAX_AWS_BEDROCK_MAX_TOKENS,
  MAX_AWS_BEDROCK_MODEL_ID_LENGTH,
  MAX_ITI_BEDROCK_API_KEY_LENGTH,
  MAX_ITI_BEDROCK_BASE_URL_LENGTH,
  MAX_ITI_BEDROCK_RESPONSE_BYTES,
  MIN_AWS_BEDROCK_MAX_TOKENS,
  type AwsBedrockConfiguration,
} from '../../completion-configuration'
import { CompletionProviderError } from '../../completion-provider'
import type { GroundedCompletionMessage } from '../../grounded-completion-envelope'
import { buildGroundedCompletionMessages } from '../../grounded-completion-envelope'
import { MAX_COMPLETION_OUTPUT_CODE_POINTS } from '../../validated-completion.provider'
import { ItiBedrockGatewayAdapter } from './iti-bedrock-gateway.adapter'

const apiKey = '<test-only-placeholder>'
const baseUrl = 'https://gateway.example.test/api/v1'
const systemPromptSentinel = 'authoritative-system-prompt-sentinel'
const userPromptSentinel = 'prepared-user-prompt-sentinel'
const upstreamBodySentinel = 'hostile-upstream-body-sentinel'
const modelId = 'test.approved-model-v1:0'
const pinnedInsecureGatewayUrl = `http://${ITI_BEDROCK_GATEWAY_HOST}${ITI_BEDROCK_GATEWAY_PATH}`

type FetchImplementation = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>

const configuration = (
  overrides: Partial<AwsBedrockConfiguration> = {},
): AwsBedrockConfiguration => ({
  baseUrl,
  apiKey,
  modelId,
  allowedModelIds: [modelId],
  maxTokens: DEFAULT_AWS_BEDROCK_MAX_TOKENS,
  allowInsecureHttp: false,
  environment: 'test',
  ...overrides,
})

const groundedMessage = (
  role: GroundedCompletionMessage['role'],
  content: string,
): GroundedCompletionMessage => Object.freeze({ role, content })

const preparedRequest = (
  signal: AbortSignal = new AbortController().signal,
): PreparedCompletionRequest => ({
  messages: [
    groundedMessage('system', systemPromptSentinel),
    groundedMessage('user', userPromptSentinel),
  ],
  signal,
})

function successfulResponse(outputText = 'Grounded gateway answer'): Response {
  return new Response(JSON.stringify({ output_text: outputText }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

// Builds a JSON gateway body whose UTF-8 encoding is exactly `byteLength`
// bytes, so the `>` boundary of the byte cap can be probed from both sides.
function bodyOfExactByteLength(byteLength: number): string {
  const envelope = JSON.stringify({ output_text: 'valid', padding: '' })
  const padding = byteLength - new TextEncoder().encode(envelope).byteLength
  if (padding < 0) {
    throw new Error('Requested body is smaller than its JSON envelope')
  }

  return JSON.stringify({ output_text: 'valid', padding: 'x'.repeat(padding) })
}

// A stream that stays `readable` (it never closes) so a cancellation actually
// reaches the underlying source, which is the leak these tests guard against.
function unterminatedStreamResponse(chunk: unknown): {
  readonly response: Response
  readonly wasCancelled: () => boolean
} {
  let cancelled = false
  const stream = new ReadableStream({
    pull(controller) {
      controller.enqueue(chunk)
    },
    cancel() {
      cancelled = true
    },
  })

  return {
    response: new Response(stream),
    wasCancelled: () => cancelled,
  }
}

const spyOnLoggerError = () =>
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
const spyOnLoggerWarn = () =>
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)

function loggedDiagnostics(
  spy: ReturnType<typeof spyOnLoggerError> | ReturnType<typeof spyOnLoggerWarn>,
): string {
  return JSON.stringify(spy.mock.calls)
}

// A gateway diagnostic may carry the status, the failure category, and the
// allow-listed model id — and nothing else.
function expectNoLeakedDiagnostics(diagnostics: string): void {
  expect(diagnostics).not.toContain(apiKey)
  expect(diagnostics).not.toContain(`Bearer ${apiKey}`)
  expect(diagnostics).not.toContain(baseUrl)
  expect(diagnostics).not.toContain('gateway.example.test')
  expect(diagnostics).not.toContain(systemPromptSentinel)
  expect(diagnostics).not.toContain(userPromptSentinel)
  expect(diagnostics).not.toContain(upstreamBodySentinel)
}

async function captureFailure(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => null,
    (error: unknown) => error,
  )
}

function expectSafeFailure(
  failure: unknown,
  code: CompletionProviderError['code'],
  privateSentinels: readonly string[] = [],
) {
  expect(failure).toBeInstanceOf(CompletionProviderError)
  expect(failure).toMatchObject({ code })

  // The public error model is deliberately cause-free and carries exactly one
  // own enumerable field. Attaching an upstream error, a response, an abort
  // reason, or a configuration value is the leak this guards against, and it
  // discriminates even though the message itself is a frozen constant.
  expect(Object.keys(failure as object)).toEqual(['code'])
  expect(Object.getOwnPropertyNames(failure)).not.toContain('cause')

  const serialized = JSON.stringify(failure)
  const message = (failure as Error).message
  for (const sentinel of privateSentinels) {
    expect(message).not.toContain(sentinel)
    expect(serialized).not.toContain(sentinel)
  }
}

describe('ItiBedrockGatewayAdapter', () => {
  let loggerError: ReturnType<typeof spyOnLoggerError>
  let loggerWarn: ReturnType<typeof spyOnLoggerWarn>

  beforeEach(() => {
    loggerError = spyOnLoggerError()
    loggerWarn = spyOnLoggerWarn()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('posts the exact mapped request once and returns trusted metadata', async () => {
    const configuredModel = 'us.anthropic.approved-model-v1:0'
    const fetchImplementation = jest
      .fn<ReturnType<FetchImplementation>, Parameters<FetchImplementation>>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            output_text: 'Grounded gateway answer',
            provider: 'hostile-provider-sentinel',
            model: 'hostile-model-sentinel',
            prompt_version: 'hostile-prompt-version-sentinel',
          }),
          { status: 200 },
        ),
      )
    const provider = new ItiBedrockGatewayAdapter(
      configuration({
        baseUrl: `${baseUrl}/`,
        modelId: configuredModel,
        allowedModelIds: [configuredModel],
        maxTokens: 777,
      }),
      fetchImplementation,
    )
    const request = preparedRequest()

    const result = await provider.complete(request)
    expect(result).toEqual({
      content: 'Grounded gateway answer',
      provider: AWS_BEDROCK_COMPLETION_PROVIDER,
      model: configuredModel,
      promptVersion: 'grounded-completion-v1',
    })
    expect(fetchImplementation).toHaveBeenCalledWith(
      `${baseUrl}/student/chat`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model_id: configuredModel,
          system_prompt: systemPromptSentinel,
          messages: [{ role: 'user', content: userPromptSentinel }],
          max_tokens: 777,
        }),
        redirect: 'error',
        signal: request.signal,
      },
    )

    const serializedResult = JSON.stringify(result)
    expect(serializedResult).not.toContain(apiKey)
    expect(serializedResult).not.toContain(`Bearer ${apiKey}`)
    expect(serializedResult).not.toContain(systemPromptSentinel)
    expect(serializedResult).not.toContain(userPromptSentinel)
    expect(serializedResult).not.toContain('hostile-provider-sentinel')
    expect(serializedResult).not.toContain('hostile-model-sentinel')
    expect(serializedResult).not.toContain('hostile-prompt-version-sentinel')
    expect(fetchImplementation).toHaveBeenCalledTimes(1)
    expect(loggerError).not.toHaveBeenCalled()
  })

  it('refuses redirects so the bearer-authenticated POST is never replayed', async () => {
    const fetchImplementation = jest
      .fn<ReturnType<FetchImplementation>, Parameters<FetchImplementation>>()
      .mockResolvedValue(successfulResponse())

    await new ItiBedrockGatewayAdapter(
      configuration(),
      fetchImplementation,
    ).complete(preparedRequest())

    expect(fetchImplementation.mock.calls[0][1]?.redirect).toBe('error')
  })

  it('maps the real prepared grounded messages without changing the envelope', async () => {
    const fetchImplementation = jest
      .fn<ReturnType<FetchImplementation>, Parameters<FetchImplementation>>()
      .mockResolvedValue(successfulResponse())
    const provider = new ItiBedrockGatewayAdapter(
      configuration(),
      fetchImplementation,
    )
    const messages = buildGroundedCompletionMessages({
      studentQuestion: 'How should I study?',
      context: [
        {
          sourceTitle: 'Study guide',
          chunkIndex: 2,
          content: 'Practice the supplied exercise.',
        },
      ],
    })

    await provider.complete({
      messages,
      signal: new AbortController().signal,
    })

    const request = fetchImplementation.mock.calls[0][1]
    expect(JSON.parse(request?.body as string)).toEqual({
      model_id: modelId,
      system_prompt: messages[0].content,
      messages: [{ role: 'user', content: messages[1].content }],
      max_tokens: DEFAULT_AWS_BEDROCK_MAX_TOKENS,
    })
  })

  it.each([
    [
      'the authoritative and untrusted messages are swapped',
      [
        groundedMessage('user', userPromptSentinel),
        groundedMessage('system', systemPromptSentinel),
      ] as const,
    ],
    [
      'both messages carry the untrusted role',
      [
        groundedMessage('user', userPromptSentinel),
        groundedMessage('user', userPromptSentinel),
      ] as const,
    ],
    [
      'both messages carry the authoritative role',
      [
        groundedMessage('system', systemPromptSentinel),
        groundedMessage('system', systemPromptSentinel),
      ] as const,
    ],
  ])('never calls the gateway when %s', async (_, messages) => {
    const fetchImplementation = jest.fn<
      ReturnType<FetchImplementation>,
      Parameters<FetchImplementation>
    >()
    const provider = new ItiBedrockGatewayAdapter(
      configuration(),
      fetchImplementation,
    )

    const failure = await captureFailure(
      provider.complete({
        messages,
        signal: new AbortController().signal,
      }),
    )

    expectSafeFailure(failure, 'COMPLETION_INVALID_REQUEST', [
      systemPromptSentinel,
      userPromptSentinel,
    ])
    expect(fetchImplementation).not.toHaveBeenCalled()
  })

  it('passes cancellation to fetch and reports a fixed cancellation error', async () => {
    const controller = new AbortController()
    const fetchImplementation = jest.fn<
      ReturnType<FetchImplementation>,
      Parameters<FetchImplementation>
    >(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => {
              reject(new Error('private-fetch-abort-reason'))
            },
            { once: true },
          )
        }),
    )
    const provider = new ItiBedrockGatewayAdapter(
      configuration(),
      fetchImplementation,
    )
    const completion = provider.complete(preparedRequest(controller.signal))

    controller.abort('private-caller-abort-reason')
    const failure = await captureFailure(completion)

    expect(fetchImplementation.mock.calls[0][1]?.signal).toBe(controller.signal)
    expectSafeFailure(failure, 'COMPLETION_CANCELLED', [
      apiKey,
      systemPromptSentinel,
      userPromptSentinel,
      'private-fetch-abort-reason',
      'private-caller-abort-reason',
    ])

    // A cancellation is an operator non-event, so it is separated from genuine
    // gateway failures by both category and log level.
    const diagnostics = loggedDiagnostics(loggerWarn)
    expect(diagnostics).toContain('category=cancelled')
    expect(diagnostics).toContain(`model=${modelId}`)
    expect(diagnostics).toContain('status=none')
    expect(diagnostics).not.toContain('private-fetch-abort-reason')
    expect(diagnostics).not.toContain('private-caller-abort-reason')
    expectNoLeakedDiagnostics(diagnostics)
    expect(loggerError).not.toHaveBeenCalled()
  })

  it('does not call fetch for an already-aborted request', async () => {
    const controller = new AbortController()
    controller.abort()
    const fetchImplementation = jest.fn<
      ReturnType<FetchImplementation>,
      Parameters<FetchImplementation>
    >()
    const provider = new ItiBedrockGatewayAdapter(
      configuration(),
      fetchImplementation,
    )

    const failure = await captureFailure(
      provider.complete(preparedRequest(controller.signal)),
    )

    expectSafeFailure(failure, 'COMPLETION_CANCELLED')
    expect(fetchImplementation).not.toHaveBeenCalled()
  })

  it.each([
    [
      'malformed JSON',
      new Response(`{"output_text":"${upstreamBodySentinel}`),
      'malformed_response',
    ],
    [
      'malformed UTF-8',
      new Response(new Uint8Array([0xc3, 0x28])),
      'malformed_response',
    ],
    ['missing body', new Response(null), 'malformed_response'],
    [
      'missing output',
      new Response(JSON.stringify({ result: 'missing' })),
      'malformed_response',
    ],
    [
      'non-string output',
      new Response(JSON.stringify({ output_text: 12 })),
      'malformed_response',
    ],
    // HTTP 200 with a blank answer means ITI already billed the turn; it must
    // not be indistinguishable from a revoked key in the log.
    ['blank output', successfulResponse(' \n\t '), 'blank_output'],
    [
      'oversized output',
      successfulResponse('x'.repeat(MAX_COMPLETION_OUTPUT_CODE_POINTS + 1)),
      'invalid_output',
    ],
    [
      'oversized response body',
      new Response(
        JSON.stringify({
          output_text: 'valid',
          padding: 'x'.repeat(MAX_ITI_BEDROCK_RESPONSE_BYTES),
        }),
      ),
      'oversized_response',
    ],
  ])(
    'rejects a %s with a fixed safe error and a categorised diagnostic',
    async (_, response, category) => {
      const fetchImplementation = jest
        .fn<ReturnType<FetchImplementation>, Parameters<FetchImplementation>>()
        .mockResolvedValue(response)
      const provider = new ItiBedrockGatewayAdapter(
        configuration(),
        fetchImplementation,
      )

      const failure = await captureFailure(provider.complete(preparedRequest()))

      expectSafeFailure(failure, 'COMPLETION_PROVIDER_FAILURE', [
        apiKey,
        systemPromptSentinel,
        userPromptSentinel,
        upstreamBodySentinel,
      ])

      const diagnostics = loggedDiagnostics(loggerError)
      expect(loggerError).toHaveBeenCalledTimes(1)
      expect(diagnostics).toContain(`category=${category}`)
      expect(diagnostics).toContain('status=none')
      expect(diagnostics).toContain(`model=${modelId}`)
      expectNoLeakedDiagnostics(diagnostics)
    },
  )

  it.each([
    ['revoked key', 401],
    ['unapproved model', 403],
    ['exhausted budget', 429],
    ['gateway outage', 503],
  ])(
    'cancels the discarded body of a %s response and logs its status',
    async (_, status) => {
      // Large enough that Node stops auto-dumping the body: below this size the
      // socket is reused, above it every uncancelled failure leaks one.
      const response = new Response(
        `${upstreamBodySentinel}${'x'.repeat(128 * 1_024)}`,
        { status },
      )
      const body = response.body
      if (body === null) {
        throw new Error('Test response body is unexpectedly missing')
      }
      const cancelSpy = jest.spyOn(body, 'cancel')
      const fetchImplementation = jest
        .fn<ReturnType<FetchImplementation>, Parameters<FetchImplementation>>()
        .mockResolvedValue(response)
      const provider = new ItiBedrockGatewayAdapter(
        configuration(),
        fetchImplementation,
      )

      const failure = await captureFailure(provider.complete(preparedRequest()))

      expectSafeFailure(failure, 'COMPLETION_PROVIDER_FAILURE', [
        apiKey,
        systemPromptSentinel,
        userPromptSentinel,
        upstreamBodySentinel,
      ])
      expect(cancelSpy).toHaveBeenCalledTimes(1)
      expect(response.bodyUsed).toBe(true)
      expect(fetchImplementation).toHaveBeenCalledTimes(1)

      const diagnostics = loggedDiagnostics(loggerError)
      expect(diagnostics).toContain('category=http_status')
      expect(diagnostics).toContain(`status=${String(status)}`)
      expect(diagnostics).toContain(`model=${modelId}`)
      expectNoLeakedDiagnostics(diagnostics)
    },
  )

  it.each([
    [
      'an invalid chunk',
      () => unterminatedStreamResponse(upstreamBodySentinel),
      'malformed_response',
    ],
    [
      'an oversized body',
      () =>
        unterminatedStreamResponse(
          new TextEncoder().encode('x'.repeat(MAX_ITI_BEDROCK_RESPONSE_BYTES)),
        ),
      'oversized_response',
    ],
  ])(
    'cancels the response stream when reading aborts on %s',
    async (_, buildResponse, category) => {
      const { response, wasCancelled } = buildResponse()
      const fetchImplementation = jest
        .fn<ReturnType<FetchImplementation>, Parameters<FetchImplementation>>()
        .mockResolvedValue(response)
      const provider = new ItiBedrockGatewayAdapter(
        configuration(),
        fetchImplementation,
      )

      const failure = await captureFailure(provider.complete(preparedRequest()))

      expectSafeFailure(failure, 'COMPLETION_PROVIDER_FAILURE', [
        apiKey,
        upstreamBodySentinel,
      ])
      expect(wasCancelled()).toBe(true)
      expect(loggedDiagnostics(loggerError)).toContain(`category=${category}`)
    },
  )

  it('accepts a response body of exactly MAX_ITI_BEDROCK_RESPONSE_BYTES', async () => {
    const body = bodyOfExactByteLength(MAX_ITI_BEDROCK_RESPONSE_BYTES)
    expect(new TextEncoder().encode(body)).toHaveLength(
      MAX_ITI_BEDROCK_RESPONSE_BYTES,
    )
    const fetchImplementation = jest
      .fn<ReturnType<FetchImplementation>, Parameters<FetchImplementation>>()
      .mockResolvedValue(new Response(body))

    await expect(
      new ItiBedrockGatewayAdapter(
        configuration(),
        fetchImplementation,
      ).complete(preparedRequest()),
    ).resolves.toMatchObject({ content: 'valid', provider: 'aws-bedrock' })
    expect(loggerError).not.toHaveBeenCalled()
  })

  it('rejects a response body one byte over MAX_ITI_BEDROCK_RESPONSE_BYTES', async () => {
    const body = bodyOfExactByteLength(MAX_ITI_BEDROCK_RESPONSE_BYTES + 1)
    expect(new TextEncoder().encode(body)).toHaveLength(
      MAX_ITI_BEDROCK_RESPONSE_BYTES + 1,
    )
    const fetchImplementation = jest
      .fn<ReturnType<FetchImplementation>, Parameters<FetchImplementation>>()
      .mockResolvedValue(new Response(body))

    const failure = await captureFailure(
      new ItiBedrockGatewayAdapter(
        configuration(),
        fetchImplementation,
      ).complete(preparedRequest()),
    )

    expectSafeFailure(failure, 'COMPLETION_PROVIDER_FAILURE')
    expect(loggedDiagnostics(loggerError)).toContain(
      'category=oversized_response',
    )
  })

  it('contains network failures and never retries the POST', async () => {
    const hostileNetworkValue = {
      authorization: `Bearer ${apiKey}`,
      prompt: userPromptSentinel,
      response: upstreamBodySentinel,
    }
    const fetchImplementation = jest
      .fn<ReturnType<FetchImplementation>, Parameters<FetchImplementation>>()
      .mockRejectedValue(hostileNetworkValue)
    const provider = new ItiBedrockGatewayAdapter(
      configuration(),
      fetchImplementation,
    )

    const failure = await captureFailure(provider.complete(preparedRequest()))

    expectSafeFailure(failure, 'COMPLETION_PROVIDER_FAILURE', [
      apiKey,
      `Bearer ${apiKey}`,
      userPromptSentinel,
      upstreamBodySentinel,
    ])
    expect(fetchImplementation).toHaveBeenCalledTimes(1)

    const diagnostics = loggedDiagnostics(loggerError)
    expect(diagnostics).toContain('category=transport')
    expect(diagnostics).toContain('status=none')
    expect(diagnostics).toContain(`model=${modelId}`)
    expectNoLeakedDiagnostics(diagnostics)
  })

  it('accepts the pinned insecure HTTP gateway outside production', () => {
    expect(
      () =>
        new ItiBedrockGatewayAdapter(
          configuration({
            baseUrl: pinnedInsecureGatewayUrl,
            allowInsecureHttp: true,
            environment: 'development',
          }),
        ),
    ).not.toThrow()
  })

  it('rejects the pinned insecure HTTP gateway in production even when explicitly allowed', () => {
    let failure: unknown
    try {
      new ItiBedrockGatewayAdapter(
        configuration({
          baseUrl: pinnedInsecureGatewayUrl,
          allowInsecureHttp: true,
          environment: 'production',
        }),
      )
    } catch (error) {
      failure = error
    }

    expectSafeFailure(failure, 'COMPLETION_CONFIGURATION_INVALID')
  })

  it.each([
    [
      'unapproved HTTP URL',
      configuration({
        baseUrl: 'http://gateway.example.test',
        allowInsecureHttp: true,
      }),
    ],
    [
      'URL credentials',
      configuration({
        baseUrl: 'https://user:password@gateway.example.test',
      }),
    ],
    ['blank key', configuration({ apiKey: '   ' })],
    ['key control character', configuration({ apiKey: 'key\nvalue' })],
    [
      'oversized key',
      configuration({
        apiKey: 'k'.repeat(MAX_ITI_BEDROCK_API_KEY_LENGTH + 1),
      }),
    ],
    ['invalid model', configuration({ modelId: 'model/id' })],
    [
      'oversized model',
      configuration({
        modelId: `m${'x'.repeat(MAX_AWS_BEDROCK_MODEL_ID_LENGTH)}`,
        allowedModelIds: [`m${'x'.repeat(MAX_AWS_BEDROCK_MODEL_ID_LENGTH)}`],
      }),
    ],
    ['model outside allow-list', configuration({ modelId: 'other.model' })],
    ['empty allow-list', configuration({ allowedModelIds: [] })],
    [
      'duplicate allow-list',
      configuration({ allowedModelIds: [modelId, modelId] }),
    ],
    [
      'oversized allow-list',
      configuration({
        allowedModelIds: Array.from(
          { length: MAX_AWS_BEDROCK_ALLOWED_MODEL_IDS + 1 },
          (_, index) => `test.model-${String(index)}`,
        ),
      }),
    ],
    [
      'oversized base URL',
      configuration({
        baseUrl: `https://gateway.example.test/${'x'.repeat(MAX_ITI_BEDROCK_BASE_URL_LENGTH)}`,
      }),
    ],
    [
      'low max tokens',
      configuration({ maxTokens: MIN_AWS_BEDROCK_MAX_TOKENS - 1 }),
    ],
    [
      'high max tokens',
      configuration({ maxTokens: MAX_AWS_BEDROCK_MAX_TOKENS + 1 }),
    ],
  ])('rejects %s without exposing configuration', (_, invalidConfiguration) => {
    let failure: unknown
    try {
      new ItiBedrockGatewayAdapter(invalidConfiguration)
    } catch (error) {
      failure = error
    }

    // `expectSafeFailure` pins the error to its single own `code` field, so no
    // part of the rejected configuration can be riding along.
    expectSafeFailure(failure, 'COMPLETION_CONFIGURATION_INVALID')
  })

  it('contains hostile configuration access without retaining thrown values', () => {
    const privateConfigurationSentinel = 'private-configuration-sentinel'
    const hostileConfiguration = new Proxy(configuration(), {
      get() {
        throw new Error(privateConfigurationSentinel)
      },
    })

    let failure: unknown
    try {
      new ItiBedrockGatewayAdapter(hostileConfiguration)
    } catch (error) {
      failure = error
    }

    expectSafeFailure(failure, 'COMPLETION_CONFIGURATION_INVALID', [
      privateConfigurationSentinel,
      apiKey,
    ])
  })
})
