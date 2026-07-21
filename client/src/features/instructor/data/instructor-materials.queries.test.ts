import { describe, expect, it } from 'vitest'

import type { InstructorMaterialStatus } from '@/features/instructor/schemas/instructor-material.schema'

import {
  instructorMaterialKeys,
  instructorMaterialStatusQueryOptions,
} from './instructor-materials.queries'

const scope = {
  instructorId: 'd005dfdb-aabe-4f65-a2dc-61e75ba203a6',
  courseId: 'f5bb713c-09b7-42d3-acf3-02f39a902e5a',
  materialId: '3e533215-42ba-42b8-ad6a-404e7bb3c8d7',
}

function statusResponse(
  status: InstructorMaterialStatus['status'],
): InstructorMaterialStatus {
  return {
    id: scope.materialId,
    status,
    extractedTextLength: status === 'PROCESSING' ? null : 4_820,
    chunkCount: status === 'PROCESSING' ? null : 6,
    errorMessage: status === 'FAILED' ? 'Processing failed.' : null,
    updatedAt: '2026-07-21T12:01:00.000Z',
  }
}

function pollingIntervalFor(status: InstructorMaterialStatus['status']) {
  const options = instructorMaterialStatusQueryOptions(scope)
  const refetchInterval = options.refetchInterval

  if (typeof refetchInterval !== 'function') {
    throw new Error('Expected a status-aware polling callback')
  }

  return refetchInterval({
    state: { data: statusResponse(status) },
  } as Parameters<typeof refetchInterval>[0])
}

describe('Instructor material query options', () => {
  it('partitions material keys by Instructor, course, and material', () => {
    expect(instructorMaterialKeys.list(scope)).toEqual([
      'instructor',
      scope.instructorId,
      'materials',
      'list',
      'courses',
      scope.courseId,
    ])
    expect(instructorMaterialKeys.status(scope)).toEqual([
      'instructor',
      scope.instructorId,
      'materials',
      'courses',
      scope.courseId,
      'status',
      scope.materialId,
    ])
    expect(
      instructorMaterialKeys.list({
        ...scope,
        instructorId: 'b1c32511-1348-411d-be9b-6879be6af035',
      }),
    ).not.toEqual(instructorMaterialKeys.list(scope))
  })

  it('polls while material processing is active', () => {
    expect(pollingIntervalFor('PROCESSING')).toBe(2_000)
  })

  it.each(['READY', 'WARNING', 'FAILED'] as const)(
    'stops polling when material status becomes %s',
    (status) => {
      expect(pollingIntervalFor(status)).toBe(false)
    },
  )
})
