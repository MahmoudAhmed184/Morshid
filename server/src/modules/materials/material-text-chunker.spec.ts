import {
  MATERIAL_CHUNK_OVERLAP_CHARACTERS,
  MATERIAL_CHUNK_TARGET_CHARACTERS,
  MaterialTextChunker,
} from './material-text-chunker'

describe('MaterialTextChunker', () => {
  const chunker = new MaterialTextChunker()

  it('normalizes whitespace and removes empty input', () => {
    expect(chunker.normalize('  one\r\n\r\n\r\n two\t words  ')).toBe(
      'one\n\ntwo words',
    )
    expect(chunker.chunk(' \n\t ')).toEqual([])
  })

  it('handles short text as one zero-indexed chunk', () => {
    expect(chunker.chunk('Python stores values in variables.')).toEqual([
      {
        chunkIndex: 0,
        content: 'Python stores values in variables.',
      },
    ])
  })

  it('chunks repeatably with bounded size, stable indexes, and overlap', () => {
    const paragraphs = Array.from(
      { length: 20 },
      (_, index) =>
        `Paragraph ${String(index)}: ${'synthetic text '.repeat(30)}`,
    ).join('\n\n')
    const first = chunker.chunk(paragraphs)
    const second = chunker.chunk(paragraphs)

    expect(first).toEqual(second)
    expect(first.map(({ chunkIndex }) => chunkIndex)).toEqual(
      first.map((_, index) => index),
    )
    expect(first.every(({ content }) => content.length > 0)).toBe(true)
    expect(
      first.every(
        ({ content }) => content.length <= MATERIAL_CHUNK_TARGET_CHARACTERS,
      ),
    ).toBe(true)
    expect(MATERIAL_CHUNK_OVERLAP_CHARACTERS).toBe(200)
    expect(first.length).toBeGreaterThan(1)
  })

  it.each([
    { name: 'space', separator: ' ' },
    { name: 'newline', separator: '\n' },
    { name: 'paragraph', separator: '\n\n' },
  ])(
    'preserves exactly 200 shared characters across a $name boundary',
    ({ separator }) => {
      const firstSection = 'a'.repeat(1_000)
      const secondSection = 'b'.repeat(600)
      const chunks = chunker.chunk(
        `${firstSection}${separator}${secondSection}`,
      )

      expect(chunks).toHaveLength(2)
      expect(chunks[0]).toEqual({ chunkIndex: 0, content: firstSection })
      expect(chunks[1]?.chunkIndex).toBe(1)
      expect(chunks[0]?.content.slice(-200)).toBe('a'.repeat(200))
      expect(chunks[1]?.content.slice(0, 200)).toBe('a'.repeat(200))
      expect(chunks[1]?.content.slice(200)).toBe(
        `${separator}${secondSection}`,
      )
    },
  )

  it('falls back to target size when a paragraph boundary is too early', () => {
    const chunks = chunker.chunk(`${'a'.repeat(300)}\n\n${'b'.repeat(1_500)}`)

    expect(chunks[0]?.content).toHaveLength(
      MATERIAL_CHUNK_TARGET_CHARACTERS,
    )
    expect(chunks.every((chunk) => chunk.content.length > 0)).toBe(true)
  })
})
