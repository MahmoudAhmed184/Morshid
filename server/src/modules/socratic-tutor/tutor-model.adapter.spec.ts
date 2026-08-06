import {
  DETERMINISTIC_TUTOR_MODEL_PROVIDER,
  OPENAI_COMPATIBLE_TUTOR_MODEL_PROVIDER,
  type OpenAICompatibleTutorConfiguration,
} from './tutor-model.configuration'
import {
  DeterministicTutorModelAdapter,
  OpenAICompatibleTutorModelAdapter,
  ValidatedTutorModelPort,
} from './tutor-model.adapter'
import {
  TUTOR_MODEL_ERROR_CODE,
  TutorModelError,
  type TutorModelRequest,
  type TutorModelResponse,
} from './tutor-generation.types'
import { TUTOR_GENERATION_PROMPT_VERSION } from './tutor-prompt.registry'

const request = Object.freeze<TutorModelRequest>({
  messages: Object.freeze([
    Object.freeze({ role: 'system', content: 'trusted tutor prompt' }),
    Object.freeze({
      role: 'user',
      content: '{"allowedCitationIds":["retrieval.rank.1"]}',
    }),
  ]),
  promptVersion: TUTOR_GENERATION_PROMPT_VERSION,
  responseSchemaName: 'CandidateResponse',
})

const validCandidate = Object.freeze({
  message: 'What changes after one loop iteration?',
  responseIntent: 'SOCRATIC_QUESTIONING',
  usedCitationIds: Object.freeze(['retrieval.rank.1']),
  requiresStudentAction: true,
  studentAction: Object.freeze({
    type: 'ORIENTATION_QUESTION',
    description: 'Ask the learner to inspect the loop update.',
  }),
  reflectionIncluded: false,
  selfReportedCompliance: Object.freeze({
    finalAnswerRevealed: false,
    completeSolutionRevealed: false,
  }),
})

describe('OpenAICompatibleTutorModelAdapter', () => {
  it('maps a valid chat-completions response into a tutor response with tutor metadata', async () => {
    const fetchImplementation = jest.fn<
      Promise<Response>,
      [string | URL | Request, RequestInit?]
    >(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            model: 'Qwen/Qwen2.5-7B-Instruct',
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: JSON.stringify(validCandidate),
                },
              },
            ],
            usage: {
              prompt_tokens: 13,
              completion_tokens: 8,
            },
          }),
          { status: 200 },
        ),
      ),
    )
    const adapter = new OpenAICompatibleTutorModelAdapter(
      buildOpenAICompatibleConfiguration(),
      fetchImplementation,
    )

    await expect(adapter.generate(request)).resolves.toEqual({
      rawOutput: validCandidate,
      provider: OPENAI_COMPATIBLE_TUTOR_MODEL_PROVIDER,
      model: 'Qwen/Qwen2.5-7B-Instruct',
      promptVersion: TUTOR_GENERATION_PROMPT_VERSION,
      inputTokens: 13,
      outputTokens: 8,
    })
    expect(fetchImplementation).toHaveBeenCalledTimes(1)
    const [firstCall] = fetchImplementation.mock.calls
    expect(firstCall[0]).toBe('http://localhost:8000/v1/chat/completions')
    expect(firstCall[1]?.body).toBe(
      JSON.stringify({
        model: 'Qwen/Qwen2.5-7B-Instruct',
        messages: [
          { role: 'system', content: 'trusted tutor prompt' },
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

  it.each([
    [429, TUTOR_MODEL_ERROR_CODE.RATE_LIMITED],
    [503, TUTOR_MODEL_ERROR_CODE.PROVIDER_UNAVAILABLE],
    [500, TUTOR_MODEL_ERROR_CODE.TRANSPORT_FAILURE],
  ])('maps HTTP %s to %s', async (status, code) => {
    const adapter = new OpenAICompatibleTutorModelAdapter(
      buildOpenAICompatibleConfiguration(),
      () => Promise.resolve(new Response('{}', { status })),
    )

    await expectRejectCode(adapter.generate(request), code)
  })

  it.each([
    ['not-json'],
    [JSON.stringify({})],
    [JSON.stringify({ choices: [] })],
    [JSON.stringify({ choices: [{ message: { content: 'not-json' } }] })],
    [JSON.stringify({ choices: [{ message: { content: '[]' } }] })],
  ])('rejects malformed provider output %#', async (body) => {
    const adapter = new OpenAICompatibleTutorModelAdapter(
      buildOpenAICompatibleConfiguration(),
      () => Promise.resolve(new Response(body, { status: 200 })),
    )

    await expectRejectCode(
      adapter.generate(request),
      TUTOR_MODEL_ERROR_CODE.MALFORMED_OUTPUT,
    )
  })
})

describe('ValidatedTutorModelPort', () => {
  it('maps timeout to a typed tutor failure', async () => {
    const timeoutController = new AbortController()
    const provider = new ValidatedTutorModelPort(
      {
        generate: () => new Promise<TutorModelResponse>(() => undefined),
      },
      1,
      () => timeoutController.signal,
    )

    const promise = provider.generate(request)
    timeoutController.abort()

    await expectRejectCode(promise, TUTOR_MODEL_ERROR_CODE.TIMEOUT)
  })
})

describe('DeterministicTutorModelAdapter', () => {
  it('returns offline structured tutor output using only backend citation IDs', async () => {
    const adapter = new DeterministicTutorModelAdapter()

    await expect(adapter.generate(request)).resolves.toMatchObject({
      rawOutput: {
        responseIntent: 'SOCRATIC_QUESTIONING',
        usedCitationIds: ['retrieval.rank.1'],
        reflectionIncluded: false,
      },
      provider: DETERMINISTIC_TUTOR_MODEL_PROVIDER,
      model: 'deterministic-tutor-generation-v1',
      promptVersion: TUTOR_GENERATION_PROMPT_VERSION,
    })
  })
})

function buildOpenAICompatibleConfiguration(): OpenAICompatibleTutorConfiguration {
  return {
    baseUrl: 'http://localhost:8000/v1',
    endpoint: 'http://localhost:8000/v1/chat/completions',
    modelName: 'Qwen/Qwen2.5-7B-Instruct',
    apiKey: null,
  }
}

async function expectRejectCode(
  promise: Promise<unknown>,
  code: string,
): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(TutorModelError)
  await expect(promise).rejects.toMatchObject({ code })
}
