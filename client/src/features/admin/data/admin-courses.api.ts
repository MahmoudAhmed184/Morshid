import { apiFetch, apiJson } from '@/features/auth/api/authenticated-api-client'
import type { ApiFetchOptions } from '@/features/auth/api/authenticated-api-client'
import {
  adminCourseListResponseSchema,
  adminCourseMemberResponseSchema,
  adminCourseMembersResponseSchema,
  adminCourseMaterialsResponseSchema,
  adminMaterialResponseSchema,
} from '@/features/admin/schemas/admin-course.schema'
import type { CourseMembershipRole } from '@/features/admin/schemas/admin-course.schema'

function jsonRequestOptions(
  method: 'PATCH' | 'POST',
  body: unknown,
  options: ApiFetchOptions,
): ApiFetchOptions {
  return {
    ...options,
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    method,
  }
}

export async function getAdminCourses(options: ApiFetchOptions = {}) {
  const response = await apiJson<unknown>('/api/v1/admin/courses', {
    ...options,
    method: 'GET',
  })
  return adminCourseListResponseSchema.parse(response).courses
}

export async function getAdminCourseMembers(
  courseId: string,
  options: ApiFetchOptions = {},
) {
  const response = await apiJson<unknown>(
    `/api/v1/admin/courses/${courseId}/members`,
    { ...options, method: 'GET' },
  )
  return adminCourseMembersResponseSchema.parse(response).members
}

export async function addAdminCourseMember(
  courseId: string,
  input: { userId: string; role: CourseMembershipRole },
  options: ApiFetchOptions = {},
) {
  const response = await apiJson<unknown>(
    `/api/v1/admin/courses/${courseId}/members`,
    jsonRequestOptions('POST', input, options),
  )
  return adminCourseMemberResponseSchema.parse(response).member
}

export async function updateAdminCourseMemberRole(
  courseId: string,
  userId: string,
  role: CourseMembershipRole,
  options: ApiFetchOptions = {},
) {
  const response = await apiJson<unknown>(
    `/api/v1/admin/courses/${courseId}/members/${userId}`,
    jsonRequestOptions('PATCH', { role }, options),
  )
  return adminCourseMemberResponseSchema.parse(response).member
}

export async function removeAdminCourseMember(
  courseId: string,
  userId: string,
  options: ApiFetchOptions = {},
) {
  await apiFetch(`/api/v1/admin/courses/${courseId}/members/${userId}`, {
    ...options,
    method: 'DELETE',
  })
}

export async function getAdminCourseMaterials(
  courseId: string,
  options: ApiFetchOptions = {},
) {
  const response = await apiJson<unknown>(
    `/api/v1/admin/courses/${courseId}/materials`,
    { ...options, method: 'GET' },
  )
  return adminCourseMaterialsResponseSchema.parse(response).materials
}

export async function updateAdminMaterial(
  courseId: string,
  materialId: string,
  title: string,
  options: ApiFetchOptions = {},
) {
  const response = await apiJson<unknown>(
    `/api/v1/admin/courses/${courseId}/materials/${materialId}`,
    jsonRequestOptions('PATCH', { title }, options),
  )
  return adminMaterialResponseSchema.parse(response).material
}
