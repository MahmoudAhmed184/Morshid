import {
  apiFetch,
  apiJson,
} from '@/features/auth/session/interface/authenticated-api-client'
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
  input: { cursor?: string; search?: string } = {},
): Promise<MaterialsResponse> {
  const parameters = new URLSearchParams({ limit: '15' })
  if (input.cursor) parameters.set('cursor', input.cursor)
  if (input.search) parameters.set('search', input.search)
  const response = await apiJson<unknown>(
    `/api/v1/courses/${courseId}/materials?${parameters}`,
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

export async function deleteCourseMaterial(
  courseId: string,
  materialId: string,
  options: ApiFetchOptions = {},
): Promise<void> {
  await apiFetch(`/api/v1/courses/${courseId}/materials/${materialId}`, {
    ...options,
    method: 'DELETE',
  })
}
