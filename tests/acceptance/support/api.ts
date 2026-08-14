import { expect } from '@playwright/test'
import type { APIRequestContext } from '@playwright/test'

import { demoPassword } from './demo-auth'
import type { DemoAccount } from './demo-auth'

export const apiBaseUrl = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? '4000'}`

export interface AuthSessionResponse {
  accessToken: string
}

export interface ApiErrorResponse {
  code: string
  message: string
}

export interface CourseListResponse {
  courses: {
    code: string
    membershipRole: 'INSTRUCTOR' | 'STUDENT' | null
  }[]
}

export interface AdminManagedUsersResponse {
  users: {
    id: string
    email: string
    status: 'ACTIVE' | 'DISABLED'
  }[]
}

export interface AdminAuditEventsResponse {
  events: {
    action: string
    id: string
    targetId: string | null
  }[]
}

export interface OpenApiDocument {
  openapi: string
  info: {
    description: string
    title: string
    version: string
  }
  paths: Record<string, unknown>
}

export async function signInThroughApi(
  request: APIRequestContext,
  account: DemoAccount,
) {
  const response = await request.post(`${apiBaseUrl}/api/v1/auth/sign-in`, {
    data: {
      email: account.email,
      password: demoPassword,
    },
  })

  await expect(response).toBeOK()
  const session = (await response.json()) as AuthSessionResponse
  expect(session.accessToken).not.toBe('')
  return session.accessToken
}

export function bearerHeaders(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` }
}

export async function reactivateAdminUser(
  request: APIRequestContext,
  adminAccessToken: string,
  userId: string,
) {
  const response = await request.patch(
    `${apiBaseUrl}/api/v1/admin/users/${userId}/reactivate`,
    { headers: bearerHeaders(adminAccessToken) },
  )
  await expect(response).toBeOK()
}

export async function getAdminAuditEvents(
  request: APIRequestContext,
  adminAccessToken: string,
) {
  const response = await request.get(
    `${apiBaseUrl}/api/v1/admin/audit?limit=100`,
    { headers: bearerHeaders(adminAccessToken) },
  )
  await expect(response).toBeOK()
  const body = (await response.json()) as AdminAuditEventsResponse
  return body.events
}
