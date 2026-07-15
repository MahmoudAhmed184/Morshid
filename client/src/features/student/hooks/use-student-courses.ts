import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'

import { useAuthStore } from '@/features/auth/stores/auth.store'
import { studentCoursesQueryOptions } from '@/features/student/data/student-courses.queries'
import type { StudentCourse } from '@/features/student/schemas/student-course.schema'

// Route `beforeLoad` is the auth boundary (TanStack Router). useSuspenseQuery
// cannot be disabled with `enabled`/`skipToken` (TanStack Query), so when logout
// clears the session before this tree unmounts we must still return a defined
// query result instead of throwing into the error boundary.
const unauthenticatedStudentCoursesQueryOptions = queryOptions({
  queryKey: ['student', 'anonymous', 'courses'],
  queryFn: async (): Promise<StudentCourse[]> => [],
  initialData: [],
})

export function useStudentCourses() {
  const studentId = useAuthStore((state) => state.user?.id)

  return useSuspenseQuery(
    studentId
      ? studentCoursesQueryOptions(studentId)
      : unauthenticatedStudentCoursesQueryOptions,
  )
}
