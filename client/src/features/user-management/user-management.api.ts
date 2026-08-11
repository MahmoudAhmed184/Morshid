import { apiJson } from '@/features/auth/session/interface/authenticated-api-client'
import type { ApiFetchOptions } from '@/features/auth/session/interface/authenticated-api-client'
import {
  managedUserResponseSchema,
  managedUsersPageSchema,
} from '@/features/user-management/managed-user.schema'

export type ListManagedUsersInput = {
  cursor?: string
  limit?: number
}

export type CreateManagedUserInput = {
  email: string
  displayName: string
  role: 'STUDENT' | 'INSTRUCTOR'
  password: string
}

function createManagedUsersPath({ cursor, limit = 50 }: ListManagedUsersInput) {
  const searchParams = new URLSearchParams({ limit: String(limit) })

  if (cursor) {
    searchParams.set('cursor', cursor)
  }

  return `/api/v1/admin/users?${searchParams.toString()}`
}

export async function getManagedUsers(
  input: ListManagedUsersInput = {},
  options: ApiFetchOptions = {},
) {
  const response = await apiJson<unknown>(createManagedUsersPath(input), {
    ...options,
    method: 'GET',
  })

  return managedUsersPageSchema.parse(response)
}

export async function createManagedUser(
  input: CreateManagedUserInput,
  options: ApiFetchOptions = {},
) {
  const response = await apiJson<unknown>('/api/v1/admin/users', {
    ...options,
    body: JSON.stringify(input),
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    method: 'POST',
  })

  return managedUserResponseSchema.parse(response).user
}

export async function resetManagedUserPassword(
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

  return managedUserResponseSchema.parse(response).user
}

export async function disableManagedUser(
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

  return managedUserResponseSchema.parse(response).user
}

export async function reactivateManagedUser(
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

  return managedUserResponseSchema.parse(response).user
}

export type UpdateManagedUserInput = {
  email?: string
  displayName?: string
  role?: 'STUDENT' | 'INSTRUCTOR'
}

export async function updateManagedUser(
  userId: string,
  input: UpdateManagedUserInput,
  options: ApiFetchOptions = {},
) {
  const response = await apiJson<unknown>(`/api/v1/admin/users/${userId}`, {
    ...options,
    body: JSON.stringify(input),
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    method: 'PATCH',
  })

  return managedUserResponseSchema.parse(response).user
}
