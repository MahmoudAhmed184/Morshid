import '@testing-library/jest-dom/vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Reveal } from './reveal'
import { stubReducedMotionPreference } from './test-support/reduced-motion'

describe('Reveal', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('shows its children without waiting for intersection under reduced motion', async () => {
    stubReducedMotionPreference()
    const observe = vi.fn()
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe = observe
        disconnect = vi.fn()
        unobserve = vi.fn()
      },
    )

    render(<Reveal>Method copy</Reveal>)

    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve))
    })

    expect(observe).not.toHaveBeenCalled()
    expect(screen.getByText('Method copy')).toHaveAttribute(
      'data-revealed',
      'true',
    )
    expect(screen.getByText('Method copy')).not.toHaveClass(
      'motion-safe:opacity-0',
    )
  })

  it('reveals on intersection when motion is allowed', () => {
    let trigger: ((entries: { isIntersecting: boolean }[]) => void) | undefined
    const disconnect = vi.fn()
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(
          callback: (entries: { isIntersecting: boolean }[]) => void,
        ) {
          trigger = callback
        }
        observe = vi.fn()
        disconnect = disconnect
        unobserve = vi.fn()
      },
    )

    render(<Reveal>Method copy</Reveal>)

    expect(screen.getByText('Method copy')).not.toHaveAttribute('data-revealed')

    act(() => trigger?.([{ isIntersecting: true }]))

    expect(screen.getByText('Method copy')).toHaveAttribute(
      'data-revealed',
      'true',
    )
    expect(disconnect).toHaveBeenCalled()
  })
})
