import { useQuery } from '@tanstack/react-query'

import { useAuthStore } from '@/features/auth/stores/auth.store'
import { instructorCoursesQueryOptions } from '@/features/instructor/data/instructor-dashboard.queries'

export function useInstructorCourses() {
  const userId = useAuthStore((state) => state.user?.id)

  return useQuery(instructorCoursesQueryOptions(userId))
}
