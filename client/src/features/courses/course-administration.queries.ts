import { queryOptions } from '@tanstack/react-query'

import {
  getCourseAdministration,
  getCourseMembers,
} from './course-administration.api'

export const courseAdministrationKeys = {
  all: (adminId: string) => ['admin', adminId, 'courses'] as const,
  members: (adminId: string, courseId: string) =>
    ['admin', adminId, 'courses', courseId, 'members'] as const,
}

export const courseAdministrationQueryOptions = (adminId: string) =>
  queryOptions({
    queryKey: courseAdministrationKeys.all(adminId),
    queryFn: getCourseAdministration,
  })

export const courseMembersQueryOptions = (adminId: string, courseId: string) =>
  queryOptions({
    queryKey: courseAdministrationKeys.members(adminId, courseId),
    queryFn: () => getCourseMembers(courseId),
  })
