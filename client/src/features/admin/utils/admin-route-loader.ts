import { adminAuditQueryOptions } from '@/features/admin/data/admin-audit.queries'
import {
  adminCourseMaterialsQueryOptions,
  adminCourseMembersQueryOptions,
  adminCoursesQueryOptions,
} from '@/features/admin/data/admin-courses.queries'
import { adminUsersInfiniteQueryOptions } from '@/features/admin/data/admin-users.queries'
import { useAuthStore } from '@/features/auth/stores/auth.store'
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
    adminUsersInfiniteQueryOptions(adminId),
  )
}

export async function loadAdminCoursesRoute() {
  const { adminId, queryClient } = getAdminLoaderContext()
  await queryClient.ensureQueryData(adminCoursesQueryOptions(adminId))
}

export async function loadAdminAssignmentsRoute() {
  const { adminId, queryClient } = getAdminLoaderContext()
  const [courses] = await Promise.all([
    queryClient.ensureQueryData(adminCoursesQueryOptions(adminId)),
    queryClient.ensureInfiniteQueryData(
      adminUsersInfiniteQueryOptions(adminId),
    ),
  ])
  const firstCourse = courses.at(0)

  if (firstCourse) {
    await queryClient.ensureQueryData(
      adminCourseMembersQueryOptions(adminId, firstCourse.id),
    )
  }
}

export async function loadAdminMaterialsRoute() {
  const { adminId, queryClient } = getAdminLoaderContext()
  const courses = await queryClient.ensureQueryData(
    adminCoursesQueryOptions(adminId),
  )
  const firstCourse = courses.at(0)

  if (firstCourse) {
    await queryClient.ensureQueryData(
      adminCourseMaterialsQueryOptions(adminId, firstCourse.id),
    )
  }
}

export async function loadAdminAuditRoute() {
  const { adminId, queryClient } = getAdminLoaderContext()
  await queryClient.ensureQueryData(adminAuditQueryOptions(adminId, 20))
}

export async function loadAdminDashboardRoute() {
  const { adminId, queryClient } = getAdminLoaderContext()

  await Promise.all([
    queryClient.ensureInfiniteQueryData(
      adminUsersInfiniteQueryOptions(adminId),
    ),
    queryClient.ensureQueryData(adminCoursesQueryOptions(adminId)),
    queryClient.ensureQueryData(adminAuditQueryOptions(adminId, 5)),
  ])
}
