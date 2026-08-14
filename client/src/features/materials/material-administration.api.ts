import {
  apiFetch,
  apiJson,
} from '@/features/auth/session/interface/authenticated-api-client'
import type { ApiFetchOptions } from '@/features/auth/session/interface/authenticated-api-client'
import {
  materialAdministrationListResponseSchema,
  materialAdministrationResponseSchema,
} from './material-administration.schema'

export async function getMaterialAdministration(
  courseId: string,
  options: ApiFetchOptions = {},
  input: { cursor?: string; search?: string } = {},
) {
  const parameters = new URLSearchParams({ limit: '25' })
  if (input.cursor) parameters.set('cursor', input.cursor)
  if (input.search) parameters.set('search', input.search)
  const response = await apiJson<unknown>(
    `/api/v1/admin/courses/${courseId}/materials?${parameters}`,
    { ...options, method: 'GET' },
  )
  return materialAdministrationListResponseSchema.parse(response)
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

export async function deleteMaterialAdministration(
  courseId: string,
  materialId: string,
  options: ApiFetchOptions = {},
) {
  await apiFetch(`/api/v1/courses/${courseId}/materials/${materialId}`, {
    ...options,
    method: 'DELETE',
  })
}
