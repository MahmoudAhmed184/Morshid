import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  addAdminCourseMember,
  removeAdminCourseMember,
  updateAdminCourseMemberRole,
  updateAdminMaterial,
} from '@/features/admin/data/admin-courses.api'
import {
  adminCourseKeys,
  adminCourseMaterialsQueryOptions,
  adminCourseMembersQueryOptions,
  adminCoursesQueryOptions,
} from '@/features/admin/data/admin-courses.queries'
import type { CourseMembershipRole } from '@/features/admin/schemas/admin-course.schema'
import { useAuthStore } from '@/features/auth/stores/auth.store'

function useAdminId() {
  return useAuthStore((state) => state.user?.id)
}

export function useAdminCourses() {
  const adminId = useAdminId()
  return useQuery({
    ...adminCoursesQueryOptions(adminId ?? 'anonymous'),
    enabled: adminId !== undefined,
  })
}

export function useAdminCourseMembers(courseId: string | undefined) {
  const adminId = useAdminId()
  return useQuery({
    ...adminCourseMembersQueryOptions(
      adminId ?? 'anonymous',
      courseId ?? 'unknown',
    ),
    enabled: adminId !== undefined && courseId !== undefined,
  })
}

export function useAdminCourseMaterials(courseId: string | undefined) {
  const adminId = useAdminId()
  return useQuery({
    ...adminCourseMaterialsQueryOptions(
      adminId ?? 'anonymous',
      courseId ?? 'unknown',
    ),
    enabled: adminId !== undefined && courseId !== undefined,
  })
}

export function useAdminCourseMutations(courseId: string | undefined) {
  const adminId = useAdminId()
  const queryClient = useQueryClient()
  const invalidateCourseData = async () => {
    if (!adminId || !courseId) return
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: adminCourseKeys.all(adminId) }),
      queryClient.invalidateQueries({
        queryKey: adminCourseKeys.members(adminId, courseId),
      }),
    ])
  }

  const addMember = useMutation({
    mutationFn: (input: { userId: string; role: CourseMembershipRole }) => {
      if (!courseId) throw new Error('Choose a course first.')
      return addAdminCourseMember(courseId, input)
    },
    onSuccess: invalidateCourseData,
  })
  const updateMemberRole = useMutation({
    mutationFn: (input: { userId: string; role: CourseMembershipRole }) => {
      if (!courseId) throw new Error('Choose a course first.')
      return updateAdminCourseMemberRole(courseId, input.userId, input.role)
    },
    onSuccess: invalidateCourseData,
  })
  const removeMember = useMutation({
    mutationFn: (userId: string) => {
      if (!courseId) throw new Error('Choose a course first.')
      return removeAdminCourseMember(courseId, userId)
    },
    onSuccess: invalidateCourseData,
  })
  const editMaterial = useMutation({
    mutationFn: (input: { materialId: string; title: string }) => {
      if (!courseId) throw new Error('Choose a course first.')
      return updateAdminMaterial(courseId, input.materialId, input.title)
    },
    onSuccess: async () => {
      if (!adminId || !courseId) return
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: adminCourseKeys.materials(adminId, courseId),
        }),
        queryClient.invalidateQueries({
          queryKey: adminCourseKeys.all(adminId),
        }),
      ])
    },
  })

  return { addMember, updateMemberRole, removeMember, editMaterial }
}
