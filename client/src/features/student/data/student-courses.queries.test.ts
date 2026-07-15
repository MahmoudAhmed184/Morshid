import { describe, expect, it } from 'vitest'

import { studentCoursesQueryOptions } from './student-courses.queries'

describe('studentCoursesQueryOptions', () => {
  it('partitions scoped course caches by authenticated student', () => {
    expect(studentCoursesQueryOptions('student-1').queryKey).toEqual([
      'student',
      'student-1',
      'courses',
    ])
    expect(studentCoursesQueryOptions('student-2').queryKey).not.toEqual(
      studentCoursesQueryOptions('student-1').queryKey,
    )
  })
})
