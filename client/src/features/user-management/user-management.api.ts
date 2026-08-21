import { apiJson } from '@/features/auth/session/interface/authenticated-api-client'
import type { ApiFetchOptions } from '@/features/auth/session/interface/authenticated-api-client'
import {
  managedUserResponseSchema,
  bulkManagedUsersResponseSchema,
  managedUsersPageSchema,
  userImportResponseSchema,
} from '@/features/user-management/managed-user.schema'

export type ListManagedUsersInput = {
  cursor?: string
  limit?: number
  role?: 'STUDENT' | 'INSTRUCTOR'
  status?: 'ACTIVE' | 'DISABLED'
  courseId?: string
  excludeCourseIds?: string[]
  search?: string
}

export type CreateManagedUserInput = {
  email: string
  displayName: string
  role: 'STUDENT' | 'INSTRUCTOR'
  password: string
}

function createManagedUsersPath({
  cursor,
  limit = 50,
  role,
  status,
  courseId,
  excludeCourseIds,
  search,
}: ListManagedUsersInput) {
  const searchParams = new URLSearchParams({ limit: String(limit) })

  if (cursor) {
    searchParams.set('cursor', cursor)
  }

  if (role) searchParams.set('role', role)
  if (status) searchParams.set('status', status)
  if (courseId) searchParams.set('courseId', courseId)
  if (excludeCourseIds) {
    for (const courseId of excludeCourseIds) {
      searchParams.append('excludeCourseIds', courseId)
    }
  }
  if (search) searchParams.set('search', search)

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

export async function bulkCreateManagedUsers(
  users: CreateManagedUserInput[],
  options: ApiFetchOptions = {},
) {
  const response = await apiJson<unknown>('/api/v1/admin/users/bulk', {
    ...options,
    body: JSON.stringify({ users }),
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    method: 'POST',
  })

  return bulkManagedUsersResponseSchema.parse(response).users
}

export type CreateUserImportRow = {
  rowNumber: number
  displayName: string
  email: string
  password: string
  role: string
}

export async function createUserImport(rows: CreateUserImportRow[]) {
  const response = await apiJson<unknown>('/api/v1/admin/users/imports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  })
  return userImportResponseSchema.parse(response).userImport
}

export async function approveUserImport(importId: string) {
  const response = await apiJson<unknown>(
    `/api/v1/admin/users/imports/${importId}/approve`,
    { method: 'POST' },
  )
  return userImportResponseSchema.parse(response).userImport
}

export type UpdateUserImportRowInput = {
  displayName?: string
  email?: string
  password?: string
}

export async function updateUserImportRow(
  importId: string,
  rowId: string,
  input: UpdateUserImportRowInput,
) {
  const response = await apiJson<unknown>(
    `/api/v1/admin/users/imports/${importId}/rows/${rowId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  )
  return userImportResponseSchema.parse(response).userImport
}

export async function cancelUserImportRow(importId: string, rowId: string) {
  const response = await apiJson<unknown>(
    `/api/v1/admin/users/imports/${importId}/rows/${rowId}/cancel`,
    { method: 'POST' },
  )
  return userImportResponseSchema.parse(response).userImport
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
