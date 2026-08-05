import {
  ANALYSIS_MODEL_ERROR_CODE,
  type AnalysisModelPort,
  type AnalysisModelRequest,
  type AnalysisModelResponse,
  AnalysisModelError,
} from './analysis-model.port'
import {
  DETERMINISTIC_ANALYSIS_MODEL_PROVIDER,
  OPENAI_COMPATIBLE_ANALYSIS_MODEL_PROVIDER,
  type OpenAICompatibleAnalysisConfiguration,
} from './analysis-model.configuration'
import {
  DeterministicAnalysisModelAdapter,
  OpenAICompatibleAnalysisModelAdapter,
  ValidatedAnalysisModelPort,
} from './analysis-model.provider'
import { EDUCATIONAL_ANALYSIS_PROMPT_VERSION } from './educational-analysis.prompt'

const request = Object.freeze<AnalysisModelRequest>({
  messages: Object.freeze([
    Object.freeze({ role: 'system', content: 'trusted analysis prompt' }),
    Object.freeze({
      role: 'user',
      content: '{"studentMessage":{"id":"message-22"}}',
    }),
  ]),
  promptVersion: EDUCATIONAL_ANALYSIS_PROMPT_VERSION,
  responseSchemaName: 'EducationalAnalysisResult',
})

const validOutput = Object.freeze({
  requestKind: 'CODE_DIAGNOSIS',
  studentState: 'DEBUGGING_ISSUE',
  effortEvidence: Object.freeze({
    present: true,
    quality: 'MEANINGFUL',
    type: 'CODE_ATTEMPT',
    addressesPreviousTutorAction: true,
    isRepeated: false,
    evidenceMessageIds: Object.freeze(['message-22']),
  }),
  learningEvidence: Object.freeze({
    present: false,
    strength: 'NONE',
    evidenceMessageIds: Object.freeze([]),
  }),
  misconceptions: Object.freeze([]),
  topicRelation: 'CONTINUE_CURRENT_TOPIC',
  recommendedStrategy: 'DEBUGGING_GUIDANCE',
  recommendedTechnique: 'TRACE_EXECUTION',
  recommendedGuidanceLevel: 2,
  confidence: 0.9,
  evidenceReferences: Object.freeze(['message-22']),
})

describe('OpenAICompatibleAnalysisModelAdapter', () => {
  it('maps a valid chat-completions response into a provider-independent analysis response', async () => {
    const fetchImplementation = jest.fn<
      Promise<Response>,
      [string | URL | Request, RequestInit?]
    >(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            model: 'Qwen/Qwen2.5-14B-Instruct',
            system_fingerprint: 'vllm-test-fingerprint',
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: JSON.stringify(validOutput),
                },
              },
            ],
            usage: {
              prompt_tokens: 10,
              completion_tokens: 20,
            },
          }),
          { status: 200 },
        ),
      ),
    )
    const adapter = new OpenAICompatibleAnalysisModelAdapter(
      buildOpenAICompatibleConfiguration(),
      fetchImplementation,
    )

    await expect(adapter.analyze(request)).resolves.toEqual({
      rawOutput: validOutput,
      provider: OPENAI_COMPATIBLE_ANALYSIS_MODEL_PROVIDER,
      model: 'Qwen/Qwen2.5-14B-Instruct',
      modelVersion: 'vllm-test-fingerprint',
      promptVersion: EDUCATIONAL_ANALYSIS_PROMPT_VERSION,
      inputTokens: 10,
      outputTokens: 20,
    })
    expect(fetchImplementation).toHaveBeenCalledTimes(1)
    const calls = fetchImplementation.mock.calls as Array<
      [string | URL | Request, RequestInit?]
    >
    expect(calls[0]?.[0]).toBe('http://localhost:8000/v1/chat/completions')
    const init = calls[0]?.[1]
    expect(init?.headers).toEqual({
      Accept: 'application/json',
      'Content-Type': 'application/json',
    })
    expect(init?.body).toBe(
      JSON.stringify({
        model: 'Qwen/Qwen2.5-14B-Instruct',
        messages: [
          { role: 'system', content: 'trusted analysis prompt' },
          { role: 'user', content: request.messages[1].content },
        ],
        temperature: 0,
        top_p: 1,
        response_format: {
          type: 'json_object',
        },
      }),
    )
  })

  it('sends an authorization header only when an API key is configured', async () => {
    const fetchImplementation = jest.fn<
      Promise<Response>,
      [string | URL | Request, RequestInit?]
    >(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify(validOutput) } }],
          }),
          { status: 200 },
        ),
      ),
    )
    const adapter = new OpenAICompatibleAnalysisModelAdapter(
      {
        ...buildOpenAICompatibleConfiguration(),
        apiKey: 'secret-test-key',
      },
      fetchImplementation,
    )

    await adapter.analyze(request)

    const calls = fetchImplementation.mock.calls as Array<
      [string | URL | Request, RequestInit?]
    >
    expect(calls[0]?.[1]?.headers).toMatchObject({
      Authorization: 'Bearer secret-test-key',
    })
  })

  it.each([
    [429, ANALYSIS_MODEL_ERROR_CODE.RATE_LIMITED],
    [503, ANALYSIS_MODEL_ERROR_CODE.PROVIDER_UNAVAILABLE],
    [500, ANALYSIS_MODEL_ERROR_CODE.TRANSPORT_FAILURE],
  ])('maps HTTP %s to %s', async (status, code) => {
    const adapter = new OpenAICompatibleAnalysisModelAdapter(
      buildOpenAICompatibleConfiguration(),
      () => Promise.resolve(new Response('{}', { status })),
    )

    await expectRejectCode(adapter.analyze(request), code)
  })

  it.each([
    ['not-json'],
    [JSON.stringify({})],
    [JSON.stringify({ choices: [] })],
    [JSON.stringify({ choices: [{ message: { content: 'not-json' } }] })],
    [JSON.stringify({ choices: [{ message: { content: '[]' } }] })],
  ])('rejects malformed provider output %#', async (body) => {
    const adapter = new OpenAICompatibleAnalysisModelAdapter(
      buildOpenAICompatibleConfiguration(),
      () => Promise.resolve(new Response(body, { status: 200 })),
    )

    await expectRejectCode(
      adapter.analyze(request),
      ANALYSIS_MODEL_ERROR_CODE.MALFORMED_OUTPUT,
    )
  })
})

describe('ValidatedAnalysisModelPort', () => {
  it('maps timeout to a typed failure', async () => {
    const timeoutController = new AbortController()
    const provider = new ValidatedAnalysisModelPort(
      {
        analyze: () => new Promise<AnalysisModelResponse>(() => undefined),
      },
      1,
      () => timeoutController.signal,
    )

    const promise = provider.analyze(request)
    timeoutController.abort()

    await expectRejectCode(promise, ANALYSIS_MODEL_ERROR_CODE.TIMEOUT)
  })

  it('does not expose provider SDK objects in the validated response', async () => {
    const provider = new ValidatedAnalysisModelPort(
      new FakeProvider({
        rawOutput: validOutput,
        provider: 'fake-provider',
        model: 'fake-model',
        promptVersion: EDUCATIONAL_ANALYSIS_PROMPT_VERSION,
        inputTokens: 10,
        outputTokens: 20,
      }),
      30_000,
    )

    await expect(provider.analyze(request)).resolves.toEqual({
      rawOutput: validOutput,
      provider: 'fake-provider',
      model: 'fake-model',
      promptVersion: EDUCATIONAL_ANALYSIS_PROMPT_VERSION,
      inputTokens: 10,
      outputTokens: 20,
      latencyMs: expect.any(Number) as number,
    })
  })
})

describe('DeterministicAnalysisModelAdapter', () => {
  it('returns offline structured analysis using only the supplied message id', async () => {
    const adapter = new DeterministicAnalysisModelAdapter()

    await expect(adapter.analyze(request)).resolves.toMatchObject({
      rawOutput: {
        requestKind: 'AMBIGUOUS',
        studentState: 'UNKNOWN',
        effortEvidence: {
          present: false,
          quality: 'NONE',
        },
        learningEvidence: {
          present: false,
          strength: 'NONE',
        },
        evidenceReferences: ['message-22'],
      },
      provider: DETERMINISTIC_ANALYSIS_MODEL_PROVIDER,
      model: 'deterministic-analysis-v1',
      promptVersion: EDUCATIONAL_ANALYSIS_PROMPT_VERSION,
    })
  })
})

class FakeProvider implements AnalysisModelPort {
  constructor(private readonly response: AnalysisModelResponse) {}

  analyze(_request: AnalysisModelRequest): Promise<AnalysisModelResponse> {
    return Promise.resolve(this.response)
  }
}

function buildOpenAICompatibleConfiguration(): OpenAICompatibleAnalysisConfiguration {
  return {
    baseUrl: 'http://localhost:8000/v1',
    endpoint: 'http://localhost:8000/v1/chat/completions',
    modelName: 'Qwen/Qwen2.5-14B-Instruct',
    apiKey: null,
  }
}

async function expectRejectCode(
  promise: Promise<unknown>,
  code: string,
): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(AnalysisModelError)
  await expect(promise).rejects.toMatchObject({ code })
}
