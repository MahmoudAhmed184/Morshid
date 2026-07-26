import { queryOptions } from '@tanstack/react-query'

import { getStudentCourses } from '@/features/student/data/student-courses.api'

export function studentCoursesQueryOptions(studentId: string) {
  return queryOptions({
    queryKey: ['student', studentId, 'courses'],
    queryFn: () => getStudentCourses(),
  })
}
