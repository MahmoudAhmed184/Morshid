import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useDebouncedValue } from './use-debounced-value'

describe('useDebouncedValue', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the initial value immediately and delays later values', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 250),
      { initialProps: { value: 'initial' } },
    )

    expect(result.current).toBe('initial')

    rerender({ value: 'updated' })
    act(() => vi.advanceTimersByTime(249))
    expect(result.current).toBe('initial')

    act(() => vi.advanceTimersByTime(1))
    expect(result.current).toBe('updated')
  })

  it('restarts the delay when the value changes again', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 250),
      { initialProps: { value: 'initial' } },
    )

    rerender({ value: 'first' })
    act(() => vi.advanceTimersByTime(200))
    rerender({ value: 'second' })
    act(() => vi.advanceTimersByTime(50))
    expect(result.current).toBe('initial')

    act(() => vi.advanceTimersByTime(200))
    expect(result.current).toBe('second')
  })
})
