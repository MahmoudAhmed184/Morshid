import { infiniteQueryOptions } from '@tanstack/react-query'

import {
  getCourseAdministration,
  getCourseMembers,
} from './course-administration.api'
import type { CourseMembershipRole } from './course-administration.schema'

export const courseAdministrationKeys = {
  all: (adminId: string) => ['admin', adminId, 'courses'] as const,
  list: (adminId: string, search: string) =>
    [...courseAdministrationKeys.all(adminId), { search }] as const,
  members: (
    adminId: string,
    courseId: string,
    search = '',
    role?: CourseMembershipRole,
  ) =>
    [
      'admin',
      adminId,
      'courses',
      courseId,
      'members',
      { role, search },
    ] as const,
}

export const courseAdministrationQueryOptions = (
  adminId: string,
  search = '',
) =>
  infiniteQueryOptions({
    queryKey: courseAdministrationKeys.list(adminId, search),
    queryFn: ({ pageParam }) =>
      getCourseAdministration(
        {},
        {
          cursor: pageParam,
          search: search || undefined,
        },
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor,
  })

export const courseMembersQueryOptions = (
  adminId: string,
  courseId: string,
  search = '',
  role?: CourseMembershipRole,
) =>
  infiniteQueryOptions({
    queryKey: courseAdministrationKeys.members(adminId, courseId, search, role),
    queryFn: ({ pageParam }) =>
      getCourseMembers(
        courseId,
        {},
        {
          cursor: pageParam,
          search: search || undefined,
          role,
        },
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor,
  })
