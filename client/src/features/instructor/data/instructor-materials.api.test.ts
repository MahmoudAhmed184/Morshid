import { describe, expect, it, vi } from 'vitest'

import type { ApiError } from '@/features/auth/api/authenticated-api-client'

import {
  getInstructorMaterial,
  getInstructorMaterialStatus,
  listInstructorMaterials,
  uploadInstructorMaterial,
} from './instructor-materials.api'

const courseId = 'f5bb713c-09b7-42d3-acf3-02f39a902e5a'
const materialId = '3e533215-42ba-42b8-ad6a-404e7bb3c8d7'
const material = {
  id: materialId,
  courseId,
  title: 'Python Functions',
  originalFilename: 'python-functions.pdf',
  status: 'READY',
  extractedTextLength: 4_820,
  chunkCount: 6,
  errorMessage: null,
  createdAt: '2026-07-21T12:00:00.000Z',
  updatedAt: '2026-07-21T12:01:00.000Z',
} as const

describe('Instructor materials API', () => {
  it('lists and validates course-scoped materials through GET', async () => {
    const response = { materials: [material] }
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe(
          `http://localhost:4000/api/v1/courses/${courseId}/materials`,
        )
        expect(init?.method).toBe('GET')

        return Response.json(response)
      },
    )

    await expect(
      listInstructorMaterials(courseId, { fetchImpl: fetchMock }),
    ).resolves.toEqual(response)
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('loads and validates one wrapped course material through GET', async () => {
    const response = { material }
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe(
          `http://localhost:4000/api/v1/courses/${courseId}/materials/${materialId}`,
        )
        expect(init?.method).toBe('GET')

        return Response.json(response)
      },
    )

    await expect(
      getInstructorMaterial(courseId, materialId, { fetchImpl: fetchMock }),
    ).resolves.toEqual(response)
  })

  it('loads a direct material status response without a wrapper', async () => {
    const statusResponse = {
      id: materialId,
      status: 'WARNING',
      extractedTextLength: 4_820,
      chunkCount: 6,
      errorMessage: 'Some text could not be extracted.',
      updatedAt: '2026-07-21T12:02:00.000Z',
    }
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe(
          `http://localhost:4000/api/v1/courses/${courseId}/materials/${materialId}/status`,
        )
        expect(init?.method).toBe('GET')

        return Response.json(statusResponse)
      },
    )

    await expect(
      getInstructorMaterialStatus(courseId, materialId, {
        fetchImpl: fetchMock,
      }),
    ).resolves.toEqual(statusResponse)
  })

  it('uploads title and file as multipart FormData without a content-type header', async () => {
    const file = new File(['%PDF-1.7'], 'python-functions.pdf', {
      type: 'application/pdf',
    })
    const response = {
      material: {
        ...material,
        status: 'PROCESSING',
        extractedTextLength: null,
        chunkCount: null,
      },
    }
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe(
          `http://localhost:4000/api/v1/courses/${courseId}/materials`,
        )
        expect(init?.method).toBe('POST')
        expect(init?.body).toBeInstanceOf(FormData)
        expect(new Headers(init?.headers).has('Content-Type')).toBe(false)

        const formData = init?.body as FormData
        expect(formData.get('title')).toBe('Python Functions')
        expect(formData.get('file')).toBe(file)

        return Response.json(response, { status: 201 })
      },
    )

    await expect(
      uploadInstructorMaterial(
        courseId,
        { title: 'Python Functions', file },
        { fetchImpl: fetchMock },
      ),
    ).resolves.toEqual(response)
  })

  it('rejects an invalid successful API response through schema parsing', async () => {
    const malformedFetch = vi.fn(async () =>
      Response.json({ materials: [{ ...material, status: 'ARCHIVED' }] }),
    )

    await expect(
      listInstructorMaterials(courseId, { fetchImpl: malformedFetch }),
    ).rejects.toThrow()
  })

  it('propagates authenticated API errors', async () => {
    const deniedFetch = vi.fn(async () =>
      Response.json(
        {
          code: 'INSUFFICIENT_ROLE',
          message: 'Insufficient role',
        },
        { status: 403 },
      ),
    )

    await expect(
      listInstructorMaterials(courseId, { fetchImpl: deniedFetch }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<ApiError>>({
        status: 403,
        code: 'INSUFFICIENT_ROLE',
      }),
    )
  })
})
