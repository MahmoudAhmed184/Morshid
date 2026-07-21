import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { InstructorDashboardPage } from './instructor-dashboard-page'

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  Link: ({
    to,
    children,
    ...props
  }: {
    to?: string
    children?: React.ReactNode
  }) => (
    <a href={typeof to === 'string' ? to : '#'} {...props}>
      {children}
    </a>
  ),
}))

const renderWithRouter = render

describe('InstructorDashboardPage', () => {
  afterEach(cleanup)

  it('shows the seeded Python course and the teaching-desk work areas', () => {
    renderWithRouter(
      <InstructorDashboardPage
        state={{
          status: 'ready',
          course: {
            id: 'python-course',
            code: 'PYTHON-PROG-P0',
            title: 'Python Programming',
          },
          materialCount: 0,
          reviewQueueCount: 0,
        }}
      />,
    )

    expect(
      screen.getByRole('heading', { name: "Today's teaching desk." }),
    ).toBeVisible()
    expect(screen.getByText('THE REGISTER')).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Python Programming' }),
    ).toBeVisible()
    expect(screen.getAllByText('PYTHON-PROG-P0').length).toBeGreaterThanOrEqual(
      1,
    )
    expect(screen.getByText('Needs review')).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Source readiness' }),
    ).toBeVisible()
    expect(screen.getByText('Open materials →')).toBeVisible()
    expect(screen.getByText('Open the queue →')).toBeVisible()
    expect(
      screen.queryByRole('button', { name: /manage users/i }),
    ).not.toBeInTheDocument()
  })

  it('shows a dashboard loading state while course data is requested', () => {
    renderWithRouter(<InstructorDashboardPage state={{ status: 'loading' }} />)

    expect(
      screen.getByRole('status', { name: 'Loading instructor dashboard' }),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { name: "Today's teaching desk." }),
    ).toBeVisible()
    expect(
      screen.getByText(
        'Manage course sources and review activity for your assigned course.',
      ),
    ).toBeVisible()
    expect(screen.getByLabelText('Loading assigned course')).toBeVisible()
    expect(screen.getByLabelText('Loading Course metric')).toBeVisible()
    expect(screen.getByLabelText('Loading Materials metric')).toBeVisible()
    expect(screen.getByLabelText('Loading Review queue metric')).toBeVisible()
    expect(screen.getByLabelText('Loading source readiness')).toBeVisible()
  })

  it('keeps the header and shows an inline error for the course area', () => {
    renderWithRouter(
      <InstructorDashboardPage
        state={{
          status: 'error',
          onRetry: () => undefined,
        }}
      />,
    )

    expect(
      screen.getByRole('heading', { name: "Today's teaching desk." }),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Unable to load course' }),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeVisible()
  })

  it('shows a clear empty state when the Instructor owns no course', () => {
    renderWithRouter(<InstructorDashboardPage state={{ status: 'empty' }} />)

    expect(
      screen.getByRole('heading', { name: 'No assigned course' }),
    ).toBeVisible()
    expect(screen.getByText('Needs review')).toBeVisible()
    expect(
      screen.getByText(/ask an administrator to assign you/i),
    ).toBeVisible()
  })
})
