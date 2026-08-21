import { z } from 'zod'

import {
  apiFetch,
  apiJson,
} from '@/features/auth/session/interface/authenticated-api-client'
import type { ApiFetchOptions } from '@/features/auth/session/interface/authenticated-api-client'
import {
  courseAdministrationListResponseSchema,
  bulkCourseAssignmentResponseSchema,
  courseAdministrationSchema,
  courseMemberResponseSchema,
  courseMembersResponseSchema,
  resolveCourseMembersResponseSchema,
} from './course-administration.schema'
import type { CourseMembershipRole } from './course-administration.schema'

const courseResponseSchema = z.object({ course: courseAdministrationSchema })

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

export async function getCourseAdministration(
  options: ApiFetchOptions = {},
  input: { cursor?: string; search?: string } = {},
) {
  const parameters = new URLSearchParams({ limit: '10' })
  if (input.cursor) parameters.set('cursor', input.cursor)
  if (input.search) parameters.set('search', input.search)
  const response = await apiJson<unknown>(
    `/api/v1/admin/courses?${parameters}`,
    {
      ...options,
      method: 'GET',
    },
  )
  return courseAdministrationListResponseSchema.parse(response)
}

export async function createCourse(
  input: { code: string; title: string },
  options: ApiFetchOptions = {},
) {
  const response = await apiJson<unknown>(
    '/api/v1/admin/courses',
    jsonRequestOptions('POST', input, options),
  )
  return courseResponseSchema.parse(response).course
}

export async function updateCourse(
  courseId: string,
  input: { code?: string; title?: string },
  options: ApiFetchOptions = {},
) {
  const response = await apiJson<unknown>(
    `/api/v1/admin/courses/${courseId}`,
    jsonRequestOptions('PATCH', input, options),
  )
  return courseResponseSchema.parse(response).course
}

export async function deleteCourse(
  courseId: string,
  options: ApiFetchOptions = {},
) {
  await apiFetch(`/api/v1/admin/courses/${courseId}`, {
    ...options,
    method: 'DELETE',
  })
}

export async function getCourseMembers(
  courseId: string,
  options: ApiFetchOptions = {},
  input: {
    cursor?: string
    search?: string
    role?: CourseMembershipRole
  } = {},
) {
  const parameters = new URLSearchParams({ limit: '10' })
  if (input.cursor) parameters.set('cursor', input.cursor)
  if (input.search) parameters.set('search', input.search)
  if (input.role) parameters.set('role', input.role)
  const response = await apiJson<unknown>(
    `/api/v1/admin/courses/${courseId}/members?${parameters}`,
    { ...options, method: 'GET' },
  )
  return courseMembersResponseSchema.parse(response)
}

export async function addCourseMember(
  courseId: string,
  input: { userId: string; role: CourseMembershipRole },
  options: ApiFetchOptions = {},
) {
  const response = await apiJson<unknown>(
    `/api/v1/admin/courses/${courseId}/members`,
    jsonRequestOptions('POST', input, options),
  )
  return courseMemberResponseSchema.parse(response).member
}

export async function bulkAddCourseMembers(
  input: {
    courseIds: string[]
    userIds: string[]
    role: CourseMembershipRole
  },
  options: ApiFetchOptions = {},
) {
  const response = await apiJson<unknown>(
    '/api/v1/admin/courses/members/bulk',
    jsonRequestOptions('POST', input, options),
  )
  return bulkCourseAssignmentResponseSchema.parse(response)
}

export async function resolveCourseMembers(
  input: {
    identifiers: string[]
    role: CourseMembershipRole
    courseIds?: string[]
  },
  options: ApiFetchOptions = {},
) {
  const response = await apiJson<unknown>(
    '/api/v1/admin/courses/members/resolve',
    jsonRequestOptions('POST', input, options),
  )
  return resolveCourseMembersResponseSchema.parse(response)
}

export async function updateCourseMemberRole(
  courseId: string,
  userId: string,
  role: CourseMembershipRole,
  options: ApiFetchOptions = {},
) {
  const response = await apiJson<unknown>(
    `/api/v1/admin/courses/${courseId}/members/${userId}`,
    jsonRequestOptions('PATCH', { role }, options),
  )
  return courseMemberResponseSchema.parse(response).member
}

export async function removeCourseMember(
  courseId: string,
  userId: string,
  options: ApiFetchOptions = {},
) {
  await apiFetch(`/api/v1/admin/courses/${courseId}/members/${userId}`, {
    ...options,
    method: 'DELETE',
  })
}
