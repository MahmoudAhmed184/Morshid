import { normalizeDeterministicText } from './normalize-deterministic-text'

describe('normalizeDeterministicText', () => {
  it.each([
    ['trims surrounding whitespace', '  foo  ', 'foo'],
    ['collapses whitespace runs', 'a \n\t b', 'a b'],
    ['applies NFKC normalization', 'ﬁle', 'file'],
    ['reduces whitespace-only input to empty', ' \n\t ', ''],
  ])('%s', (_, input, expected) => {
    expect(normalizeDeterministicText(input)).toBe(expected)
  })
})
