import { apiJson } from '@/features/auth/api/authenticated-api-client'
import type { ApiFetchOptions } from '@/features/auth/api/authenticated-api-client'
import {
  instructorMaterialResponseSchema,
  instructorMaterialsResponseSchema,
  instructorMaterialStatusSchema,
} from '@/features/instructor/schemas/instructor-material.schema'
import type {
  InstructorMaterialResponse,
  InstructorMaterialsResponse,
  InstructorMaterialStatus,
  InstructorMaterialUpload,
} from '@/features/instructor/schemas/instructor-material.schema'

export async function listInstructorMaterials(
  courseId: string,
  options: ApiFetchOptions = {},
): Promise<InstructorMaterialsResponse> {
  const response = await apiJson<unknown>(
    `/api/v1/courses/${courseId}/materials`,
    { ...options, method: 'GET' },
  )

  return instructorMaterialsResponseSchema.parse(response)
}

export async function getInstructorMaterial(
  courseId: string,
  materialId: string,
  options: ApiFetchOptions = {},
): Promise<InstructorMaterialResponse> {
  const response = await apiJson<unknown>(
    `/api/v1/courses/${courseId}/materials/${materialId}`,
    { ...options, method: 'GET' },
  )

  return instructorMaterialResponseSchema.parse(response)
}

export async function getInstructorMaterialStatus(
  courseId: string,
  materialId: string,
  options: ApiFetchOptions = {},
): Promise<InstructorMaterialStatus> {
  const response = await apiJson<unknown>(
    `/api/v1/courses/${courseId}/materials/${materialId}/status`,
    { ...options, method: 'GET' },
  )

  return instructorMaterialStatusSchema.parse(response)
}

export async function uploadInstructorMaterial(
  courseId: string,
  input: InstructorMaterialUpload,
  options: ApiFetchOptions = {},
): Promise<InstructorMaterialResponse> {
  const formData = new FormData()
  formData.append('title', input.title)
  formData.append('file', input.file)

  const response = await apiJson<unknown>(
    `/api/v1/courses/${courseId}/materials`,
    {
      ...options,
      body: formData,
      method: 'POST',
    },
  )

  return instructorMaterialResponseSchema.parse(response)
}
