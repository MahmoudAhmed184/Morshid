import { Test } from '@nestjs/testing'

import type { CompletionRequest } from './completion-provider'
import { CompletionProviderError } from './completion-provider'
import {
  DETERMINISTIC_COMPLETION_MODEL,
  DETERMINISTIC_COMPLETION_PROVIDER,
  DETERMINISTIC_EVIDENCE_EXCERPT_CODE_POINTS,
  DeterministicCompletionProvider,
  normalizeCompletionText,
} from './deterministic-completion.provider'
import { GROUNDED_COMPLETION_PROMPT_VERSION } from './grounded-completion-envelope'

function request(
  overrides: Partial<CompletionRequest> = {},
): CompletionRequest {
  return {
    studentQuestion: 'How should I study this topic?',
    context: [
      {
        sourceTitle: 'Week 1 guide',
        chunkIndex: 2,
        content: 'Review the examples, then solve the practice questions.',
      },
      {
        sourceTitle: 'Week 2 guide',
        chunkIndex: 0,
        content: 'Compare your solution with the worked answer.',
      },
    ],
    ...overrides,
  }
}

describe('DeterministicCompletionProvider', () => {
  it('is resolvable from its Nest provider scaffold', async () => {
    const module = await Test.createTestingModule({
      providers: [DeterministicCompletionProvider],
    }).compile()

    expect(module.get(DeterministicCompletionProvider)).toBeInstanceOf(
      DeterministicCompletionProvider,
    )
  })

  it('pins complete offline output and persistence metadata', async () => {
    const result = await new DeterministicCompletionProvider().complete(
      request(),
    )

    expect(result).toEqual({
      content: [
        'Grounded guidance based only on the supplied authorized context:',
        '1. "Review the examples, then solve the practice questions." — "Week 1 guide", chunk 2',
        '2. "Compare your solution with the worked answer." — "Week 2 guide", chunk 0',
      ].join('\n'),
      provider: DETERMINISTIC_COMPLETION_PROVIDER,
      model: DETERMINISTIC_COMPLETION_MODEL,
      promptVersion: GROUNDED_COMPLETION_PROMPT_VERSION,
    })
    expect(result.provider).toBe('deterministic')
    expect(result.model).toBe('deterministic-completion-v1')
    expect(result.promptVersion).toBe('grounded-completion-v1')
  })

  it('is stable across calls and instances while preserving context order', async () => {
    const provider = new DeterministicCompletionProvider()

    const first = await provider.complete(request())
    const second = await provider.complete(request())
    const fresh = await new DeterministicCompletionProvider().complete(
      request(),
    )

    expect(second).toEqual(first)
    expect(fresh).toEqual(first)
    expect(first.content.indexOf('Week 1')).toBeLessThan(
      first.content.indexOf('Week 2'),
    )
  })

  it('does not use or echo the student question', async () => {
    const provider = new DeterministicCompletionProvider()
    const privateQuestion = 'private-question-sentinel'

    const first = await provider.complete(request())
    const second = await provider.complete(
      request({ studentQuestion: privateQuestion }),
    )

    expect(second).toEqual(first)
    expect(second.content).not.toContain(privateQuestion)
  })

  it('contains no variable knowledge absent from supplied context', async () => {
    const absentKnowledge = 'absent-context-sentinel'
    const result = await new DeterministicCompletionProvider().complete(
      request(),
    )

    expect(result.content).not.toContain(absentKnowledge)
    for (const line of result.content.split('\n').slice(1)) {
      expect(
        request().context.some(
          ({ sourceTitle, chunkIndex, content }) =>
            line.includes(sourceTitle) &&
            line.includes(String(chunkIndex)) &&
            line.includes(content),
        ),
      ).toBe(true)
    }
  })

  it('changes only when normalized supplied context changes', async () => {
    const provider = new DeterministicCompletionProvider()
    const original = await provider.complete(request())
    const changed = await provider.complete(
      request({
        context: [
          {
            sourceTitle: 'Week 1 guide',
            chunkIndex: 2,
            content: 'Use a different supplied study method.',
          },
        ],
      }),
    )

    expect(changed.content).not.toEqual(original.content)
    expect(changed.content).toContain('Use a different supplied study method.')
  })

  it.each([
    ['surrounding and repeated whitespace', '  alpha\n\t beta  ', 'alpha beta'],
    ['NFKC compatibility forms', 'ﬁle', 'file'],
  ])('normalizes %s in titles and evidence', async (_, raw, normalized) => {
    const provider = new DeterministicCompletionProvider()
    const rawResult = await provider.complete(
      request({
        context: [{ sourceTitle: raw, chunkIndex: 0, content: raw }],
      }),
    )
    const normalizedResult = await provider.complete(
      request({
        context: [
          { sourceTitle: normalized, chunkIndex: 0, content: normalized },
        ],
      }),
    )

    expect(rawResult).toEqual(normalizedResult)
  })

  it('limits evidence by Unicode code point rather than UTF-16 code unit', async () => {
    const content = `${'😀'.repeat(DETERMINISTIC_EVIDENCE_EXCERPT_CODE_POINTS)}excluded-sentinel`
    const result = await new DeterministicCompletionProvider().complete(
      request({
        context: [{ sourceTitle: 'Unicode', chunkIndex: 0, content }],
      }),
    )
    const quotedExcerpt = result.content.split('\n')[1].split(' — ')[0]
    const excerpt = JSON.parse(
      quotedExcerpt.slice(quotedExcerpt.indexOf('"')),
    ) as string

    expect(Array.from(excerpt)).toHaveLength(
      DETERMINISTIC_EVIDENCE_EXCERPT_CODE_POINTS,
    )
    expect(result.content).not.toContain('excluded-sentinel')
  })

  it('supports a controlled failure mode selected only by its constructor', async () => {
    const provider = new DeterministicCompletionProvider('fail')

    await expect(provider.complete(request())).rejects.toThrow(
      'deterministic controlled failure',
    )
  })

  it('waits until the supplied signal aborts in its cancellation test mode', async () => {
    const provider = new DeterministicCompletionProvider('wait-until-aborted')
    const controller = new AbortController()
    const pending = provider.complete(request({ signal: controller.signal }))

    controller.abort('private-abort-reason')

    await expect(pending).rejects.toMatchObject({
      code: 'COMPLETION_CANCELLED',
    } satisfies Partial<CompletionProviderError>)
  })

  it('rejects pre-aborted requests without retaining the abort reason', async () => {
    const controller = new AbortController()
    const privateReason = 'private-pre-abort-reason'
    controller.abort(privateReason)

    const failure = await new DeterministicCompletionProvider()
      .complete(request({ signal: controller.signal }))
      .then(
        () => null,
        (error: unknown) => error,
      )

    expect(failure).toBeInstanceOf(CompletionProviderError)
    expect((failure as CompletionProviderError).code).toBe(
      'COMPLETION_CANCELLED',
    )
    expect(JSON.stringify(failure)).not.toContain(privateReason)
    expect((failure as Error).message).not.toContain(privateReason)
  })
})

describe('normalizeCompletionText', () => {
  it.each([
    ['trims surrounding whitespace', '  foo  ', 'foo'],
    ['collapses whitespace runs', 'a \n\t b', 'a b'],
    ['applies NFKC normalization', 'ﬁle', 'file'],
    ['reduces whitespace-only input to empty', ' \n\t ', ''],
  ])('%s', (_, input, expected) => {
    expect(normalizeCompletionText(input)).toBe(expected)
  })
})
