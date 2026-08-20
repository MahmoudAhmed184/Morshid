import {
  apiFetch,
  apiJson,
} from '@/features/auth/session/interface/authenticated-api-client'
import type { ApiFetchOptions } from '@/features/auth/session/interface/authenticated-api-client'
import {
  studentAllowanceSchema,
  allowancePoliciesResponseSchema,
  deploymentDefaultsSchema,
  coursePolicyOverrideSchema,
  allowanceResetRecordSchema,
} from './allowances.schema'
import type {
  StudentAllowance,
  AllowancePoliciesResponse,
  DeploymentDefaults,
  CoursePolicyOverride,
  AllowanceResetRecord,
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

export async function getAdminAllowancePolicies(
  options: ApiFetchOptions = {},
): Promise<AllowancePoliciesResponse> {
  const response = await apiJson<unknown>('/api/v1/admin/allowances/policies', {
    ...options,
    method: 'GET',
  })
  return allowancePoliciesResponseSchema.parse(response)
}

export async function updateAdminDeploymentDefaults(
  input: { tutoringLimit?: number; reviewLimit?: number },
  options: ApiFetchOptions = {},
): Promise<DeploymentDefaults> {
  const response = await apiJson<unknown>(
    '/api/v1/admin/allowances/policies/defaults',
    jsonRequestOptions('PATCH', input, options),
  )
  return deploymentDefaultsSchema.parse(response)
}

export async function setAdminCourseOverride(
  courseId: string,
  input: { tutoringLimit?: number | null; reviewLimit?: number | null },
  options: ApiFetchOptions = {},
): Promise<CoursePolicyOverride> {
  const response = await apiJson<unknown>(
    `/api/v1/admin/allowances/policies/courses/${encodeURIComponent(courseId)}`,
    jsonRequestOptions('PUT', input, options),
  )
  return coursePolicyOverrideSchema.parse(response)
}

export async function deleteAdminCourseOverride(
  courseId: string,
  options: ApiFetchOptions = {},
): Promise<void> {
  await apiFetch(
    `/api/v1/admin/allowances/policies/courses/${encodeURIComponent(courseId)}`,
    { ...options, method: 'DELETE' },
  )
}

export async function adminResetAllowance(
  input: {
    studentId?: string
    studentEmail?: string
    courseId: string
    scope: 'TUTORING' | 'REVIEW' | 'BOTH'
    reason: string
  },
  options: ApiFetchOptions = {},
): Promise<AllowanceResetRecord> {
  const response = await apiJson<unknown>(
    '/api/v1/admin/allowances/resets',
    jsonRequestOptions('POST', input, options),
  )
  return allowanceResetRecordSchema.parse(response)
}
