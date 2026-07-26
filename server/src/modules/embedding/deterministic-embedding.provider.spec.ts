import { DeterministicEmbeddingProvider } from './deterministic-embedding.provider'
import { EMBEDDING_DIMENSIONS } from './embedding-provider'

describe('DeterministicEmbeddingProvider', () => {
  const provider = new DeterministicEmbeddingProvider()

  it('exposes the stable model identifier', () => {
    expect(provider.model).toBe('deterministic-embedding-v1')
  })

  it('produces exactly 1,536 finite components with unit L2 norm', async () => {
    const [vector] = await provider.embedDocuments([
      { text: 'retrieval-augmented answers' },
    ])

    expect(vector).toHaveLength(EMBEDDING_DIMENSIONS)
    expect(vector.every((component) => Number.isFinite(component))).toBe(true)

    const norm = Math.sqrt(
      vector.reduce((sum, component) => sum + component * component, 0),
    )
    expect(norm).toBeCloseTo(1, 10)
  })

  it('returns identical vectors across calls and across instances', async () => {
    const [first] = await provider.embedDocuments([
      { text: 'course-scoped retrieval' },
    ])
    const [second] = await provider.embedDocuments([
      { text: 'course-scoped retrieval' },
    ])
    const [fresh] = await new DeterministicEmbeddingProvider().embedDocuments([
      { text: 'course-scoped retrieval' },
    ])

    expect(second).toEqual(first)
    expect(fresh).toEqual(first)
  })

  it('pins the algorithm to known component values', async () => {
    const [vector] = await provider.embedDocuments([
      { text: 'Morshid embedding regression pin' },
    ])

    // Captured at implementation time. If this test breaks, the algorithm
    // changed: bump the model identifier instead of updating these numbers.
    expect(vector.slice(0, 4)).toEqual([
      -0.0034494894538194968, 0.002735878322107292, -0.021489478463230672,
      0.043307353774794846,
    ])
  })

  it('produces different vectors for different texts', async () => {
    const [first, second] = await provider.embedDocuments([
      { text: 'first lecture chunk' },
      { text: 'second lecture chunk' },
    ])

    expect(first).not.toEqual(second)
  })

  it.each([
    ['leading and trailing whitespace', '  foo bar  ', 'foo bar'],
    ['internal whitespace runs', 'foo\n\t bar', 'foo bar'],
    ['NFKC compatibility forms', 'ﬁle', 'file'],
  ])(
    'embeds %s identically to the normalized text',
    async (_, raw, normalized) => {
      const [rawVector] = await provider.embedDocuments([{ text: raw }])
      const [normalizedVector] = await provider.embedDocuments([
        { text: normalized },
      ])

      expect(rawVector).toEqual(normalizedVector)
    },
  )

  it('preserves batch order and matches singleton calls', async () => {
    const texts = ['alpha', 'beta', 'gamma']

    const batch = await provider.embedDocuments(texts.map((text) => ({ text })))
    const singletons = await Promise.all(
      texts.map(async (text) => (await provider.embedDocuments([{ text }]))[0]),
    )

    expect(batch).toHaveLength(texts.length)
    expect(batch).toEqual(singletons)
  })

  // The symmetry below is load-bearing, not incidental. Offline retrieval only
  // works because a query and a verbatim chunk land on the same vector; a task
  // prefix on either side would put them in different spaces and make offline
  // retrieval structurally impossible.
  describe('query/document symmetry', () => {
    it('embeds a query exactly as it embeds the same document text', async () => {
      const text = 'Python variables store references to objects.'

      const [documentVector] = await provider.embedDocuments([{ text }])

      await expect(provider.embedQuery(text)).resolves.toEqual(documentVector)
    })

    it('ignores the title entirely', async () => {
      const text = 'Loops repeat a block of statements.'

      const [withoutTitle] = await provider.embedDocuments([{ text }])
      const [withTitle] = await provider.embedDocuments([
        { text, title: 'Week 3 Control Flow' },
      ])

      expect(withTitle).toEqual(withoutTitle)
      await expect(provider.embedQuery(text)).resolves.toEqual(withoutTitle)
    })

    it('reports a query protocol matching its document profile', () => {
      expect(provider.queryProtocol).toBe(provider.model)
    })
  })
})
