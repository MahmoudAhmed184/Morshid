import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { NotFoundPage } from './not-found-page'

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    ...props
  }: {
    children?: React.ReactNode
    to: string
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('@/components/ui/mode-toggle', () => ({
  ModeToggle: () => <button type="button">Theme</button>,
}))

describe('NotFoundPage', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders the 404 number, heading, and description', () => {
    render(<NotFoundPage />)

    expect(screen.getByText('404')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 1, name: /page not found/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        /the page you are looking for doesn't exist or has been moved/i,
      ),
    ).toBeInTheDocument()
  })

  it('provides navigation link back to home', () => {
    render(<NotFoundPage />)

    expect(screen.getByRole('link', { name: /back to home/i })).toHaveAttribute(
      'href',
      '/',
    )
  })

  it('triggers browser history back when Go Back is clicked', async () => {
    const user = userEvent.setup()
    const historyBackSpy = vi
      .spyOn(window.history, 'back')
      .mockImplementation(() => {})

    render(<NotFoundPage />)

    const backButton = screen.getByRole('button', { name: /go back/i })
    await user.click(backButton)

    expect(historyBackSpy).toHaveBeenCalledTimes(1)
  })
})
