import { adminAuditQueryOptions } from '@/features/admin/data/admin-audit.queries'
import {
  adminCourseMaterialsQueryOptions,
  adminCourseMembersQueryOptions,
  adminCoursesQueryOptions,
} from '@/features/admin/data/admin-courses.queries'
import { adminUsersInfiniteQueryOptions } from '@/features/admin/data/admin-users.queries'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import { getAppQueryClient } from '@/lib/query/query-client'

function getAdminId() {
  const user = useAuthStore.getState().user

  if (!user || user.role !== 'ADMIN') {
    throw new Error('Admin data loading requires an authenticated Admin')
  }

  return user.id
}

export async function loadAdminUsersRoute() {
  const adminId = getAdminId()
  await getAppQueryClient().ensureInfiniteQueryData(
    adminUsersInfiniteQueryOptions(adminId),
  )
}

export async function loadAdminCoursesRoute() {
  const adminId = getAdminId()
  await getAppQueryClient().ensureQueryData(adminCoursesQueryOptions(adminId))
}

export async function loadAdminAssignmentsRoute() {
  const adminId = getAdminId()
  const queryClient = getAppQueryClient()
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
  const adminId = getAdminId()
  const queryClient = getAppQueryClient()
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
  const adminId = getAdminId()
  await getAppQueryClient().ensureQueryData(adminAuditQueryOptions(adminId, 20))
}

export async function loadAdminDashboardRoute() {
  const adminId = getAdminId()
  const queryClient = getAppQueryClient()

  await Promise.all([
    queryClient.ensureInfiniteQueryData(
      adminUsersInfiniteQueryOptions(adminId),
    ),
    queryClient.ensureQueryData(adminCoursesQueryOptions(adminId)),
    queryClient.ensureQueryData(adminAuditQueryOptions(adminId, 5)),
  ])
}
