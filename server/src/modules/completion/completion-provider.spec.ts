import {
  COMPLETION_ERROR_CODES,
  CompletionProviderError,
} from './completion-provider'

describe('CompletionProviderError', () => {
  it.each(COMPLETION_ERROR_CODES)(
    'exposes only the safe code for %s',
    (code) => {
      const error = new CompletionProviderError(code)

      expect(error).toBeInstanceOf(Error)
      expect(error.name).toBe('CompletionProviderError')
      expect(Object.keys(error)).toEqual(['code'])
      expect(error.message).not.toContain('undefined')
    },
  )
})
