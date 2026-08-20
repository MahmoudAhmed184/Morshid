import { queryOptions } from '@tanstack/react-query'

import { getCourseAdministration } from '@/features/courses/interface'
import {
  getStudentTutoringAllowance,
  getStudentReviewAllowance,
  getAdminAllowancePolicies,
} from './allowances.api'

export const allowancesKeys = {
  all: ['allowances'] as const,
  tutoring: (courseId: string) => ['allowances', 'tutoring', courseId] as const,
  reviews: (courseId: string) => ['allowances', 'reviews', courseId] as const,
  adminPolicies: () => ['allowances', 'admin', 'policies'] as const,
}

export function studentTutoringAllowanceQueryOptions(courseId: string) {
  return queryOptions({
    queryKey: allowancesKeys.tutoring(courseId),
    queryFn: () => getStudentTutoringAllowance(courseId),
    enabled: Boolean(courseId),
  })
}

export function studentReviewAllowanceQueryOptions(courseId: string) {
  return queryOptions({
    queryKey: allowancesKeys.reviews(courseId),
    queryFn: () => getStudentReviewAllowance(courseId),
    enabled: Boolean(courseId),
  })
}

export function adminAllowancePoliciesQueryOptions() {
  return queryOptions({
    queryKey: allowancesKeys.adminPolicies(),
    queryFn: () => getAdminAllowancePolicies(),
  })
}

export function adminCoursesListQueryOptions() {
  return queryOptions({
    queryKey: ['admin', 'courses', 'allowances-list'] as const,
    queryFn: () => getCourseAdministration(),
  })
}
