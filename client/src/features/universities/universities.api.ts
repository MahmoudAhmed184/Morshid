import { apiJson } from '@/features/auth/session/interface/authenticated-api-client'
import type { ApiFetchOptions } from '@/features/auth/session/interface/authenticated-api-client'
import {
  universityListResponseSchema,
  universityResponseSchema,
} from './universities.schema'
import type {
  CreateUniversityFormValues,
  SortOrder,
  UniversityItem,
  UniversityListResponse,
  UniversitySortField,
  UniversityStatus,
  UpdateUniversityFormValues,
} from './universities.schema'

export type {
  CreateUniversityFormValues,
  SortOrder,
  UniversityItem,
  UniversityListResponse,
  UniversitySortField,
  UniversityStatus,
  UpdateUniversityFormValues,
}

export type ListUniversitiesInput = {
  page?: number
  limit?: number
  search?: string
  status?: UniversityStatus
  sortBy?: UniversitySortField
  sortOrder?: SortOrder
}

export type CreateUniversityInput = CreateUniversityFormValues

export type UpdateUniversityInput = UpdateUniversityFormValues

function createListUniversitiesPath({
  page = 1,
  limit = 20,
  search,
  status,
  sortBy = 'createdAt',
  sortOrder = 'desc',
}: ListUniversitiesInput = {}) {
  const searchParams = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    sortBy,
    sortOrder,
  })

  if (search) {
    searchParams.set('search', search)
  }

  if (status) {
    searchParams.set('status', status)
  }

  return `/api/v1/universities?${searchParams.toString()}`
}

export async function listUniversities(
  input: ListUniversitiesInput = {},
  options: ApiFetchOptions = {},
): Promise<UniversityListResponse> {
  const response = await apiJson<unknown>(createListUniversitiesPath(input), {
    ...options,
    method: 'GET',
  })

  return universityListResponseSchema.parse(response)
}

export async function getUniversity(
  universityId: string,
  options: ApiFetchOptions = {},
): Promise<UniversityItem> {
  const response = await apiJson<unknown>(
    `/api/v1/universities/${universityId}`,
    {
      ...options,
      method: 'GET',
    },
  )

  return universityResponseSchema.parse(response).university
}

export async function createUniversity(
  input: CreateUniversityInput,
  options: ApiFetchOptions = {},
): Promise<UniversityItem> {
  const payload = {
    name: input.name,
    code: input.code,
    status: input.status,
    owner: {
      displayName: input.ownerDisplayName,
      email: input.ownerEmail,
      password: input.ownerPassword,
    },
  }

  const response = await apiJson<unknown>('/api/v1/universities', {
    ...options,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: JSON.stringify(payload),
  })

  return universityResponseSchema.parse(response).university
}

export async function updateUniversity(
  universityId: string,
  input: UpdateUniversityInput,
  options: ApiFetchOptions = {},
): Promise<UniversityItem> {
  const payload: Record<string, unknown> = {}

  if (input.name !== undefined) {
    payload.name = input.name
  }
  if (input.code !== undefined) {
    payload.code = input.code
  }

  const owner: Record<string, string> = {}
  if (input.ownerDisplayName !== undefined) {
    owner.displayName = input.ownerDisplayName
  }
  if (input.ownerEmail !== undefined) {
    owner.email = input.ownerEmail
  }
  if (input.ownerPassword !== undefined && input.ownerPassword !== '') {
    owner.password = input.ownerPassword
  }
  if (Object.keys(owner).length > 0) {
    payload.owner = owner
  }

  const response = await apiJson<unknown>(
    `/api/v1/universities/${universityId}`,
    {
      ...options,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: JSON.stringify(payload),
    },
  )

  return universityResponseSchema.parse(response).university
}

export async function updateUniversityStatus(
  universityId: string,
  status: UniversityStatus,
  options: ApiFetchOptions = {},
): Promise<UniversityItem> {
  const response = await apiJson<unknown>(
    `/api/v1/universities/${universityId}/status`,
    {
      ...options,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: JSON.stringify({ status }),
    },
  )

  return universityResponseSchema.parse(response).university
}
