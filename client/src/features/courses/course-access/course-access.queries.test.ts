import { describe, expect, it } from 'vitest'

import { studentCourseAccessQueryOptions } from './course-access.queries'

describe('studentCourseAccessQueryOptions', () => {
  it('partitions scoped course caches by authenticated student', () => {
    expect(studentCourseAccessQueryOptions('student-1').queryKey).toEqual([
      'student',
      'student-1',
      'courses',
    ])
    expect(studentCourseAccessQueryOptions('student-2').queryKey).not.toEqual(
      studentCourseAccessQueryOptions('student-1').queryKey,
    )
  })
})
