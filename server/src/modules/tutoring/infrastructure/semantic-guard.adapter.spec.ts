import {
  OPENAI_COMPATIBLE_SEMANTIC_GUARD_PROVIDER,
  type OpenAICompatibleSemanticGuardConfiguration,
} from './semantic-guard.configuration'
import {
  OpenAICompatibleSemanticGuardAdapter,
  DeterministicSemanticGuardAdapter,
} from './semantic-guard.adapter'
import {
  SEMANTIC_GUARD_ERROR_CODE,
  SEMANTIC_GUARD_PROMPT_VERSION,
  SemanticGuardModelError,
  type SemanticGuardRequest,
} from '../socratic-workflow/response-approval/semantic-guard.types'

const request = Object.freeze<SemanticGuardRequest>({
  messages: Object.freeze([
    Object.freeze({ role: 'system', content: 'trusted guard prompt' }),
    Object.freeze({
      role: 'user',
      content: '{"candidate":{"message":"What changes first?"}}',
    }),
  ]),
  promptVersion: SEMANTIC_GUARD_PROMPT_VERSION,
  responseSchemaName: 'SemanticGuardResult',
})

const validGuardOutput = Object.freeze({
  approved: true,
  violations: Object.freeze([]),
})

describe('OpenAICompatibleSemanticGuardAdapter', () => {
  it('maps a valid chat-completions response into a semantic guard response', async () => {
    const fetchImplementation = jest.fn<
      Promise<Response>,
      [string | URL | Request, RequestInit?]
    >(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            model: 'Qwen/Qwen2.5-7B-Instruct-Guard',
            choices: [
              {
                finish_reason: 'stop',
                message: {
                  role: 'assistant',
                  content: JSON.stringify(validGuardOutput),
                },
              },
            ],
            usage: {
              prompt_tokens: 7,
              completion_tokens: 4,
            },
          }),
          { status: 200 },
        ),
      ),
    )
    const adapter = new OpenAICompatibleSemanticGuardAdapter(
      buildOpenAICompatibleConfiguration(),
      30_000,
      undefined,
      fetchImplementation,
    )

    await expect(adapter.evaluate(request)).resolves.toEqual({
      rawOutput: validGuardOutput,
      provider: OPENAI_COMPATIBLE_SEMANTIC_GUARD_PROVIDER,
      model: 'Qwen/Qwen2.5-7B-Instruct-Guard',
      promptVersion: SEMANTIC_GUARD_PROMPT_VERSION,
      inputTokens: 7,
      outputTokens: 4,
    })
    expect(fetchImplementation).toHaveBeenCalledTimes(1)
    const [firstCall] = fetchImplementation.mock.calls
    expect(firstCall[0]).toBe('http://localhost:8000/v1/chat/completions')
    expect(firstCall[1]?.headers).toEqual({
      Accept: 'application/json',
      'Content-Type': 'application/json',
    })
    expect(firstCall[1]?.body).toBe(
      JSON.stringify({
        model: 'Qwen/Qwen2.5-7B-Instruct-Guard',
        messages: [
          { role: 'system', content: 'trusted guard prompt' },
          { role: 'user', content: request.messages[1].content },
        ],
        temperature: 0,
        top_p: 1,
        max_completion_tokens: 2048,
        response_format: { type: 'json_object' },
      }),
    )
  })

  it.each([
    {
      name: 'truncated',
      finishReason: 'length',
      content: '{"approved":false,"violations":[',
      expectedFinishReason: 'length',
    },
    {
      name: 'otherwise malformed',
      finishReason: 'stop',
      content: 'not-json',
      expectedFinishReason: 'stop',
    },
  ])(
    'rejects $name JSON with safe finish-reason diagnostics',
    async ({ finishReason, content, expectedFinishReason }) => {
      const adapter = new OpenAICompatibleSemanticGuardAdapter(
        buildOpenAICompatibleConfiguration(),
        30_000,
        undefined,
        () =>
          Promise.resolve(
            new Response(
              JSON.stringify({
                choices: [
                  {
                    finish_reason: finishReason,
                    message: { content },
                  },
                ],
              }),
              { status: 200 },
            ),
          ),
      )

      await expect(adapter.evaluate(request)).rejects.toMatchObject({
        code: SEMANTIC_GUARD_ERROR_CODE.MALFORMED_OUTPUT,
        finishReason: expectedFinishReason,
      })
    },
  )

  it('sends an authorization header only when an API key is configured', async () => {
    const fetchImplementation = jest.fn<
      Promise<Response>,
      [string | URL | Request, RequestInit?]
    >(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            choices: [
              { message: { content: JSON.stringify(validGuardOutput) } },
            ],
          }),
          { status: 200 },
        ),
      ),
    )
    const adapter = new OpenAICompatibleSemanticGuardAdapter(
      {
        ...buildOpenAICompatibleConfiguration(),
        apiKey: 'secret-test-key',
      },
      30_000,
      undefined,
      fetchImplementation,
    )

    await adapter.evaluate(request)

    const [firstCall] = fetchImplementation.mock.calls
    expect(firstCall[1]?.headers).toMatchObject({
      Authorization: 'Bearer secret-test-key',
    })
  })

  it.each([
    [429, SEMANTIC_GUARD_ERROR_CODE.RATE_LIMITED],
    [503, SEMANTIC_GUARD_ERROR_CODE.PROVIDER_UNAVAILABLE],
    [500, SEMANTIC_GUARD_ERROR_CODE.TRANSPORT_FAILURE],
  ])('maps HTTP %s to %s', async (status, code) => {
    const adapter = new OpenAICompatibleSemanticGuardAdapter(
      buildOpenAICompatibleConfiguration(),
      30_000,
      undefined,
      () => Promise.resolve(new Response('{}', { status })),
    )

    await expectRejectCode(adapter.evaluate(request), code)
  })

  it.each([
    ['not-json'],
    [JSON.stringify({})],
    [JSON.stringify({ choices: [] })],
    [JSON.stringify({ choices: [{ message: { content: 'not-json' } }] })],
  ])('rejects malformed provider output %#', async (body) => {
    const adapter = new OpenAICompatibleSemanticGuardAdapter(
      buildOpenAICompatibleConfiguration(),
      30_000,
      undefined,
      () => Promise.resolve(new Response(body, { status: 200 })),
    )

    await expectRejectCode(
      adapter.evaluate(request),
      SEMANTIC_GUARD_ERROR_CODE.MALFORMED_OUTPUT,
    )
  })
})

describe('DeterministicSemanticGuardAdapter', () => {
  it('returns offline structured guard output', async () => {
    const adapter = new DeterministicSemanticGuardAdapter()

    await expect(adapter.evaluate(request)).resolves.toMatchObject({
      rawOutput: {
        approved: true,
        violations: [],
      },
      provider: 'deterministic',
      model: 'deterministic-semantic-guard-v1',
      promptVersion: SEMANTIC_GUARD_PROMPT_VERSION,
    })
  })

  it('evaluates candidate content without matching policy wording in the envelope', async () => {
    const adapter = new DeterministicSemanticGuardAdapter()
    const candidateRequest = Object.freeze<SemanticGuardRequest>({
      ...request,
      messages: Object.freeze([
        request.messages[0],
        Object.freeze({
          role: 'user',
          content: JSON.stringify({
            trustedPolicy: {
              disclosureContract: 'Do not reveal the final answer',
            },
            candidate: { message: 'The final answer is 42.' },
          }),
        }),
      ]),
    })

    await expect(adapter.evaluate(candidateRequest)).resolves.toMatchObject({
      rawOutput: {
        approved: false,
        violations: [{ type: 'SEMANTIC_POLICY_VIOLATION' }],
      },
    })
  })
})

function buildOpenAICompatibleConfiguration(): OpenAICompatibleSemanticGuardConfiguration {
  return {
    baseUrl: 'http://localhost:8000/v1',
    endpoint: 'http://localhost:8000/v1/chat/completions',
    modelName: 'Qwen/Qwen2.5-7B-Instruct-Guard',
    apiKey: null,
    maxCompletionTokens: 2048,
  }
}

async function expectRejectCode(
  promise: Promise<unknown>,
  code: string,
): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(SemanticGuardModelError)
  await expect(promise).rejects.toMatchObject({ code })
}
