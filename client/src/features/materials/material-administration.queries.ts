import { queryOptions } from '@tanstack/react-query'

import { getMaterialAdministration } from './material-administration.api'

export const materialAdministrationKeys = {
  all: (adminId: string, courseId: string) =>
    ['admin', adminId, 'courses', courseId, 'materials'] as const,
}

export const materialAdministrationQueryOptions = (
  adminId: string,
  courseId: string,
) =>
  queryOptions({
    queryKey: materialAdministrationKeys.all(adminId, courseId),
    queryFn: () => getMaterialAdministration(courseId),
  })
