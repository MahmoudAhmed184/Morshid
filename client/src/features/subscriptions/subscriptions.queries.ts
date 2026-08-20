import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import {
  cancelMySubscription,
  getGlobalPricing,
  getMySubscription,
  getUniversitySubscription,
  listSubscriptions,
  listUniversityInvoices,
  resumeMySubscription,
  updateGlobalPricing,
  updateUniversitySubscription,
} from './subscriptions.api'
import type {
  ListSubscriptionsInput,
  UpdateUniversitySubscriptionInput,
} from './subscriptions.api'
import type { UpdateGlobalPricingFormValues } from './subscriptions.schema'

export const subscriptionsQueryKeys = {
  all: ['subscriptions'] as const,
  globalPricing: () =>
    [...subscriptionsQueryKeys.all, 'global-pricing'] as const,
  list: (input: ListSubscriptionsInput = {}) =>
    [...subscriptionsQueryKeys.all, 'list', input] as const,
  detail: (universityId: string) =>
    [...subscriptionsQueryKeys.all, 'detail', universityId] as const,
  invoices: (universityId: string) =>
    [...subscriptionsQueryKeys.all, 'invoices', universityId] as const,
  mySubscription: () =>
    [...subscriptionsQueryKeys.all, 'my-subscription'] as const,
}

export function globalPricingQueryOptions() {
  return queryOptions({
    queryKey: subscriptionsQueryKeys.globalPricing(),
    queryFn: () => getGlobalPricing(),
    staleTime: 60 * 1000,
  })
}

export function subscriptionsListQueryOptions(
  input: ListSubscriptionsInput = {},
) {
  return queryOptions({
    queryKey: subscriptionsQueryKeys.list(input),
    queryFn: () => listSubscriptions(input),
    staleTime: 30 * 1000,
  })
}

export function universitySubscriptionQueryOptions(universityId: string) {
  return queryOptions({
    queryKey: subscriptionsQueryKeys.detail(universityId),
    queryFn: () => getUniversitySubscription(universityId),
    staleTime: 30 * 1000,
  })
}

export function mySubscriptionQueryOptions() {
  return queryOptions({
    queryKey: subscriptionsQueryKeys.mySubscription(),
    queryFn: () => getMySubscription(),
    staleTime: 30 * 1000,
  })
}

export function useGlobalPricing() {
  return useQuery(globalPricingQueryOptions())
}

export function useUniversitySubscription(universityId?: string | null) {
  return useQuery({
    ...universitySubscriptionQueryOptions(universityId ?? ''),
    enabled: Boolean(universityId),
  })
}

export function useUniversityInvoices(universityId?: string | null) {
  return useQuery({
    queryKey: subscriptionsQueryKeys.invoices(universityId ?? ''),
    queryFn: () => listUniversityInvoices(universityId ?? ''),
    enabled: Boolean(universityId),
    staleTime: 30 * 1000,
  })
}

export function useUpdateGlobalPricingMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpdateGlobalPricingFormValues) =>
      updateGlobalPricing(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: subscriptionsQueryKeys.all,
      })
    },
  })
}

export function useSubscriptions(input: ListSubscriptionsInput = {}) {
  return useQuery(subscriptionsListQueryOptions(input))
}

export function useUpdateUniversitySubscriptionMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      universityId,
      input,
    }: {
      universityId: string
      input: UpdateUniversitySubscriptionInput
    }) => updateUniversitySubscription(universityId, input),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: subscriptionsQueryKeys.all,
      })
      void queryClient.invalidateQueries({
        queryKey: subscriptionsQueryKeys.detail(variables.universityId),
      })
    },
  })
}

export function useMySubscription() {
  return useQuery(mySubscriptionQueryOptions())
}

export function useCancelMySubscriptionMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => cancelMySubscription(),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: subscriptionsQueryKeys.mySubscription(),
      })
    },
  })
}

export function useResumeMySubscriptionMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => resumeMySubscription(),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: subscriptionsQueryKeys.mySubscription(),
      })
    },
  })
}
