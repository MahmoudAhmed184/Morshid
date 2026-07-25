import type { PreparedCompletionRequest } from './completion-adapter'
import { assertPreparedMessageOrder } from './completion-adapter'
import { CompletionProviderError } from './completion-provider'
import type { GroundedCompletionMessage } from './grounded-completion-envelope'
import { buildGroundedCompletionMessages } from './grounded-completion-envelope'

function preparedRequest(messages: unknown): PreparedCompletionRequest {
  return {
    messages,
    signal: new AbortController().signal,
  } as unknown as PreparedCompletionRequest
}

function message(role: string, content = 'content'): GroundedCompletionMessage {
  return { role, content } as unknown as GroundedCompletionMessage
}

function expectInvalidRequest(request: PreparedCompletionRequest): void {
  const failure = (() => {
    try {
      assertPreparedMessageOrder(request)
      return null
    } catch (error: unknown) {
      return error
    }
  })()

  expect(failure).toBeInstanceOf(CompletionProviderError)
  expect((failure as CompletionProviderError).code).toBe(
    'COMPLETION_INVALID_REQUEST',
  )
}

describe('assertPreparedMessageOrder', () => {
  it('accepts the authoritative-first tuple the envelope builder produces', () => {
    const messages = buildGroundedCompletionMessages({
      studentQuestion: 'How should I study this topic?',
      context: [
        {
          sourceTitle: 'Week 1 guide',
          chunkIndex: 0,
          content: 'Review the worked examples.',
        },
      ],
    })

    expect(() => {
      assertPreparedMessageOrder(preparedRequest(messages))
    }).not.toThrow()
  })

  // A reordering of the message builder keeps satisfying the declared tuple
  // type, so every one of these shapes type-checks and must still fail closed.
  it.each([
    [
      'the authoritative and untrusted messages are swapped',
      [message('user'), message('system')],
    ],
    [
      'both messages carry the untrusted role',
      [message('user'), message('user')],
    ],
    [
      'both messages carry the authoritative role',
      [message('system'), message('system')],
    ],
    ['the untrusted message is missing', [message('system')]],
    [
      'an extra message is appended',
      [message('system'), message('user'), message('user')],
    ],
    ['the tuple is empty', []],
  ])('refuses a prepared request where %s', (_, messages) => {
    expectInvalidRequest(preparedRequest(messages))
  })

  // The declared type is exactly what a hostile or corrupted caller would
  // satisfy on paper, so the roles are read reflectively at runtime.
  it.each([
    [
      'a non-array value',
      { length: 2, 0: message('system'), 1: message('user') },
    ],
    ['a missing tuple', undefined],
    ['a null tuple', null],
    ['a string', 'system,user'],
  ])('refuses a prepared request whose messages are %s', (_, messages) => {
    expectInvalidRequest(preparedRequest(messages))
  })

  it('refuses a tuple whose entries are not role-bearing objects', () => {
    expectInvalidRequest(preparedRequest(['system', 'user']))
    expectInvalidRequest(preparedRequest([null, null]))
  })

  it('reads the tuple through the request rather than trusting a snapshot', () => {
    let reads = 0
    const request = {
      get messages(): readonly GroundedCompletionMessage[] {
        reads += 1
        return [message('user'), message('user')]
      },
      signal: new AbortController().signal,
    } as unknown as PreparedCompletionRequest

    expectInvalidRequest(request)
    expect(reads).toBe(1)
  })
})
