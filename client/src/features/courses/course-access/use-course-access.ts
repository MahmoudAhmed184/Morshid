import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'

import { useAuthStore } from '@/features/auth/session/session.store'
import { studentCourseAccessQueryOptions } from '@/features/courses/course-access/course-access.queries'
import type { StudentCourseAccess } from '@/features/courses/course-access/course-access.schema'

// Route `beforeLoad` is the auth boundary (TanStack Router). useSuspenseQuery
// cannot be disabled with `enabled`/`skipToken` (TanStack Query), so when logout
// clears the session before this tree unmounts we must still return a defined
// query result instead of throwing into the error boundary.
const unauthenticatedStudentCoursesQueryOptions = queryOptions({
  queryKey: ['student', 'anonymous', 'courses'],
  queryFn: async (): Promise<StudentCourseAccess[]> => [],
  initialData: [],
})

export function useStudentCourses() {
  const studentId = useAuthStore((state) => state.user?.id)

  return useSuspenseQuery(
    studentId
      ? studentCourseAccessQueryOptions(studentId)
      : unauthenticatedStudentCoursesQueryOptions,
  )
}
