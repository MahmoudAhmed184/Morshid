import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  addCourseMember,
  createCourse as createCourseRequest,
  removeCourseMember,
  updateCourse as updateCourseRequest,
  updateCourseMemberRole,
} from '@/features/courses/course-administration.api'
import {
  courseAdministrationKeys,
  courseMembersQueryOptions,
  courseAdministrationQueryOptions,
} from '@/features/courses/course-administration.queries'
import {
  materialAdministrationKeys,
  materialAdministrationQueryOptions,
} from '@/features/materials/material-administration.queries'
import { updateMaterialAdministration } from '@/features/materials/material-administration.api'
import { auditKeys } from '@/features/audit/audit.queries'
import type { CourseMembershipRole } from '@/features/courses/course-administration.schema'
import { useAuthStore } from '@/features/auth/session/session.store'

function useAdminId() {
  return useAuthStore((state) => state.user?.id)
}

export function useCourseAdministration() {
  const adminId = useAdminId()
  return useQuery({
    ...courseAdministrationQueryOptions(adminId ?? 'anonymous'),
    enabled: adminId !== undefined,
  })
}

export function useCourseMembers(courseId: string | undefined) {
  const adminId = useAdminId()
  return useQuery({
    ...courseMembersQueryOptions(adminId ?? 'anonymous', courseId ?? 'unknown'),
    enabled: adminId !== undefined && courseId !== undefined,
  })
}

export function useMaterialAdministration(courseId: string | undefined) {
  const adminId = useAdminId()
  return useQuery({
    ...materialAdministrationQueryOptions(
      adminId ?? 'anonymous',
      courseId ?? 'unknown',
    ),
    enabled: adminId !== undefined && courseId !== undefined,
  })
}

export function useCourseAdministrationMutations(
  courseId: string | undefined = undefined,
) {
  const adminId = useAdminId()
  const queryClient = useQueryClient()
  const invalidateCourseData = async () => {
    if (!adminId) return
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: courseAdministrationKeys.all(adminId),
      }),
      courseId
        ? queryClient.invalidateQueries({
            queryKey: courseAdministrationKeys.members(adminId, courseId),
          })
        : Promise.resolve(),
      queryClient.invalidateQueries({
        queryKey: auditKeys.all(adminId),
      }),
    ])
  }

  const createCourse = useMutation({
    mutationFn: (input: { code: string; title: string }) =>
      createCourseRequest(input),
    onSuccess: invalidateCourseData,
  })

  const updateCourse = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string
      input: { code?: string; title?: string }
    }) => updateCourseRequest(id, input),
    onSuccess: invalidateCourseData,
  })

  const addMember = useMutation({
    mutationFn: (input: { userId: string; role: CourseMembershipRole }) => {
      if (!courseId) throw new Error('Choose a course first.')
      return addCourseMember(courseId, input)
    },
    onSuccess: invalidateCourseData,
  })
  const updateMemberRole = useMutation({
    mutationFn: (input: { userId: string; role: CourseMembershipRole }) => {
      if (!courseId) throw new Error('Choose a course first.')
      return updateCourseMemberRole(courseId, input.userId, input.role)
    },
    onSuccess: invalidateCourseData,
  })
  const removeMember = useMutation({
    mutationFn: (userId: string) => {
      if (!courseId) throw new Error('Choose a course first.')
      return removeCourseMember(courseId, userId)
    },
    onSuccess: invalidateCourseData,
  })
  const editMaterial = useMutation({
    mutationFn: (input: { materialId: string; title: string }) => {
      if (!courseId) throw new Error('Choose a course first.')
      return updateMaterialAdministration(
        courseId,
        input.materialId,
        input.title,
      )
    },
    onSuccess: async () => {
      if (!adminId || !courseId) return
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: materialAdministrationKeys.all(adminId, courseId),
        }),
        queryClient.invalidateQueries({
          queryKey: courseAdministrationKeys.all(adminId),
        }),
        queryClient.invalidateQueries({
          queryKey: auditKeys.all(adminId),
        }),
      ])
    },
  })

  return {
    createCourse,
    updateCourse,
    addMember,
    updateMemberRole,
    removeMember,
    editMaterial,
  }
}
