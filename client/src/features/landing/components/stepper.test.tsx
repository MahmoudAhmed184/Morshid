import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { stubReducedMotionPreference } from './test-support/reduced-motion'
import { Step, Stepper } from './stepper'

describe('landing stepper reduced motion', () => {
  beforeEach(() => {
    stubReducedMotionPreference()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('presents step changes statically when reduced motion is requested', () => {
    const { container } = render(
      <Stepper>
        <Step>First concept</Step>
        <Step>Second concept</Step>
      </Stepper>,
    )

    expect(container.firstElementChild).toHaveAttribute(
      'data-reduced-motion',
      'true',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Step 2' }))
    expect(screen.getByText('Second concept')).toBeVisible()
  })
})
