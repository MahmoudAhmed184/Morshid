import { queryOptions } from '@tanstack/react-query'

import { getCourseMembership } from '@/features/courses/course-membership/course-membership.api'

export function courseMembershipQueryOptions(userId: string | undefined) {
  return queryOptions({
    queryKey: ['instructor', 'material-manageable-courses', userId],
    queryFn: getCourseMembership,
  })
}
