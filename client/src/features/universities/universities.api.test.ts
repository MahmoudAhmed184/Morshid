import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createUniversity,
  getUniversity,
  listUniversities,
  updateUniversity,
  updateUniversityStatus,
} from './universities.api'

describe('universities.api', () => {
  const sampleUniversity = {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Demo University',
    code: 'DEMO_UNI',
    status: 'ACTIVE',
    owner: {
      id: '00000000-0000-4000-8000-000000000002',
      displayName: 'Demo Owner',
      email: 'owner@demo.edu',
      status: 'ACTIVE',
    },
    studentsCount: 100,
    instructorsCount: 10,
    coursesCount: 5,
    createdAt: '2026-08-19T10:00:00.000Z',
    updatedAt: '2026-08-19T10:00:00.000Z',
  }

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('lists universities with query parameters', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      expect(url).toContain('/api/v1/universities?')
      expect(url).toContain('search=demo')
      expect(url).toContain('status=ACTIVE')
      expect(url).toContain('page=2')
      expect(url).toContain('limit=10')
      return Response.json({
        data: [sampleUniversity],
        pagination: { page: 2, limit: 10, totalCount: 1, totalPages: 1 },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await listUniversities({
      search: 'demo',
      status: 'ACTIVE',
      page: 2,
      limit: 10,
    })

    expect(result.data).toHaveLength(1)
    expect(result.data[0].id).toBe(sampleUniversity.id)
  })

  it('fetches a single university by ID', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ university: sampleUniversity }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await getUniversity(sampleUniversity.id)
    expect(result.name).toBe('Demo University')
    expect(result.owner?.displayName).toBe('Demo Owner')
  })

  it('creates a university with its primary admin owner', async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body))
        expect(body.name).toBe('New Uni')
        expect(body.code).toBe('NEW_UNI')
        expect(body.owner.displayName).toBe('New Admin')
        return Response.json({
          university: {
            ...sampleUniversity,
            name: 'New Uni',
            code: 'NEW_UNI',
          },
        })
      },
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await createUniversity({
      name: 'New Uni',
      code: 'NEW_UNI',
      status: 'ACTIVE',
      ownerDisplayName: 'New Admin',
      ownerEmail: 'admin@newuni.edu',
      ownerPassword: 'StrongPassword123!',
    })

    expect(result.name).toBe('New Uni')
  })

  it('updates university metadata', async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body))
        expect(body.name).toBe('Renamed Uni')
        return Response.json({
          university: {
            ...sampleUniversity,
            name: 'Renamed Uni',
          },
        })
      },
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await updateUniversity(sampleUniversity.id, {
      name: 'Renamed Uni',
    })
    expect(result.name).toBe('Renamed Uni')
  })

  it('updates university status', async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body))
        expect(body.status).toBe('SUSPENDED')
        return Response.json({
          university: {
            ...sampleUniversity,
            status: 'SUSPENDED',
          },
        })
      },
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await updateUniversityStatus(
      sampleUniversity.id,
      'SUSPENDED',
    )
    expect(result.status).toBe('SUSPENDED')
  })
})
