import type { QueryClient } from '@tanstack/react-query'

import { auditQueryOptions } from '@/features/audit/audit.queries'
import {
  courseMembersQueryOptions,
  courseAdministrationQueryOptions,
} from '@/features/courses/course-administration.queries'
import { managedUsersInfiniteQueryOptions } from '@/features/user-management/user-management.queries'
import { useAuthStore } from '@/features/auth/session/interface/session-store'

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

async function loadAdminUserDirectoryRoute(
  context: AdminLoaderArgs['context'],
  role: 'STUDENT' | 'INSTRUCTOR',
) {
  const { adminId, queryClient } = getAdminLoaderContext(context.queryClient)
  await Promise.all([
    queryClient.ensureInfiniteQueryData(
      managedUsersInfiniteQueryOptions(adminId, { role }),
    ),
    queryClient.ensureInfiniteQueryData(
      courseAdministrationQueryOptions(adminId),
    ),
  ])
}

export async function loadAdminStudentsRoute({ context }: AdminLoaderArgs) {
  await loadAdminUserDirectoryRoute(context, 'STUDENT')
}

export async function loadAdminInstructorsRoute({ context }: AdminLoaderArgs) {
  await loadAdminUserDirectoryRoute(context, 'INSTRUCTOR')
}

export async function loadAdminCoursesRoute({ context }: AdminLoaderArgs) {
  const { adminId, queryClient } = getAdminLoaderContext(context.queryClient)
  await queryClient.ensureInfiniteQueryData(
    courseAdministrationQueryOptions(adminId),
  )
}

export async function loadAdminAssignmentsRoute({ context }: AdminLoaderArgs) {
  const { adminId, queryClient } = getAdminLoaderContext(context.queryClient)
  const [courses] = await Promise.all([
    queryClient.ensureInfiniteQueryData(
      courseAdministrationQueryOptions(adminId),
    ),
    queryClient.ensureInfiniteQueryData(
      managedUsersInfiniteQueryOptions(adminId),
    ),
  ])
  const firstCourse = courses.pages.at(0)?.courses.at(0)

  if (firstCourse) {
    await queryClient.ensureInfiniteQueryData(
      courseMembersQueryOptions(adminId, firstCourse.id),
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
    queryClient.ensureInfiniteQueryData(
      courseAdministrationQueryOptions(adminId),
    ),
    queryClient.ensureQueryData(auditQueryOptions(adminId, 5)),
  ])
}
