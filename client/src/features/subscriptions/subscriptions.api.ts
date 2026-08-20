import { apiJson } from '@/features/auth/session/interface/authenticated-api-client'
import type { ApiFetchOptions } from '@/features/auth/session/interface/authenticated-api-client'
import {
  globalPricingSchema,
  mySubscriptionResponseSchema,
  subscriptionListResponseSchema,
  subscriptionInvoiceListResponseSchema,
  universitySubscriptionItemSchema,
} from './subscriptions.schema'
import type {
  GlobalPricing,
  SubscriptionListResponse,
  SubscriptionInvoiceListResponse,
  SubscriptionStatus,
  UniversitySubscriptionItem,
  UpdateGlobalPricingFormValues,
} from './subscriptions.schema'

export interface ListSubscriptionsInput {
  page?: number
  limit?: number
  search?: string
  status?: SubscriptionStatus
  sortBy?:
    | 'name'
    | 'code'
    | 'studentsCount'
    | 'peakStudentsCount'
    | 'effectivePricePerSeat'
    | 'estimatedMonthlyTotal'
    | 'createdAt'
  sortOrder?: 'asc' | 'desc'
}

export interface UpdateUniversitySubscriptionInput {
  customPricePerSeat?: number | null
  cancelAtPeriodEnd?: boolean
  status?: SubscriptionStatus
}

export interface ListUniversityInvoicesInput {
  page?: number
  limit?: number
  from?: string
  to?: string
  status?: 'PAID' | 'DUE' | 'OVERDUE'
  sortBy?: 'billingPeriodStart' | 'amount' | 'peakSeats'
  sortOrder?: 'asc' | 'desc'
}

function createListSubscriptionsPath({
  page = 1,
  limit = 20,
  search,
  status,
  sortBy = 'name',
  sortOrder = 'asc',
}: ListSubscriptionsInput = {}) {
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

  return `/api/v1/subscriptions?${searchParams.toString()}`
}

export async function getGlobalPricing(
  options: ApiFetchOptions = {},
): Promise<GlobalPricing> {
  const response = await apiJson<unknown>(
    '/api/v1/subscriptions/global-pricing',
    {
      ...options,
      method: 'GET',
    },
  )

  return globalPricingSchema.parse(response)
}

export async function updateGlobalPricing(
  input: UpdateGlobalPricingFormValues,
  options: ApiFetchOptions = {},
): Promise<GlobalPricing> {
  const response = await apiJson<unknown>(
    '/api/v1/subscriptions/global-pricing',
    {
      ...options,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: JSON.stringify(input),
    },
  )

  return globalPricingSchema.parse(response)
}

export async function listSubscriptions(
  input: ListSubscriptionsInput = {},
  options: ApiFetchOptions = {},
): Promise<SubscriptionListResponse> {
  const response = await apiJson<unknown>(createListSubscriptionsPath(input), {
    ...options,
    method: 'GET',
  })

  return subscriptionListResponseSchema.parse(response)
}

export async function getUniversitySubscription(
  universityId: string,
  options: ApiFetchOptions = {},
): Promise<UniversitySubscriptionItem> {
  const response = await apiJson<unknown>(
    `/api/v1/subscriptions/universities/${universityId}`,
    {
      ...options,
      method: 'GET',
    },
  )

  return universitySubscriptionItemSchema.parse(response)
}

export async function listUniversityInvoices(
  universityId: string,
  input: ListUniversityInvoicesInput = {},
  options: ApiFetchOptions = {},
): Promise<SubscriptionInvoiceListResponse> {
  const searchParams = new URLSearchParams({
    page: String(input.page ?? 1),
    limit: String(input.limit ?? 10),
    sortBy: input.sortBy ?? 'billingPeriodStart',
    sortOrder: input.sortOrder ?? 'desc',
  })
  if (input.from) searchParams.set('from', input.from)
  if (input.to) searchParams.set('to', input.to)
  if (input.status) searchParams.set('status', input.status)

  const response = await apiJson<unknown>(
    `/api/v1/subscriptions/universities/${universityId}/invoices?${searchParams.toString()}`,
    {
      ...options,
      method: 'GET',
    },
  )

  return subscriptionInvoiceListResponseSchema.parse(response)
}

export async function updateUniversitySubscription(
  universityId: string,
  input: UpdateUniversitySubscriptionInput,
  options: ApiFetchOptions = {},
): Promise<UniversitySubscriptionItem> {
  const response = await apiJson<unknown>(
    `/api/v1/subscriptions/universities/${universityId}`,
    {
      ...options,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: JSON.stringify(input),
    },
  )

  return universitySubscriptionItemSchema.parse(response)
}

export async function getMySubscription(
  options: ApiFetchOptions = {},
): Promise<UniversitySubscriptionItem> {
  const response = await apiJson<unknown>(
    '/api/v1/subscriptions/my-subscription',
    {
      ...options,
      method: 'GET',
    },
  )

  return mySubscriptionResponseSchema.parse(response).subscription
}

export async function cancelMySubscription(
  options: ApiFetchOptions = {},
): Promise<UniversitySubscriptionItem> {
  const response = await apiJson<unknown>(
    '/api/v1/subscriptions/my-subscription/cancel',
    {
      ...options,
      method: 'POST',
    },
  )

  return mySubscriptionResponseSchema.parse(response).subscription
}

export async function resumeMySubscription(
  options: ApiFetchOptions = {},
): Promise<UniversitySubscriptionItem> {
  const response = await apiJson<unknown>(
    '/api/v1/subscriptions/my-subscription/resume',
    {
      ...options,
      method: 'POST',
    },
  )

  return mySubscriptionResponseSchema.parse(response).subscription
}
