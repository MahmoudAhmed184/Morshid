import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import type { UniversityItem } from '@/features/universities/universities.schema'
import { UniversitiesTable } from './universities-table'

const sampleUniversity: UniversityItem = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'King Saud University',
  code: 'KSU',
  status: 'ACTIVE',
  owner: {
    id: '00000000-0000-4000-8000-000000000002',
    displayName: 'Dr. Fatima',
    email: 'fatima@ksu.edu.sa',
    status: 'ACTIVE',
  },
  studentsCount: 1200,
  instructorsCount: 80,
  coursesCount: 45,
  createdAt: '2026-08-19T10:00:00.000Z',
  updatedAt: '2026-08-19T10:00:00.000Z',
}

describe('UniversitiesTable', () => {
  afterEach(cleanup)

  it('renders university rows with details, status, and owner info', () => {
    const queryClient = new QueryClient()
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    render(<UniversitiesTable universities={[sampleUniversity]} />, { wrapper })

    expect(screen.getByText('King Saud University')).toBeInTheDocument()
    expect(screen.getByText('KSU')).toBeInTheDocument()
    expect(screen.getByText('Dr. Fatima')).toBeInTheDocument()
    expect(screen.getByText('fatima@ksu.edu.sa')).toBeInTheDocument()
    expect(screen.getByText('1200')).toBeInTheDocument()
    expect(screen.getByText('80')).toBeInTheDocument()
    expect(screen.getByText('45')).toBeInTheDocument()
  })
})
