import { normalizeExtractedText } from './text-normalizer'

describe('normalizeExtractedText', () => {
  it('normalizes line endings and repeated spaces deterministically', () => {
    const input = '  First\t\tline  \r\nSecond   line\rThird\tline  '

    expect(normalizeExtractedText(input)).toBe(
      'First line\nSecond line\nThird line',
    )
  })

  it('collapses excess blank lines while preserving paragraph boundaries', () => {
    const input = 'Intro\n\n\n\nBody\n  \n\t \nConclusion'

    expect(normalizeExtractedText(input)).toBe('Intro\n\nBody\n\nConclusion')
  })

  it('handles form-feed page artifacts as paragraph breaks', () => {
    expect(normalizeExtractedText('Page one\fPage two')).toBe(
      'Page one\n\nPage two',
    )
  })

  it('normalizes compatibility glyphs without changing case', () => {
    expect(normalizeExtractedText('Python ﬁle')).toBe('Python file')
  })

  it.each(['', '   ', '\n\r\t\f  '])(
    'returns an empty string for whitespace-only input %j',
    (input) => {
      expect(normalizeExtractedText(input)).toBe('')
    },
  )

  it('is repeatable for already-normalized output', () => {
    const normalized = normalizeExtractedText(
      '  Variables\tstore values.\r\n\r\nLoops repeat work.  ',
    )

    expect(normalizeExtractedText(normalized)).toBe(normalized)
  })
})
