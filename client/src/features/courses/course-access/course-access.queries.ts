import { queryOptions } from '@tanstack/react-query'

import { getStudentCourseAccess } from '@/features/courses/course-access/course-access.api'

export function studentCourseAccessQueryOptions(studentId: string) {
  return queryOptions({
    queryKey: ['student', studentId, 'courses'],
    queryFn: () => getStudentCourseAccess(),
  })
}
