import { infiniteQueryOptions } from '@tanstack/react-query'

import { getMaterialAdministration } from './material-administration.api'

export const materialAdministrationKeys = {
  all: (adminId: string, courseId: string) =>
    ['admin', adminId, 'courses', courseId, 'materials'] as const,
  list: (adminId: string, courseId: string, search: string) =>
    [...materialAdministrationKeys.all(adminId, courseId), { search }] as const,
}

export const materialAdministrationQueryOptions = (
  adminId: string,
  courseId: string,
  search = '',
) =>
  infiniteQueryOptions({
    queryKey: materialAdministrationKeys.list(adminId, courseId, search.trim()),
    queryFn: ({ pageParam }) =>
      getMaterialAdministration(
        courseId,
        {},
        {
          cursor: pageParam,
          search: search.trim() || undefined,
        },
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor,
  })
