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
    expect(screen.getByText('Loading your course workspace')).toBeVisible()
  })

  it('shows a clear empty state when the Instructor owns no course', () => {
    render(<InstructorDashboardPage state={{ status: 'empty' }} />)

    expect(
      screen.getByRole('heading', { name: 'No assigned course' }),
    ).toBeVisible()
    expect(
      screen.getByText(/ask an administrator to assign you/i),
    ).toBeVisible()
  })
})
