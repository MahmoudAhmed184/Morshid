import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { InstructorDashboardPage } from './instructor-dashboard-page'

describe('InstructorDashboardPage', () => {
  afterEach(cleanup)

  it('shows the seeded Python course and later-sprint work areas', () => {
    render(
      <InstructorDashboardPage
        state={{
          status: 'ready',
          course: {
            code: 'PYTHON-PROG-P0',
            title: 'Python Programming',
          },
          materialCount: 0,
          reviewQueueCount: 0,
        }}
      />,
    )

    expect(
      screen.getByRole('heading', { name: 'Instructor dashboard' }),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Python Programming' }),
    ).toBeVisible()
    expect(screen.getByText('PYTHON-PROG-P0')).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Course materials' }),
    ).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Review queue' })).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Source readiness' }),
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Upload material' }),
    ).toBeDisabled()
    expect(
      screen.queryByRole('button', { name: /manage users/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /course assignments/i }),
    ).not.toBeInTheDocument()
  })

  it('shows a dashboard loading state while course data is requested', () => {
    render(<InstructorDashboardPage state={{ status: 'loading' }} />)

    expect(
      screen.getByRole('status', { name: 'Loading instructor dashboard' }),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Instructor dashboard' }),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Assigned course' }),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Workspace metrics' }),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Course materials' }),
    ).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Review queue' })).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Source readiness' }),
    ).toBeVisible()
    expect(
      screen.getByText(
        'Manage course sources and review activity for your assigned course.',
      ),
    ).toBeVisible()
    expect(screen.getByLabelText('Loading assigned course')).toBeVisible()
    expect(screen.getByLabelText('Loading materials rows')).toBeVisible()
    expect(screen.getByLabelText('Loading reviews rows')).toBeVisible()
    expect(
      screen.getByLabelText('Loading Course materials metric'),
    ).toBeVisible()
    expect(screen.getByLabelText('Loading Review queue metric')).toBeVisible()
  })

  it('keeps section headings and shows an inline error for the course area', () => {
    render(
      <InstructorDashboardPage
        state={{
          status: 'error',
          onRetry: () => undefined,
        }}
      />,
    )

    expect(
      screen.getByRole('heading', { name: 'Instructor dashboard' }),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Assigned course' }),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Unable to load course' }),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Course materials' }),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeVisible()
  })

  it('shows a clear empty state when the Instructor owns no course', () => {
    render(<InstructorDashboardPage state={{ status: 'empty' }} />)

    expect(
      screen.getByRole('heading', { name: 'No assigned course' }),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Workspace metrics' }),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Course materials' }),
    ).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Review queue' })).toBeVisible()
    expect(
      screen.getByText(/ask an administrator to assign you/i),
    ).toBeVisible()
  })
})
