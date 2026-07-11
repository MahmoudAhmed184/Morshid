import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { RouteLoadError } from './route-load-error'

const invalidateMock = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ invalidate: invalidateMock }),
}))

describe('RouteLoadError', () => {
  it('offers a retry when a required route service is unavailable', () => {
    render(<RouteLoadError />)

    expect(
      screen.getByRole('heading', { name: /unable to load this page/i }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /try again/i }))

    expect(invalidateMock).toHaveBeenCalledOnce()
  })
})
