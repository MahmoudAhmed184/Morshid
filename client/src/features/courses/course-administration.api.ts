import { z } from 'zod'

import {
  apiFetch,
  apiJson,
} from '@/features/auth/session/interface/authenticated-api-client'
import type { ApiFetchOptions } from '@/features/auth/session/interface/authenticated-api-client'
import {
  courseAdministrationListResponseSchema,
  courseAdministrationSchema,
  courseMemberResponseSchema,
  courseMembersResponseSchema,
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

export async function getCourseAdministration(options: ApiFetchOptions = {}) {
  const response = await apiJson<unknown>('/api/v1/admin/courses', {
    ...options,
    method: 'GET',
  })
  return courseAdministrationListResponseSchema.parse(response).courses
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

export async function getCourseMembers(
  courseId: string,
  options: ApiFetchOptions = {},
) {
  const response = await apiJson<unknown>(
    `/api/v1/admin/courses/${courseId}/members`,
    { ...options, method: 'GET' },
  )
  return courseMembersResponseSchema.parse(response).members
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
