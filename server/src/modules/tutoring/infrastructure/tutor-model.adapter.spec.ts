import {
  DETERMINISTIC_TUTOR_MODEL_PROVIDER,
  OPENAI_COMPATIBLE_TUTOR_MODEL_PROVIDER,
  type OpenAICompatibleTutorConfiguration,
} from './tutor-model.configuration'
import {
  DeterministicTutorModelAdapter,
  OpenAICompatibleTutorModelAdapter,
} from './tutor-model.adapter'
import {
  TUTOR_MODEL_ERROR_CODE,
  TutorModelError,
  type TutorModelRequest,
} from '../socratic-workflow/generation/tutor-generation.types'
import { TUTOR_GENERATION_PROMPT_VERSION } from '../socratic-workflow/generation/tutor-prompt.definition'

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
  debuggingGuidance: null,
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

const debuggingRequest = Object.freeze<TutorModelRequest>({
  ...request,
  messages: Object.freeze([
    request.messages[0],
    Object.freeze({
      role: 'user',
      content: [
        '3. Authoritative TeachingDecision',
        JSON.stringify({ strategy: 'DEBUGGING_GUIDANCE' }),
        '4. Guidance Level and Reveal Policy Constraints',
        JSON.stringify({
          strategy: 'DEBUGGING_GUIDANCE',
          allowedCitationIds: ['retrieval.rank.1'],
          debuggingGuidance: {
            likelyIssue: 'The name `num` does not match `nums`.',
            relevantLocation: 'The return expression.',
            concept: 'Name lookup resolves names in the active scope.',
            nextInspectionStep: 'Compare the returned name with the parameter.',
            evidenceQuery: 'name lookup scope',
            rewriteRequested: true,
          },
        }),
      ].join('\n'),
    }),
  ]),
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
      30_000,
      undefined,
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
        max_completion_tokens: 2048,
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
      30_000,
      undefined,
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
      30_000,
      undefined,
      () => Promise.resolve(new Response(body, { status: 200 })),
    )

    await expectRejectCode(
      adapter.generate(request),
      TUTOR_MODEL_ERROR_CODE.MALFORMED_OUTPUT,
    )
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

  it('renders the backend debugging context as a bounded diagnosis', async () => {
    const adapter = new DeterministicTutorModelAdapter()
    const response = await adapter.generate(debuggingRequest)
    const output = asRecord(response.rawOutput)

    expect(output.responseIntent).toBe('DEBUGGING_GUIDANCE')
    expect(output.usedCitationIds).toEqual(['retrieval.rank.1'])
    expect(output.message).toBeNull()
    expect(output.studentAction).toBeNull()
    expect(output.debuggingGuidance).toMatchObject({
      diagnosis: 'The name `num` does not match `nums`.',
      conceptExplanation: 'Name lookup resolves names in the active scope.',
      inspectionActions: ['Compare the returned name with the parameter.'],
    })
  })
})

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('Expected a tutor response object')
  }
  return value as Record<string, unknown>
}

function buildOpenAICompatibleConfiguration(): OpenAICompatibleTutorConfiguration {
  return {
    baseUrl: 'http://localhost:8000/v1',
    endpoint: 'http://localhost:8000/v1/chat/completions',
    modelName: 'Qwen/Qwen2.5-7B-Instruct',
    apiKey: null,
    maxCompletionTokens: 2048,
  }
}

async function expectRejectCode(
  promise: Promise<unknown>,
  code: string,
): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(TutorModelError)
  await expect(promise).rejects.toMatchObject({ code })
}
