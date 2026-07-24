import type { PreparedCompletionRequest } from '../../completion-adapter'
import {
  AWS_BEDROCK_COMPLETION_PROVIDER,
  DEFAULT_AWS_BEDROCK_MAX_TOKENS,
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
import { buildGroundedCompletionMessages } from '../../grounded-completion-envelope'
import { MAX_COMPLETION_OUTPUT_CODE_POINTS } from '../../validated-completion.provider'
import { ItiBedrockGatewayAdapter } from './iti-bedrock-gateway.adapter'

const apiKey = '<test-only-placeholder>'
const baseUrl = 'https://gateway.example.test/api/v1'
const systemPromptSentinel = 'authoritative-system-prompt-sentinel'
const userPromptSentinel = 'prepared-user-prompt-sentinel'
const upstreamBodySentinel = 'hostile-upstream-body-sentinel'
const modelId = 'test.approved-model-v1:0'

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

const preparedRequest = (
  signal: AbortSignal = new AbortController().signal,
): PreparedCompletionRequest => ({
  messages: [
    { role: 'system', content: systemPromptSentinel },
    { role: 'user', content: userPromptSentinel },
  ],
  signal,
})

function successfulResponse(outputText = 'Grounded gateway answer'): Response {
  return new Response(JSON.stringify({ output_text: outputText }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
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

  const serialized = JSON.stringify(failure)
  const message = (failure as Error).message
  for (const sentinel of privateSentinels) {
    expect(message).not.toContain(sentinel)
    expect(serialized).not.toContain(sentinel)
  }
}

describe('ItiBedrockGatewayAdapter', () => {
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
    expect(fetchImplementation).toHaveBeenCalledTimes(1)
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
    ['malformed JSON', new Response(`{"output_text":"${upstreamBodySentinel}`)],
    ['malformed UTF-8', new Response(new Uint8Array([0xc3, 0x28]))],
    ['missing body', new Response(null)],
    ['missing output', new Response(JSON.stringify({ result: 'missing' }))],
    ['blank output', successfulResponse(' \n\t ')],
    [
      'oversized output',
      successfulResponse('x'.repeat(MAX_COMPLETION_OUTPUT_CODE_POINTS + 1)),
    ],
    [
      'oversized response body',
      new Response(
        JSON.stringify({
          output_text: 'valid',
          padding: 'x'.repeat(MAX_ITI_BEDROCK_RESPONSE_BYTES),
        }),
      ),
    ],
  ])('rejects a %s with a fixed safe error', async (_, response) => {
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
  })

  it.each([
    ['redirect', new Response(upstreamBodySentinel, { status: 302 })],
    ['client error', new Response(upstreamBodySentinel, { status: 400 })],
    ['server error', new Response(upstreamBodySentinel, { status: 503 })],
  ])(
    'rejects a %s without reading or exposing its body',
    async (_, response) => {
      if (response.body === null) {
        throw new Error('Test response body is unexpectedly missing')
      }
      const bodySpy = jest.spyOn(response.body, 'getReader')
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
      expect(bodySpy).not.toHaveBeenCalled()
      expect(fetchImplementation).toHaveBeenCalledTimes(1)
    },
  )

  it('accepts a valid response exactly at the 64 KiB byte limit', async () => {
    const emptyPaddingBody = JSON.stringify({
      output_text: 'valid',
      padding: '',
    })
    const body = JSON.stringify({
      output_text: 'valid',
      padding: 'x'.repeat(
        MAX_ITI_BEDROCK_RESPONSE_BYTES -
          new TextEncoder().encode(emptyPaddingBody).byteLength,
      ),
    })
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

    expectSafeFailure(failure, 'COMPLETION_CONFIGURATION_INVALID', [
      apiKey,
      invalidConfiguration.apiKey,
      invalidConfiguration.baseUrl,
      invalidConfiguration.modelId,
    ])
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
