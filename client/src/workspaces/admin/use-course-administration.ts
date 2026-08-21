import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'

import {
  addCourseMember,
  bulkAddCourseMembers,
  createCourse as createCourseRequest,
  deleteCourse as deleteCourseRequest,
  removeCourseMember,
  updateCourse as updateCourseRequest,
  updateCourseMemberRole,
} from '@/features/courses/course-administration.api'
import {
  courseAdministrationKeys,
  courseMembersQueryOptions,
  courseAdministrationQueryOptions,
} from '@/features/courses/course-administration.queries'
import { auditKeys } from '@/features/audit/audit.queries'
import type { CourseMembershipRole } from '@/features/courses/course-administration.schema'
import { useAuthStore } from '@/features/auth/session/interface/session-store'

function useAdminId() {
  return useAuthStore((state) => state.user?.id)
}

export function useCourseAdministration(search = '', enabled = true) {
  const adminId = useAdminId()
  return useInfiniteQuery({
    ...courseAdministrationQueryOptions(adminId ?? 'anonymous', search),
    enabled: adminId !== undefined && enabled,
    select: (data) => data.pages.flatMap((page) => page.courses),
  })
}

export function useCourseAdministrationPages(search = '') {
  const adminId = useAdminId()
  return useInfiniteQuery({
    ...courseAdministrationQueryOptions(adminId ?? 'anonymous', search),
    enabled: adminId !== undefined,
  })
}

export function useCourseMembers(
  courseId: string | undefined,
  search = '',
  role?: CourseMembershipRole,
) {
  const adminId = useAdminId()
  return useInfiniteQuery({
    ...courseMembersQueryOptions(
      adminId ?? 'anonymous',
      courseId ?? 'unknown',
      search,
      role,
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
  const deleteCourse = useMutation({
    mutationFn: (courseIdToDelete: string) =>
      deleteCourseRequest(courseIdToDelete),
    onSuccess: invalidateCourseData,
  })

  const addMember = useMutation({
    mutationFn: (input: { userId: string; role: CourseMembershipRole }) => {
      if (!courseId) throw new Error('Choose a course first.')
      return addCourseMember(courseId, input)
    },
    onSuccess: invalidateCourseData,
  })
  const addMembers = useMutation({
    mutationFn: (input: {
      courseIds: string[]
      userIds: string[]
      role: CourseMembershipRole
    }) => bulkAddCourseMembers(input),
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

  return {
    createCourse,
    updateCourse,
    deleteCourse,
    addMember,
    addMembers,
    updateMemberRole,
    removeMember,
  }
}
