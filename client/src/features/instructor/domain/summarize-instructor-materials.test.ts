import { describe, expect, it } from 'vitest'

import type { InstructorMaterial } from '@/features/instructor/schemas/instructor-material.schema'

import { summarizeInstructorMaterials } from './summarize-instructor-materials'

const courseId = 'f5bb713c-09b7-42d3-acf3-02f39a902e5a'

function material(
  id: string,
  status: InstructorMaterial['status'],
): InstructorMaterial {
  return {
    id,
    courseId,
    title: `${status} material`,
    originalFilename: `${status.toLowerCase()}.pdf`,
    status,
    extractedTextLength: status === 'PROCESSING' ? null : 1_024,
    chunkCount: status === 'PROCESSING' ? null : 2,
    errorMessage: status === 'FAILED' ? 'Processing failed.' : null,
    createdAt: '2026-07-21T12:00:00.000Z',
    updatedAt: '2026-07-21T12:01:00.000Z',
  }
}

describe('summarizeInstructorMaterials', () => {
  it('returns zero counts for an empty material list', () => {
    expect(summarizeInstructorMaterials([])).toEqual({
      total: 0,
      processing: 0,
      ready: 0,
      attention: 0,
    })
  })

  it('buckets every material status into the shared dashboard totals', () => {
    const materials = [
      material('3e533215-42ba-42b8-ad6a-404e7bb3c8d7', 'PROCESSING'),
      material('50454f1a-f541-4410-a315-d440d208909f', 'READY'),
      material('abac5762-5c0d-49ac-ac3c-ced4600603d4', 'WARNING'),
      material('370549a0-579b-40da-a41f-80a85a91bc4c', 'FAILED'),
    ]

    expect(summarizeInstructorMaterials(materials)).toEqual({
      total: 4,
      processing: 1,
      ready: 1,
      attention: 2,
    })
  })
})
