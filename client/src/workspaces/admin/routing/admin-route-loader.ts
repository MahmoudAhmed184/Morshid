import { auditQueryOptions } from '@/features/audit/audit.queries'
import {
  courseMembersQueryOptions,
  courseAdministrationQueryOptions,
} from '@/features/courses/course-administration.queries'
import { materialAdministrationQueryOptions } from '@/features/materials/material-administration.queries'
import { managedUsersInfiniteQueryOptions } from '@/features/user-management/user-management.queries'
import { useAuthStore } from '@/features/auth/session/session.store'
import { getAppQueryClient } from '@/lib/query/query-client'

function getAdminLoaderContext() {
  const user = useAuthStore.getState().user

  if (!user || user.role !== 'ADMIN') {
    throw new Error('Admin data loading requires an authenticated Admin')
  }

  return { adminId: user.id, queryClient: getAppQueryClient() }
}

export async function loadAdminUsersRoute() {
  const { adminId, queryClient } = getAdminLoaderContext()
  await queryClient.ensureInfiniteQueryData(
    managedUsersInfiniteQueryOptions(adminId),
  )
}

export async function loadAdminCoursesRoute() {
  const { adminId, queryClient } = getAdminLoaderContext()
  await queryClient.ensureQueryData(courseAdministrationQueryOptions(adminId))
}

export async function loadAdminAssignmentsRoute() {
  const { adminId, queryClient } = getAdminLoaderContext()
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

export async function loadAdminMaterialsRoute() {
  const { adminId, queryClient } = getAdminLoaderContext()
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

export async function loadAdminAuditRoute() {
  const { adminId, queryClient } = getAdminLoaderContext()
  await queryClient.ensureQueryData(auditQueryOptions(adminId, 20))
}

export async function loadAdminDashboardRoute() {
  const { adminId, queryClient } = getAdminLoaderContext()

  await Promise.all([
    queryClient.ensureInfiniteQueryData(
      managedUsersInfiniteQueryOptions(adminId),
    ),
    queryClient.ensureQueryData(courseAdministrationQueryOptions(adminId)),
    queryClient.ensureQueryData(auditQueryOptions(adminId, 5)),
  ])
}
