import type { QueryClient } from '@tanstack/react-query'

import { auditQueryOptions } from '@/features/audit/audit.queries'
import {
  courseMembersQueryOptions,
  courseAdministrationQueryOptions,
} from '@/features/courses/course-administration.queries'
import { materialAdministrationQueryOptions } from '@/features/materials/material-administration.queries'
import { managedUsersInfiniteQueryOptions } from '@/features/user-management/user-management.queries'
import { useAuthStore } from '@/features/auth/session/session.store'

type AdminLoaderArgs = {
  context: {
    queryClient: QueryClient
  }
}

function getAdminLoaderContext(queryClient: QueryClient) {
  const user = useAuthStore.getState().user

  if (!user || user.role !== 'ADMIN') {
    throw new Error('Admin data loading requires an authenticated Admin')
  }

  return { adminId: user.id, queryClient }
}

export async function loadAdminUsersRoute({ context }: AdminLoaderArgs) {
  const { adminId, queryClient } = getAdminLoaderContext(context.queryClient)
  await queryClient.ensureInfiniteQueryData(
    managedUsersInfiniteQueryOptions(adminId),
  )
}

export async function loadAdminCoursesRoute({ context }: AdminLoaderArgs) {
  const { adminId, queryClient } = getAdminLoaderContext(context.queryClient)
  await queryClient.ensureQueryData(courseAdministrationQueryOptions(adminId))
}

export async function loadAdminAssignmentsRoute({ context }: AdminLoaderArgs) {
  const { adminId, queryClient } = getAdminLoaderContext(context.queryClient)
  const [courses] = await Promise.all([
    queryClient.ensureQueryData(courseAdministrationQueryOptions(adminId)),
    queryClient.ensureInfiniteQueryData(
      managedUsersInfiniteQueryOptions(adminId),
    ),
  ])
  const firstCourse = courses.at(0)

  if (firstCourse) {
    await queryClient.ensureQueryData(
      courseMembersQueryOptions(adminId, firstCourse.id),
    )
  }
}

export async function loadAdminMaterialsRoute({ context }: AdminLoaderArgs) {
  const { adminId, queryClient } = getAdminLoaderContext(context.queryClient)
  const courses = await queryClient.ensureQueryData(
    courseAdministrationQueryOptions(adminId),
  )
  const firstCourse = courses.at(0)

  if (firstCourse) {
    await queryClient.ensureQueryData(
      materialAdministrationQueryOptions(adminId, firstCourse.id),
    )
  }
}

export async function loadAdminAuditRoute({ context }: AdminLoaderArgs) {
  const { adminId, queryClient } = getAdminLoaderContext(context.queryClient)
  await queryClient.ensureQueryData(auditQueryOptions(adminId, 20))
}

export async function loadAdminDashboardRoute({ context }: AdminLoaderArgs) {
  const { adminId, queryClient } = getAdminLoaderContext(context.queryClient)

  await Promise.all([
    queryClient.ensureInfiniteQueryData(
      managedUsersInfiniteQueryOptions(adminId),
    ),
    queryClient.ensureQueryData(courseAdministrationQueryOptions(adminId)),
    queryClient.ensureQueryData(auditQueryOptions(adminId, 5)),
  ])
}
