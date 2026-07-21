import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { uploadInstructorMaterial } from '@/features/instructor/data/instructor-materials.api'
import {
  instructorMaterialKeys,
  instructorMaterialsQueryOptions,
  instructorMaterialStatusQueryOptions,
} from '@/features/instructor/data/instructor-materials.queries'
import { useAuthStore } from '@/features/auth/stores/auth.store'

interface UploadInstructorMaterialVariables {
  courseId: string
  title: string
  file: File
}

function useInstructorId() {
  return useAuthStore((state) => state.user?.id)
}

export function useInstructorMaterials(courseId?: string) {
  const instructorId = useInstructorId()

  return useQuery({
    ...instructorMaterialsQueryOptions({
      instructorId: instructorId ?? 'anonymous',
      courseId: courseId ?? 'unknown',
    }),
    enabled: instructorId !== undefined && courseId !== undefined,
  })
}

export function useUploadInstructorMaterial() {
  const instructorId = useInstructorId()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      courseId,
      title,
      file,
    }: UploadInstructorMaterialVariables) => {
      if (!instructorId) {
        throw new Error('An authenticated Instructor is required.')
      }

      return uploadInstructorMaterial(courseId, { title, file })
    },
    onSuccess: async (_response, { courseId }) => {
      if (!instructorId) {
        return
      }

      await queryClient.invalidateQueries({
        queryKey: instructorMaterialKeys.list({ instructorId, courseId }),
        exact: true,
      })
    },
  })
}

export function useInstructorMaterialStatus(
  courseId?: string,
  materialId?: string,
) {
  const instructorId = useInstructorId()

  return useQuery({
    ...instructorMaterialStatusQueryOptions({
      instructorId: instructorId ?? 'anonymous',
      courseId: courseId ?? 'unknown',
      materialId: materialId ?? 'unknown',
    }),
    enabled:
      instructorId !== undefined &&
      courseId !== undefined &&
      materialId !== undefined,
  })
}
