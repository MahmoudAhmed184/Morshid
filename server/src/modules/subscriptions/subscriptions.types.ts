import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Expose, Type } from 'class-transformer'
import { z } from 'zod'

export const SubscriptionStatus = {
  ACTIVE: 'ACTIVE',
  PENDING_CANCELLATION: 'PENDING_CANCELLATION',
  CANCELLED: 'CANCELLED',
} as const

export type SubscriptionStatus =
  (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus]

export const subscriptionStatusSchema = z.enum([
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.PENDING_CANCELLATION,
  SubscriptionStatus.CANCELLED,
])

export const updateGlobalPricingSchema = z.object({
  defaultPricePerSeat: z
    .number({
      error: 'Default price per seat must be a number',
    })
    .min(0, 'Price per seat must be non-negative')
    .max(100000, 'Price per seat exceeds maximum allowed limit'),
  currency: z
    .string()
    .trim()
    .min(1, 'Currency is required')
    .max(10, 'Currency code too long')
    .optional()
    .default('USD'),
})

export type UpdateGlobalPricingRequest = z.infer<
  typeof updateGlobalPricingSchema
>

export const updateUniversitySubscriptionSchema = z.object({
  customPricePerSeat: z
    .number()
    .min(0, 'Price per seat must be non-negative')
    .max(100000, 'Price per seat exceeds maximum allowed limit')
    .nullable()
    .optional(),
  cancelAtPeriodEnd: z.boolean().optional(),
  status: subscriptionStatusSchema.optional(),
})

export type UpdateUniversitySubscriptionRequest = z.infer<
  typeof updateUniversitySubscriptionSchema
>

export const listSubscriptionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  status: subscriptionStatusSchema.optional(),
  sortBy: z
    .enum([
      'name',
      'code',
      'studentsCount',
      'peakStudentsCount',
      'effectivePricePerSeat',
      'estimatedMonthlyTotal',
      'createdAt',
    ])
    .default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
})

export type ListSubscriptionsQuery = z.infer<
  typeof listSubscriptionsQuerySchema
>

export const listUniversityInvoicesQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    status: z.enum(['PAID', 'DUE', 'OVERDUE']).optional(),
    sortBy: z
      .enum(['billingPeriodStart', 'amount', 'peakSeats'])
      .default('billingPeriodStart'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  .refine(
    (value) =>
      value.from === undefined ||
      value.to === undefined ||
      value.from <= value.to,
    {
      message: 'From date must be before or equal to the to date',
      path: ['from'],
    },
  )

export type ListUniversityInvoicesQuery = z.infer<
  typeof listUniversityInvoicesQuerySchema
>

export class GlobalPricingDto {
  @Expose()
  @ApiProperty({
    example: 10.0,
    description: 'Default monthly price per student seat',
  })
  defaultPricePerSeat!: number

  @Expose()
  @ApiPropertyOptional({
    example: 12.0,
    nullable: true,
    description: 'Upcoming seat price scheduled for next billing cycle',
  })
  nextPricePerSeat!: number | null

  @Expose()
  @ApiPropertyOptional({
    example: '2026-09-01T00:00:00.000Z',
    nullable: true,
    description: 'Effective date of scheduled price change',
  })
  nextPriceEffectiveAt!: string | null

  @Expose()
  @ApiProperty({ example: 'USD', description: 'Billing currency code' })
  currency!: string

  @Expose()
  @ApiProperty({
    example: '2026-08-01T00:00:00.000Z',
    description: 'Last updated timestamp',
  })
  updatedAt!: string
}

export class UpdateGlobalPricingRequestDto {
  @ApiProperty({
    example: 15.0,
    description: 'New default monthly price per student seat',
  })
  defaultPricePerSeat!: number

  @ApiPropertyOptional({ example: 'USD', description: 'Currency code' })
  currency?: string
}

export class UniversitySubscriptionItemDto {
  @Expose()
  @ApiProperty({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  universityId!: string

  @Expose()
  @ApiProperty({ example: 'Cairo University' })
  universityName!: string

  @Expose()
  @ApiProperty({ example: 'CU' })
  universityCode!: string

  @Expose()
  @ApiProperty({ example: 'ACTIVE' })
  universityStatus!: string

  @Expose()
  @ApiProperty({
    enum: ['ACTIVE', 'PENDING_CANCELLATION', 'CANCELLED'],
    example: 'ACTIVE',
  })
  subscriptionStatus!: SubscriptionStatus

  @Expose()
  @ApiProperty({ example: false })
  cancelAtPeriodEnd!: boolean

  @Expose()
  @ApiProperty({ example: null, nullable: true })
  canceledAt!: string | null

  @Expose()
  @ApiProperty({
    example: 45,
    description: 'Current number of active student seats',
  })
  currentStudentsCount!: number

  @Expose()
  @ApiProperty({
    example: 60,
    description: 'Peak (max) student seats recorded in this billing month',
  })
  peakStudentsCount!: number

  @Expose()
  @ApiProperty({
    example: null,
    nullable: true,
    description: 'Custom seat price override if configured',
  })
  customPricePerSeat!: number | null

  @Expose()
  @ApiPropertyOptional({
    example: null,
    nullable: true,
    description: 'Upcoming custom seat price scheduled for next cycle',
  })
  nextCustomPricePerSeat!: number | null

  @Expose()
  @ApiProperty({ example: 10.0, description: 'Global default seat price' })
  defaultPricePerSeat!: number

  @Expose()
  @ApiProperty({
    example: 10.0,
    description: 'Effective seat price (custom or global default)',
  })
  effectivePricePerSeat!: number

  @Expose()
  @ApiPropertyOptional({
    example: 12.0,
    nullable: true,
    description: 'Upcoming effective seat price starting next billing month',
  })
  nextEffectivePricePerSeat!: number | null

  @Expose()
  @ApiProperty({
    example: false,
    description: 'Whether a price adjustment is scheduled for next cycle',
  })
  hasNextPriceChange!: boolean

  @Expose()
  @ApiPropertyOptional({
    example: '2026-09-01T00:00:00.000Z',
    nullable: true,
    description: 'Effective date of upcoming price adjustment',
  })
  nextPriceEffectiveDate!: string | null

  @Expose()
  @ApiProperty({
    example: false,
    description: 'Whether this university has custom pricing',
  })
  isCustomPrice!: boolean

  @Expose()
  @ApiProperty({
    example: 600.0,
    description:
      'Estimated monthly bill (peakStudentsCount * effectivePricePerSeat)',
  })
  estimatedMonthlyTotal!: number

  @Expose()
  @ApiProperty({ example: 'USD' })
  currency!: string

  @Expose()
  @ApiProperty({
    example: '2026-08',
    description: 'Current billing period (YYYY-MM)',
  })
  billingPeriod!: string

  @Expose()
  @ApiProperty({ example: '2026-08-01T00:00:00.000Z' })
  billingPeriodStart!: string

  @Expose()
  @ApiProperty({ example: '2026-08-31T23:59:59.999Z' })
  billingPeriodEnd!: string

  @Expose()
  @ApiProperty({
    example: '2026-09-20T00:00:00.000Z',
    description: 'Effective cancellation or next renewal date',
  })
  nextBillingDate!: string

  @Expose()
  @ApiProperty({
    example: '2026-09-27T00:00:00.000Z',
    description: 'End of 7-day payment grace period before suspension',
  })
  gracePeriodEnd!: string

  @Expose()
  @ApiProperty({
    example: false,
    description:
      'Whether the subscription is currently in 7-day payment grace period',
  })
  isInGracePeriod!: boolean

  @Expose()
  @ApiProperty({
    example: false,
    description:
      'Whether an invoice is past the 7-day grace period and overdue',
  })
  isOverdue!: boolean
}

export class SubscriptionsSummaryDto {
  @Expose()
  @ApiProperty({ example: 12 })
  totalSubscribedUniversities!: number

  @Expose()
  @ApiProperty({ example: 450 })
  totalActiveStudents!: number

  @Expose()
  @ApiProperty({ example: 520 })
  totalPeakStudents!: number

  @Expose()
  @ApiProperty({ example: 5200.0 })
  totalEstimatedRevenue!: number

  @Expose()
  @ApiProperty({ example: 10.0 })
  defaultPricePerSeat!: number

  @Expose()
  @ApiProperty({ example: 'USD' })
  currency!: string
}

export class SubscriptionsPaginationDto {
  @Expose()
  @ApiProperty({ example: 1 })
  page!: number

  @Expose()
  @ApiProperty({ example: 20 })
  limit!: number

  @Expose()
  @ApiProperty({ example: 50 })
  totalCount!: number

  @Expose()
  @ApiProperty({ example: 3 })
  totalPages!: number
}

export class SubscriptionListResponseDto {
  @Expose()
  @Type(() => UniversitySubscriptionItemDto)
  @ApiProperty({ type: [UniversitySubscriptionItemDto] })
  data!: UniversitySubscriptionItemDto[]

  @Expose()
  @Type(() => SubscriptionsPaginationDto)
  @ApiProperty({ type: SubscriptionsPaginationDto })
  pagination!: SubscriptionsPaginationDto

  @Expose()
  @Type(() => SubscriptionsSummaryDto)
  @ApiProperty({ type: SubscriptionsSummaryDto })
  summary!: SubscriptionsSummaryDto
}

export class SubscriptionInvoiceDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  id!: string

  @Expose()
  @ApiProperty({ example: '2026-08-20T00:00:00.000Z' })
  billingPeriodStart!: string

  @Expose()
  @ApiProperty({ example: '2026-09-20T00:00:00.000Z' })
  billingPeriodEnd!: string

  @Expose()
  @ApiProperty({ example: 500 })
  peakSeats!: number

  @Expose()
  @ApiProperty({ example: 10 })
  pricePerSeat!: number

  @Expose()
  @ApiProperty({ example: 5000 })
  amount!: number

  @Expose()
  @ApiProperty({ example: 'USD' })
  currency!: string

  @Expose()
  @ApiProperty({ enum: ['DUE', 'PAID'] })
  status!: 'DUE' | 'PAID'

  @Expose()
  @ApiProperty({ example: '2026-09-20T00:00:00.000Z' })
  dueAt!: string

  @Expose()
  @ApiProperty({ example: '2026-09-27T00:00:00.000Z' })
  gracePeriodEnd!: string

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  paidAt!: string | null

  @Expose()
  @ApiProperty({ example: '2026-09-20T00:00:00.000Z' })
  createdAt!: string
}

export class SubscriptionInvoicePaginationDto {
  @Expose()
  @ApiProperty({ example: 1 })
  page!: number

  @Expose()
  @ApiProperty({ example: 10 })
  limit!: number

  @Expose()
  @ApiProperty({ example: 24 })
  totalCount!: number

  @Expose()
  @ApiProperty({ example: 3 })
  totalPages!: number
}

export class SubscriptionInvoiceListResponseDto {
  @Expose()
  @Type(() => SubscriptionInvoiceDto)
  @ApiProperty({ type: [SubscriptionInvoiceDto] })
  data!: SubscriptionInvoiceDto[]

  @Expose()
  @Type(() => SubscriptionInvoicePaginationDto)
  @ApiProperty({ type: SubscriptionInvoicePaginationDto })
  pagination!: SubscriptionInvoicePaginationDto
}

export class UpdateUniversitySubscriptionRequestDto {
  @ApiPropertyOptional({
    example: 8.5,
    nullable: true,
    description: 'Custom seat price override (or null to clear)',
  })
  customPricePerSeat?: number | null

  @ApiPropertyOptional({ example: false })
  cancelAtPeriodEnd?: boolean

  @ApiPropertyOptional({
    enum: ['ACTIVE', 'PENDING_CANCELLATION', 'CANCELLED'],
    example: 'ACTIVE',
  })
  status?: SubscriptionStatus
}

export class MySubscriptionResponseDto {
  @Expose()
  @Type(() => UniversitySubscriptionItemDto)
  @ApiProperty({ type: UniversitySubscriptionItemDto })
  subscription!: UniversitySubscriptionItemDto
}
