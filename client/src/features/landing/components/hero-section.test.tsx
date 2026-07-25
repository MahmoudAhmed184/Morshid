import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { HeroTranscriptStack } from './hero-section'
import { stubReducedMotionPreference } from './test-support/reduced-motion'

describe('HeroTranscriptStack', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('advances the transcript immediately and disables dragging under reduced motion', () => {
    stubReducedMotionPreference()

    const { container } = render(<HeroTranscriptStack />)

    expect(container.firstElementChild).toHaveAttribute(
      'data-reduced-motion',
      'true',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Next transcript' }))

    // No exit animation has to settle first: the next sheet is already shown.
    expect(screen.getByText('Sheet 2 of 3')).toBeVisible()
    // Dragging is a motion affordance, so it is withdrawn as well.
    expect(screen.getByRole('figure')).not.toHaveClass('cursor-grab')
  })
})
