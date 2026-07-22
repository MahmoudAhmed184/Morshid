import { apiJson } from '@/features/auth/api/authenticated-api-client'
import type { ApiFetchOptions } from '@/features/auth/api/authenticated-api-client'
import {
  instructorMaterialResponseSchema,
  instructorMaterialsResponseSchema,
  instructorMaterialUploadConfigurationSchema,
} from '@/features/instructor/schemas/instructor-material.schema'
import type {
  InstructorMaterialResponse,
  InstructorMaterialsResponse,
  InstructorMaterialUpload,
  InstructorMaterialUploadConfiguration,
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

export async function getInstructorMaterialUploadConfiguration(
  options: ApiFetchOptions = {},
): Promise<InstructorMaterialUploadConfiguration> {
  const response = await apiJson<unknown>(
    '/api/v1/materials/upload-configuration',
    { ...options, method: 'GET' },
  )

  return instructorMaterialUploadConfigurationSchema.parse(response)
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
