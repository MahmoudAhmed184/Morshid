import { afterEach, describe, expect, it } from 'vitest'

import { visibilityAwarePollingInterval } from './polling'

describe('visibilityAwarePollingInterval', () => {
  afterEach(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })
  })

  it('polls active screens more often than background tabs', () => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })
    expect(visibilityAwarePollingInterval()).toBe(15_000)

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    })
    expect(visibilityAwarePollingInterval()).toBe(60_000)
  })
})
