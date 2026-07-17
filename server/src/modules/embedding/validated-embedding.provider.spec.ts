import type { EmbeddingProvider } from './embedding-provider'
import {
  BlankEmbeddingTextError,
  EMBEDDING_DIMENSIONS,
  EmbeddingBatchSizeMismatchError,
  EmptyEmbeddingBatchError,
  InvalidEmbeddingVectorError,
} from './embedding-provider'
import { ValidatedEmbeddingProvider } from './validated-embedding.provider'

const validVector = () => new Array<number>(EMBEDDING_DIMENSIONS).fill(0.5)

class FakeEmbeddingProvider implements EmbeddingProvider {
  readonly model = 'fake-embedding-model'
  readonly embedBatch = jest.fn(
    (texts: readonly string[]): Promise<readonly (readonly number[])[]> =>
      Promise.resolve(texts.map(() => validVector())),
  )
}

function buildProvider() {
  const inner = new FakeEmbeddingProvider()
  return { inner, provider: new ValidatedEmbeddingProvider(inner) }
}

describe('ValidatedEmbeddingProvider', () => {
  it('passes through valid results and the inner model name', async () => {
    const { inner, provider } = buildProvider()

    const vectors = await provider.embedBatch(['a', 'b'])

    expect(provider.model).toBe('fake-embedding-model')
    expect(vectors).toHaveLength(2)
    expect(vectors[0]).toHaveLength(EMBEDDING_DIMENSIONS)
    expect(inner.embedBatch).toHaveBeenCalledWith(['a', 'b'])
  })

  it('rejects an empty batch without invoking the inner provider', async () => {
    const { inner, provider } = buildProvider()

    await expect(provider.embedBatch([])).rejects.toBeInstanceOf(
      EmptyEmbeddingBatchError,
    )
    expect(inner.embedBatch).not.toHaveBeenCalled()
  })

  it.each([[''], ['   '], [' \n\t ']])(
    'rejects blank text %j without invoking the inner provider',
    async (blank) => {
      const { inner, provider } = buildProvider()

      await expect(provider.embedBatch(['ok', blank])).rejects.toBeInstanceOf(
        BlankEmbeddingTextError,
      )
      expect(inner.embedBatch).not.toHaveBeenCalled()
    },
  )

  it.each([
    ['a 1,535-dimension vector', validVector().slice(0, 1_535)],
    ['a 1,537-dimension vector', [...validVector(), 0.5]],
    ['an empty vector', []],
    ['a vector containing NaN', [...validVector().slice(0, -1), Number.NaN]],
    [
      'a vector containing Infinity',
      [...validVector().slice(0, -1), Number.POSITIVE_INFINITY],
    ],
    [
      'a vector containing -Infinity',
      [...validVector().slice(0, -1), Number.NEGATIVE_INFINITY],
    ],
  ])('rejects %s', async (_, malformed: readonly number[]) => {
    const { inner, provider } = buildProvider()
    inner.embedBatch.mockResolvedValueOnce([malformed])

    await expect(provider.embedBatch(['text'])).rejects.toBeInstanceOf(
      InvalidEmbeddingVectorError,
    )
  })

  it('rejects a result count that differs from the input count', async () => {
    const { inner, provider } = buildProvider()
    inner.embedBatch.mockResolvedValueOnce([validVector()])

    await expect(provider.embedBatch(['a', 'b'])).rejects.toBeInstanceOf(
      EmbeddingBatchSizeMismatchError,
    )
  })

  it('propagates inner provider errors unchanged', async () => {
    const { inner, provider } = buildProvider()
    const upstream = new Error('upstream provider unavailable')
    inner.embedBatch.mockRejectedValueOnce(upstream)

    await expect(provider.embedBatch(['text'])).rejects.toBe(upstream)
  })

  it('never echoes input text into error messages', async () => {
    const { inner, provider } = buildProvider()
    const sentinel = 'sensitive-lecture-content-sentinel'
    inner.embedBatch.mockResolvedValueOnce([[Number.NaN]])

    const failure = await provider.embedBatch([sentinel]).then(
      () => null,
      (error: unknown) => error,
    )

    expect(failure).toBeInstanceOf(InvalidEmbeddingVectorError)
    expect((failure as Error).message).not.toContain(sentinel)
  })
})
