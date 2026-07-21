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
})
