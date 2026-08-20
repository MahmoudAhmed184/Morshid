import { apiJson } from '@/features/auth/session/interface/authenticated-api-client'
import type { ApiFetchOptions } from '@/features/auth/session/interface/authenticated-api-client'
import { auditEventListResponseSchema } from './audit.schema'
import type { AuditEventListResponse } from './audit.schema'

export interface GetAuditEventsParams {
  page?: number
  limit?: number
  search?: string
  action?: string
  targetType?: string
  courseId?: string
  actorUserId?: string
  startDate?: string
  endDate?: string
}

export async function getAuditEvents(
  params: GetAuditEventsParams | number = 20,
  options: ApiFetchOptions = {},
): Promise<AuditEventListResponse> {
  const searchParams = new URLSearchParams()

  if (typeof params === 'number') {
    searchParams.set('limit', String(params))
  } else {
    if (params.page !== undefined) {
      searchParams.set('page', String(params.page))
    }
    if (params.limit !== undefined) {
      searchParams.set('limit', String(params.limit))
    }
    if (params.search !== undefined && params.search.trim().length > 0) {
      searchParams.set('search', params.search.trim())
    }
    if (params.action !== undefined && params.action.length > 0) {
      searchParams.set('action', params.action)
    }
    if (params.targetType !== undefined && params.targetType.length > 0) {
      searchParams.set('targetType', params.targetType)
    }
    if (params.courseId !== undefined && params.courseId.length > 0) {
      searchParams.set('courseId', params.courseId)
    }
    if (params.actorUserId !== undefined && params.actorUserId.length > 0) {
      searchParams.set('actorUserId', params.actorUserId)
    }
    if (params.startDate !== undefined && params.startDate.length > 0) {
      searchParams.set('startDate', params.startDate)
    }
    if (params.endDate !== undefined && params.endDate.length > 0) {
      searchParams.set('endDate', params.endDate)
    }
  }

  const queryString = searchParams.toString()
  const response = await apiJson<unknown>(
    `/api/v1/admin/audit${queryString.length > 0 ? `?${queryString}` : ''}`,
    {
      ...options,
      method: 'GET',
    },
  )
  return auditEventListResponseSchema.parse(response)
}
