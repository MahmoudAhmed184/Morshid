import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { InstructorDashboardPage } from './instructor-dashboard-page'

describe('InstructorDashboardPage', () => {
  afterEach(cleanup)

  it('renders multiple assigned courses without starting dashboard-wide material aggregation', () => {
    render(
      <InstructorDashboardPage
        state={{
          status: 'ready',
          courses: [
            {
              id: 'data-structures-course',
              code: 'CS-201',
              title: 'Data Structures',
              membershipRole: 'INSTRUCTOR',
              canManageMaterials: true,
            },
            {
              id: 'discrete-math-course',
              code: 'MATH-310',
              title: 'Discrete Mathematics',
              membershipRole: 'INSTRUCTOR',
              canManageMaterials: true,
            },
          ],
        }}
      />,
    )

    expect(
      screen.getByRole('heading', { name: 'Instructor dashboard' }),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Data Structures' }),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Discrete Mathematics' }),
    ).toBeVisible()
    expect(screen.getByText('CS-201')).toBeVisible()
    expect(screen.getByText('MATH-310')).toBeVisible()
    const assignedCoursesCard = screen
      .getByText('Assigned courses', { selector: '[data-slot="card-title"]' })
      .closest('[data-slot="card"]')
    const totalMaterialsCard = screen
      .getByText('Total materials', { selector: '[data-slot="card-title"]' })
      .closest('[data-slot="card"]')

    expect(
      within(assignedCoursesCard as HTMLElement).getByText('2'),
    ).toBeVisible()
    expect(
      within(totalMaterialsCard as HTMLElement).getByText('—'),
    ).toBeVisible()
    expect(
      screen.getByText('Source readiness is course-specific'),
    ).toBeVisible()
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
      screen.getByRole('heading', { name: 'Assigned courses' }),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Workspace metrics' }),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Source readiness' }),
    ).toBeVisible()
    expect(
      screen.getByText(
        'Monitor your assigned courses and course-source readiness.',
      ),
    ).toBeVisible()
    expect(screen.getByLabelText('Loading assigned course')).toBeVisible()
    expect(
      screen.getByLabelText('Loading Assigned courses metric'),
    ).toBeVisible()
    expect(
      screen.getByLabelText('Loading Total materials metric'),
    ).toBeVisible()
    expect(
      screen.getByLabelText('Loading Ready materials metric'),
    ).toBeVisible()
    expect(screen.getByLabelText('Loading Processing sources')).toBeVisible()
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
      screen.getByRole('heading', { name: 'Assigned courses' }),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Unable to load course' }),
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
      screen.getByText(/ask an administrator to assign you/i),
    ).toBeVisible()
  })
})
