import { queryOptions } from '@tanstack/react-query'

import {
  getAdminAuditEvents,
  getAdminCourses,
  getAdminMaterials,
  getAdminUsers,
} from './admin-ops.api'

export const adminUsersQueryOptions = () =>
  queryOptions({
    queryKey: ['admin', 'users'],
    queryFn: getAdminUsers,
  })

export const adminCoursesQueryOptions = () =>
  queryOptions({
    queryKey: ['admin', 'courses'],
    queryFn: getAdminCourses,
  })

export const adminMaterialsQueryOptions = () =>
  queryOptions({
    queryKey: ['admin', 'materials'],
    queryFn: getAdminMaterials,
  })

export const adminAuditQueryOptions = () =>
  queryOptions({
    queryKey: ['admin', 'audit'],
    queryFn: getAdminAuditEvents,
  })
