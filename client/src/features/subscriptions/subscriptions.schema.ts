import { z } from 'zod'

export const subscriptionStatusSchema = z.enum([
  'ACTIVE',
  'PENDING_CANCELLATION',
  'CANCELLED',
])

export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>

export const globalPricingSchema = z.object({
  defaultPricePerSeat: z.number(),
  nextPricePerSeat: z.number().nullable().optional(),
  nextPriceEffectiveAt: z.string().nullable().optional(),
  currency: z.string(),
  updatedAt: z.string(),
})

export type GlobalPricing = z.infer<typeof globalPricingSchema>

export const updateGlobalPricingFormSchema = z.object({
  defaultPricePerSeat: z
    .number()
    .min(0, 'Price must be 0 or more')
    .max(100000, 'Price exceeds maximum allowed limit'),
  currency: z.string().trim().optional().default('USD'),
})

export type UpdateGlobalPricingFormValues = z.input<
  typeof updateGlobalPricingFormSchema
>

export const updateCustomPriceFormSchema = z.object({
  customPricePerSeat: z
    .number()
    .min(0, 'Price must be 0 or more')
    .max(100000, 'Price exceeds maximum limit')
    .nullable()
    .optional(),
  status: subscriptionStatusSchema.optional(),
  cancelAtPeriodEnd: z.boolean().optional(),
})

export type UpdateCustomPriceFormValues = {
  customPricePerSeat?: number | null
  status?: SubscriptionStatus
  cancelAtPeriodEnd?: boolean
}

export const universitySubscriptionItemSchema = z.object({
  universityId: z.string(),
  universityName: z.string(),
  universityCode: z.string(),
  universityStatus: z.string(),
  subscriptionStatus: subscriptionStatusSchema,
  cancelAtPeriodEnd: z.boolean(),
  canceledAt: z.string().nullable(),
  currentStudentsCount: z.number(),
  peakStudentsCount: z.number(),
  customPricePerSeat: z.number().nullable(),
  nextCustomPricePerSeat: z.number().nullable().optional(),
  defaultPricePerSeat: z.number(),
  effectivePricePerSeat: z.number(),
  nextEffectivePricePerSeat: z.number().nullable().optional(),
  hasNextPriceChange: z.boolean().optional().default(false),
  nextPriceEffectiveDate: z.string().nullable().optional(),
  isCustomPrice: z.boolean(),
  estimatedMonthlyTotal: z.number(),
  currency: z.string(),
  billingPeriod: z.string(),
  billingPeriodStart: z.string(),
  billingPeriodEnd: z.string(),
  nextBillingDate: z.string(),
  gracePeriodEnd: z.string().optional(),
  isInGracePeriod: z.boolean().optional().default(false),
  isOverdue: z.boolean().optional().default(false),
})

export type UniversitySubscriptionItem = z.infer<
  typeof universitySubscriptionItemSchema
>

export const subscriptionInvoiceSchema = z.object({
  id: z.string(),
  billingPeriodStart: z.string(),
  billingPeriodEnd: z.string(),
  peakSeats: z.number(),
  pricePerSeat: z.number(),
  amount: z.number(),
  currency: z.string(),
  status: z.enum(['DUE', 'PAID']),
  dueAt: z.string(),
  gracePeriodEnd: z.string(),
  paidAt: z.string().nullable(),
  createdAt: z.string(),
})

export type SubscriptionInvoice = z.infer<typeof subscriptionInvoiceSchema>

export const subscriptionInvoiceListResponseSchema = z.object({
  data: z.array(subscriptionInvoiceSchema),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    totalCount: z.number(),
    totalPages: z.number(),
  }),
})

export type SubscriptionInvoiceListResponse = z.infer<
  typeof subscriptionInvoiceListResponseSchema
>

export const subscriptionsSummarySchema = z.object({
  totalSubscribedUniversities: z.number(),
  totalActiveStudents: z.number(),
  totalPeakStudents: z.number(),
  totalEstimatedRevenue: z.number(),
  defaultPricePerSeat: z.number(),
  currency: z.string(),
})

export type SubscriptionsSummary = z.infer<typeof subscriptionsSummarySchema>

export const subscriptionsPaginationSchema = z.object({
  page: z.number(),
  limit: z.number(),
  totalCount: z.number(),
  totalPages: z.number(),
})

export type SubscriptionsPagination = z.infer<
  typeof subscriptionsPaginationSchema
>

export const subscriptionListResponseSchema = z.object({
  data: z.array(universitySubscriptionItemSchema),
  pagination: subscriptionsPaginationSchema,
  summary: subscriptionsSummarySchema,
})

export type SubscriptionListResponse = z.infer<
  typeof subscriptionListResponseSchema
>

export const mySubscriptionResponseSchema = z.object({
  subscription: universitySubscriptionItemSchema,
})

export type MySubscriptionResponse = z.infer<
  typeof mySubscriptionResponseSchema
>
