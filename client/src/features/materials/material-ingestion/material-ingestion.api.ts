import { apiJson } from '@/features/auth/session/interface/authenticated-api-client'
import type { ApiFetchOptions } from '@/features/auth/session/interface/authenticated-api-client'
import {
  materialResponseSchema,
  materialsResponseSchema,
  materialUploadConfigurationSchema,
} from '@/features/materials/material-ingestion/material.schema'
import type {
  MaterialResponse,
  MaterialsResponse,
  MaterialUpload,
  MaterialUploadConfiguration,
} from '@/features/materials/material-ingestion/material.schema'

export async function listCourseMaterials(
  courseId: string,
  options: ApiFetchOptions = {},
): Promise<MaterialsResponse> {
  const response = await apiJson<unknown>(
    `/api/v1/courses/${courseId}/materials`,
    { ...options, method: 'GET' },
  )

  return materialsResponseSchema.parse(response)
}

export async function getMaterialUploadConfiguration(
  options: ApiFetchOptions = {},
): Promise<MaterialUploadConfiguration> {
  const response = await apiJson<unknown>(
    '/api/v1/materials/upload-configuration',
    { ...options, method: 'GET' },
  )

  return materialUploadConfigurationSchema.parse(response)
}

export async function uploadCourseMaterial(
  courseId: string,
  input: MaterialUpload,
  options: ApiFetchOptions = {},
): Promise<MaterialResponse> {
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

  return materialResponseSchema.parse(response)
}
