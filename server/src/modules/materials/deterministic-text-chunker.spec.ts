import {
  MATERIAL_CHUNK_OVERLAP_CHARACTERS,
  MATERIAL_CHUNK_TARGET_CHARACTERS,
  chunkNormalizedText,
} from './deterministic-text-chunker'

describe('chunkNormalizedText', () => {
  it('returns no chunks for empty input', () => {
    expect(chunkNormalizedText('')).toEqual([])
    expect(chunkNormalizedText('   ')).toEqual([])
  })

  it('handles short text as one zero-indexed chunk', () => {
    expect(chunkNormalizedText('Python stores values in variables.')).toEqual([
      {
        chunkIndex: 0,
        content: 'Python stores values in variables.',
      },
    ])
  })

  it('handles target-sized text as one chunk', () => {
    const text = 'x'.repeat(MATERIAL_CHUNK_TARGET_CHARACTERS)

    expect(chunkNormalizedText(text)).toEqual([
      {
        chunkIndex: 0,
        content: text,
      },
    ])
  })

  it('uses stable 200-character overlap for adjacent chunks', () => {
    const text = 'a'.repeat(MATERIAL_CHUNK_TARGET_CHARACTERS + 1)
    const chunks = chunkNormalizedText(text)

    expect(chunks).toHaveLength(2)
    expect(chunks[0]).toMatchObject({
      chunkIndex: 0,
      content: 'a'.repeat(MATERIAL_CHUNK_TARGET_CHARACTERS),
    })
    expect(chunks[1]).toMatchObject({
      chunkIndex: 1,
      content: 'a'.repeat(MATERIAL_CHUNK_OVERLAP_CHARACTERS + 1),
    })
  })

  it('prefers paragraph boundaries near the target size', () => {
    const firstParagraph = 'a'.repeat(MATERIAL_CHUNK_TARGET_CHARACTERS - 150)
    const secondParagraph = 'b'.repeat(600)
    const text = `${firstParagraph}\n\n${secondParagraph}`

    const chunks = chunkNormalizedText(text)

    expect(chunks[0]).toEqual({
      chunkIndex: 0,
      content: firstParagraph,
    })
    expect(chunks[1]?.chunkIndex).toBe(1)
    expect(chunks[1]?.content.startsWith('a'.repeat(200))).toBe(true)
    expect(chunks[1]?.content.endsWith(secondParagraph)).toBe(true)
  })

  it('falls back to the target size when paragraph boundaries are too early', () => {
    const text = `${'a'.repeat(300)}\n\n${'b'.repeat(1_500)}`
    const chunks = chunkNormalizedText(text)

    expect(chunks[0]?.content).toHaveLength(MATERIAL_CHUNK_TARGET_CHARACTERS)
  })

  it('does not emit empty chunks around boundary whitespace', () => {
    const text = `${'a'.repeat(1_050)}\n\n\n\n${'b'.repeat(1_050)}`

    expect(
      chunkNormalizedText(text).every((chunk) => chunk.content !== ''),
    ).toBe(true)
  })

  it('is repeatable for the same normalized text', () => {
    const text = [
      'Intro paragraph about Python.',
      'a'.repeat(1_400),
      'b'.repeat(900),
      'Conclusion paragraph.',
    ].join('\n\n')

    expect(chunkNormalizedText(text)).toEqual(chunkNormalizedText(text))
  })
})
