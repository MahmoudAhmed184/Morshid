import { queryOptions } from '@tanstack/react-query'

import {
  getAdminCourseMaterials,
  getAdminCourseMembers,
  getAdminCourses,
} from './admin-courses.api'

export const adminCourseKeys = {
  all: (adminId: string) => ['admin', adminId, 'courses'] as const,
  members: (adminId: string, courseId: string) =>
    ['admin', adminId, 'courses', courseId, 'members'] as const,
  materials: (adminId: string, courseId: string) =>
    ['admin', adminId, 'courses', courseId, 'materials'] as const,
}

export const adminCoursesQueryOptions = (adminId: string) =>
  queryOptions({
    queryKey: adminCourseKeys.all(adminId),
    queryFn: getAdminCourses,
  })

export const adminCourseMembersQueryOptions = (
  adminId: string,
  courseId: string,
) =>
  queryOptions({
    queryKey: adminCourseKeys.members(adminId, courseId),
    queryFn: () => getAdminCourseMembers(courseId),
  })

export const adminCourseMaterialsQueryOptions = (
  adminId: string,
  courseId: string,
) =>
  queryOptions({
    queryKey: adminCourseKeys.materials(adminId, courseId),
    queryFn: () => getAdminCourseMaterials(courseId),
  })
