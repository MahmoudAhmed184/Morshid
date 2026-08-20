import { queryOptions } from '@tanstack/react-query'

import { getCourseAdministration } from '@/features/courses/interface'
import {
  getStudentTutoringAllowance,
  getStudentReviewAllowance,
  getAdminPolicyDefaults,
  getAdminCourseOverrides,
} from './allowances.api'

export const allowancesKeys = {
  all: ['allowances'] as const,
  tutoring: (courseId: string) => ['allowances', 'tutoring', courseId] as const,
  reviews: (courseId: string) => ['allowances', 'reviews', courseId] as const,
  adminDefaults: () => ['allowances', 'admin', 'defaults'] as const,
  adminOverrides: (scope?: 'TUTORING' | 'REVIEW') =>
    ['allowances', 'admin', 'overrides', scope ?? 'all'] as const,
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

export function adminPolicyDefaultsQueryOptions() {
  return queryOptions({
    queryKey: allowancesKeys.adminDefaults(),
    queryFn: () => getAdminPolicyDefaults(),
  })
}

export function adminCourseOverridesQueryOptions(
  scope?: 'TUTORING' | 'REVIEW',
) {
  return queryOptions({
    queryKey: allowancesKeys.adminOverrides(scope),
    queryFn: () => getAdminCourseOverrides(scope),
  })
}

export function adminCoursesListQueryOptions() {
  return queryOptions({
    queryKey: ['admin', 'courses', 'allowances-list'] as const,
    queryFn: () => getCourseAdministration(),
  })
}
