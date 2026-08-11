import { apiJson } from '@/features/auth/session/interface/authenticated-api-client'
import type { ApiFetchOptions } from '@/features/auth/session/interface/authenticated-api-client'
import { courseMembershipListSchema } from '@/features/courses/course-membership/course-membership.schema'

export async function getCourseMembership(options: ApiFetchOptions = {}) {
  const response = await apiJson<unknown>(
    '/api/v1/courses/material-management',
    { ...options, method: 'GET' },
  )

  return courseMembershipListSchema.parse(response).courses
}
