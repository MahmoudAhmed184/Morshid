import { queryOptions } from '@tanstack/react-query'

import { getInstructorCourses } from '@/features/instructor/data/instructor-dashboard.api'

export function instructorCoursesQueryOptions(userId: string | undefined) {
  return queryOptions({
    queryKey: ['instructor', 'material-manageable-courses', userId],
    queryFn: getInstructorCourses,
  })
}
