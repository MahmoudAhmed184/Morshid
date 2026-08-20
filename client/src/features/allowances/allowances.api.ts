import {
  apiFetch,
  apiJson,
} from '@/features/auth/session/interface/authenticated-api-client'
import type { ApiFetchOptions } from '@/features/auth/session/interface/authenticated-api-client'
import {
  studentAllowanceSchema,
  adminPolicyDefaultsResponseSchema,
  adminCourseOverridesResponseSchema,
  adminCourseOverrideSchema,
  adminAllowanceResetResponseSchema,
} from './allowances.schema'
import type {
  StudentAllowance,
  AdminPolicyDefault,
  AdminCourseOverride,
  AdminAllowanceReset,
} from './allowances.schema'

function jsonRequestOptions(
  method: 'PATCH' | 'POST' | 'PUT',
  body: unknown,
  options: ApiFetchOptions = {},
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

export async function getStudentTutoringAllowance(
  courseId: string,
  options: ApiFetchOptions = {},
): Promise<StudentAllowance> {
  const response = await apiJson<unknown>(
    `/api/v1/tutoring/allowance?courseId=${encodeURIComponent(courseId)}`,
    { ...options, method: 'GET' },
  )
  return studentAllowanceSchema.parse(response)
}

export async function getStudentReviewAllowance(
  courseId: string,
  options: ApiFetchOptions = {},
): Promise<StudentAllowance> {
  const response = await apiJson<unknown>(
    `/api/v1/reviews/allowance?courseId=${encodeURIComponent(courseId)}`,
    { ...options, method: 'GET' },
  )
  return studentAllowanceSchema.parse(response)
}

export async function getAdminPolicyDefaults(
  options: ApiFetchOptions = {},
): Promise<AdminPolicyDefault[]> {
  const response = await apiJson<unknown>('/api/v1/admin/allowances/defaults', {
    ...options,
    method: 'GET',
  })
  return adminPolicyDefaultsResponseSchema.parse(response).defaults
}

export async function updateAdminPolicyDefault(
  scope: 'TUTORING' | 'REVIEW',
  defaultLimit: number,
  options: ApiFetchOptions = {},
): Promise<AdminPolicyDefault> {
  const response = await apiJson<unknown>(
    `/api/v1/admin/allowances/defaults/${scope}`,
    jsonRequestOptions('PATCH', { defaultLimit }, options),
  )
  return response as AdminPolicyDefault
}

export async function getAdminCourseOverrides(
  scope?: 'TUTORING' | 'REVIEW',
  options: ApiFetchOptions = {},
): Promise<AdminCourseOverride[]> {
  const query = scope ? `?scope=${scope}` : ''
  const response = await apiJson<unknown>(
    `/api/v1/admin/allowances/overrides${query}`,
    { ...options, method: 'GET' },
  )
  return adminCourseOverridesResponseSchema.parse(response).overrides
}

export async function setAdminCourseOverride(
  courseId: string,
  scope: 'TUTORING' | 'REVIEW',
  overrideLimit: number,
  options: ApiFetchOptions = {},
): Promise<AdminCourseOverride> {
  const response = await apiJson<unknown>(
    `/api/v1/admin/allowances/overrides/${courseId}/${scope}`,
    jsonRequestOptions('PUT', { overrideLimit }, options),
  )
  return adminCourseOverrideSchema.parse(response)
}

export async function deleteAdminCourseOverride(
  courseId: string,
  scope: 'TUTORING' | 'REVIEW',
  options: ApiFetchOptions = {},
): Promise<void> {
  await apiFetch(`/api/v1/admin/allowances/overrides/${courseId}/${scope}`, {
    ...options,
    method: 'DELETE',
  })
}

export async function adminResetAllowance(
  input: {
    studentId: string
    courseId: string
    scope: 'TUTORING' | 'REVIEW'
    reason: string
  },
  options: ApiFetchOptions = {},
): Promise<AdminAllowanceReset> {
  const response = await apiJson<unknown>(
    '/api/v1/admin/allowances/resets',
    jsonRequestOptions('POST', input, options),
  )
  return adminAllowanceResetResponseSchema.parse(response).reset
}
