import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  deleteCourseMaterial,
  uploadCourseMaterial,
} from '@/features/materials/material-ingestion/material-ingestion.api'
import type { Material } from '@/features/materials/material-ingestion/material.schema'
import {
  materialKeys,
  materialUploadConfigurationQueryOptions,
  materialsQueryOptions,
} from '@/features/materials/material-ingestion/material-ingestion.queries'
import { useAuthStore } from '@/features/auth/session/interface/session-store'

interface UploadMaterialVariables {
  courseId: string
  title: string
  file: File
}

function useInstructorId() {
  return useAuthStore((state) => state.user?.id)
}

export function useCourseMaterials(courseId?: string) {
  const instructorId = useInstructorId()

  return useQuery({
    ...materialsQueryOptions({
      instructorId: instructorId ?? 'anonymous',
      courseId: courseId ?? 'unknown',
    }),
    enabled: instructorId !== undefined && courseId !== undefined,
  })
}

export function useMaterialUploadConfiguration() {
  const instructorId = useInstructorId()

  return useQuery({
    ...materialUploadConfigurationQueryOptions(instructorId ?? 'anonymous'),
    enabled: instructorId !== undefined,
  })
}

export function useUploadCourseMaterial() {
  const instructorId = useInstructorId()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ courseId, title, file }: UploadMaterialVariables) => {
      if (!instructorId) {
        throw new Error('An authenticated Instructor is required.')
      }

      return uploadCourseMaterial(courseId, { title, file })
    },
    onSuccess: async (_response, { courseId }) => {
      if (!instructorId) {
        return
      }

      await queryClient.invalidateQueries({
        queryKey: materialKeys.list({ instructorId, courseId }),
        exact: true,
      })
    },
  })
}

export function useDeleteCourseMaterial() {
  const instructorId = useInstructorId()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      courseId,
      materialId,
    }: {
      courseId: string
      materialId: string
    }) => deleteCourseMaterial(courseId, materialId),
    onSuccess: async (_response, { courseId, materialId }) => {
      if (!instructorId) return
      const queryKey = materialKeys.list({ instructorId, courseId })
      queryClient.setQueryData<Material[]>(queryKey, (materials) =>
        materials?.filter((material) => material.id !== materialId),
      )
      await queryClient.invalidateQueries({ queryKey, exact: true })
    },
  })
}
