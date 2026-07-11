import { queryOptions } from '@tanstack/react-query'

import { getStudentCourses } from '@/features/student/api/student-courses.api'

export const studentCoursesQueryOptions = queryOptions({
  queryKey: ['student', 'courses'],
  queryFn: () => getStudentCourses(),
})
