import { apiJson } from '@/features/auth/api/authenticated-api-client'
import type { ApiFetchOptions } from '@/features/auth/api/authenticated-api-client'
import {
  adminManagedUserResponseSchema,
  adminManagedUsersPageSchema,
} from '@/features/admin/schemas/admin-managed-user.schema'

export type ListAdminUsersInput = {
  cursor?: string
  limit?: number
}

function createAdminUsersPath({ cursor, limit = 50 }: ListAdminUsersInput) {
  const searchParams = new URLSearchParams({ limit: String(limit) })

  if (cursor) {
    searchParams.set('cursor', cursor)
  }

  return `/api/v1/admin/users?${searchParams.toString()}`
}

export async function getAdminUsers(
  input: ListAdminUsersInput = {},
  options: ApiFetchOptions = {},
) {
  const response = await apiJson<unknown>(createAdminUsersPath(input), {
    ...options,
    method: 'GET',
  })

  return adminManagedUsersPageSchema.parse(response)
}

export async function resetAdminUserPassword(
  userId: string,
  newPassword: string,
  options: ApiFetchOptions = {},
) {
  const response = await apiJson<unknown>(
    `/api/v1/admin/users/${userId}/reset-password`,
    {
      ...options,
      body: JSON.stringify({ newPassword }),
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      method: 'PATCH',
    },
  )

  return adminManagedUserResponseSchema.parse(response).user
}

export async function disableAdminUser(
  userId: string,
  options: ApiFetchOptions = {},
) {
  const response = await apiJson<unknown>(
    `/api/v1/admin/users/${userId}/disable`,
    {
      ...options,
      method: 'PATCH',
    },
  )

  return adminManagedUserResponseSchema.parse(response).user
}

export async function reactivateAdminUser(
  userId: string,
  options: ApiFetchOptions = {},
) {
  const response = await apiJson<unknown>(
    `/api/v1/admin/users/${userId}/reactivate`,
    {
      ...options,
      method: 'PATCH',
    },
  )

  return adminManagedUserResponseSchema.parse(response).user
}
