import { useSuspenseQuery } from '@tanstack/react-query'

import { useAuthStore } from '@/features/auth/stores/auth.store'
import { studentCoursesQueryOptions } from '@/features/student/queries/student-courses.query'

export function useStudentCourses() {
  const studentId = useAuthStore((state) => state.user?.id)

  if (!studentId) {
    throw new Error('Student courses require an authenticated user')
  }

  return useSuspenseQuery(studentCoursesQueryOptions(studentId))
}
