import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AuthRouteError } from './auth-route-error'

const invalidateMock = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ invalidate: invalidateMock }),
}))

describe('AuthRouteError', () => {
  it('offers a retry when session verification is unavailable', () => {
    render(<AuthRouteError />)

    expect(
      screen.getByRole('heading', { name: /unable to verify your session/i }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /try again/i }))

    expect(invalidateMock).toHaveBeenCalledOnce()
  })
})
