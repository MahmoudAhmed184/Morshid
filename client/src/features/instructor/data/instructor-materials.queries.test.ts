import { describe, expect, it } from 'vitest'

import type { InstructorMaterial } from '@/features/instructor/schemas/instructor-material.schema'

import {
  instructorMaterialKeys,
  instructorMaterialsQueryOptions,
} from './instructor-materials.queries'

const scope = {
  instructorId: 'd005dfdb-aabe-4f65-a2dc-61e75ba203a6',
  courseId: 'f5bb713c-09b7-42d3-acf3-02f39a902e5a',
}

function material(status: InstructorMaterial['status']): InstructorMaterial {
  return {
    id: '3e533215-42ba-42b8-ad6a-404e7bb3c8d7',
    courseId: scope.courseId,
    title: 'Python Functions',
    originalFilename: 'python-functions.pdf',
    status,
    extractedTextLength: status === 'PROCESSING' ? null : 4_820,
    chunkCount: status === 'PROCESSING' ? null : 6,
    errorMessage: status === 'FAILED' ? 'Processing failed.' : null,
    createdAt: '2026-07-21T12:00:00.000Z',
    updatedAt: '2026-07-21T12:01:00.000Z',
  }
}

function listPollingIntervalFor(
  status: InstructorMaterial['status'],
  error: Error | null = null,
) {
  const options = instructorMaterialsQueryOptions(scope)
  const refetchInterval = options.refetchInterval

  if (typeof refetchInterval !== 'function') {
    throw new Error('Expected a material-list polling callback')
  }

  return refetchInterval({
    state: { data: [material(status)], error },
  } as Parameters<typeof refetchInterval>[0])
}

describe('Instructor material query options', () => {
  it('partitions list and configuration keys by Instructor and course', () => {
    expect(instructorMaterialKeys.list(scope)).toEqual([
      'instructor',
      scope.instructorId,
      'materials',
      'list',
      'courses',
      scope.courseId,
    ])
    expect(
      instructorMaterialKeys.uploadConfiguration(scope.instructorId),
    ).toEqual([
      'instructor',
      scope.instructorId,
      'materials',
      'upload-configuration',
    ])
    expect(
      instructorMaterialKeys.list({
        ...scope,
        instructorId: 'b1c32511-1348-411d-be9b-6879be6af035',
      }),
    ).not.toEqual(instructorMaterialKeys.list(scope))
  })

  it('polls only while processing is active and the previous request succeeded', () => {
    expect(listPollingIntervalFor('PROCESSING')).toBe(2_000)
    expect(
      listPollingIntervalFor('PROCESSING', new Error('polling unavailable')),
    ).toBe(false)
  })

  it.each(['READY', 'WARNING', 'FAILED'] as const)(
    'stops polling when material status becomes %s',
    (status) => {
      expect(listPollingIntervalFor(status)).toBe(false)
    },
  )
})
