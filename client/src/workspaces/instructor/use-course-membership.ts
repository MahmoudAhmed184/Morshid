import { useQuery } from '@tanstack/react-query'

import { useAuthStore } from '@/features/auth/session/interface/session-store'
import { courseMembershipQueryOptions } from '@/features/courses/course-membership/course-membership.queries'

export function useCourseMembership() {
  const userId = useAuthStore((state) => state.user?.id)

  return useQuery(courseMembershipQueryOptions(userId))
}
