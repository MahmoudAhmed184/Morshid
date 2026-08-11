import { apiJson } from '@/features/auth/session/authenticated-api-client'
import type { ApiFetchOptions } from '@/features/auth/session/authenticated-api-client'
import {
  materialAdministrationListResponseSchema,
  materialAdministrationResponseSchema,
} from './material-administration.schema'

export async function getMaterialAdministration(
  courseId: string,
  options: ApiFetchOptions = {},
) {
  const response = await apiJson<unknown>(
    `/api/v1/admin/courses/${courseId}/materials`,
    { ...options, method: 'GET' },
  )
  return materialAdministrationListResponseSchema.parse(response).materials
}

export async function updateMaterialAdministration(
  courseId: string,
  materialId: string,
  title: string,
  options: ApiFetchOptions = {},
) {
  const response = await apiJson<unknown>(
    `/api/v1/admin/courses/${courseId}/materials/${materialId}`,
    {
      ...options,
      body: JSON.stringify({ title }),
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      method: 'PATCH',
    },
  )
  return materialAdministrationResponseSchema.parse(response).material
}
