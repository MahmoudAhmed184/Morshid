import { ApiProperty } from '@nestjs/swagger'
import { Expose } from 'class-transformer'
import { z } from 'zod'

import { ReviewOutcome, ReviewStatus } from '../../generated/prisma/client'

const MAX_PUBLISHED_CONTENT_CODE_POINTS = 4_000

const nullableReasonSchema = z
  .preprocess(
    (value) =>
      typeof value === 'string' && value.trim() === ''
        ? null
        : typeof value === 'string'
          ? value.trim()
          : value,
    z.string().max(500).nullable(),
  )
  .default(null)

const publishedContentSchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    (value) => Array.from(value).length <= MAX_PUBLISHED_CONTENT_CODE_POINTS,
    'Content must contain at most 4,000 characters',
  )

export const resolveReviewRequestSchema = z
  .object({
    expectedVersion: z.number().int().min(1),
    outcome: z.enum([
      ReviewOutcome.APPROVED,
      ReviewOutcome.EDITED,
      ReviewOutcome.REPLACED,
    ]),
    content: z.preprocess(
      (value) =>
        typeof value === 'string' && value.trim() === ''
          ? null
          : typeof value === 'string'
            ? value.trim()
            : value,
      publishedContentSchema.nullable(),
    ),
    reason: nullableReasonSchema,
  })
  .strict()
  .superRefine(({ outcome, content }, context) => {
    const approvedWithContent =
      outcome === ReviewOutcome.APPROVED && content !== null
    const revisionWithoutContent =
      outcome !== ReviewOutcome.APPROVED && content === null
    if (approvedWithContent || revisionWithoutContent) {
      context.addIssue({
        code: 'custom',
        path: ['content'],
        message:
          outcome === ReviewOutcome.APPROVED
            ? 'Approved reviews cannot include edited content'
            : 'Edited and replacement reviews require content',
      })
    }
  })

export type ResolveReviewRequest = z.infer<typeof resolveReviewRequestSchema>

export class ResolveReviewRequestDto {
  @ApiProperty({ minimum: 1 })
  expectedVersion!: number

  @ApiProperty({
    enum: [
      ReviewOutcome.APPROVED,
      ReviewOutcome.EDITED,
      ReviewOutcome.REPLACED,
    ],
  })
  outcome!: 'APPROVED' | 'EDITED' | 'REPLACED'

  @ApiProperty({ nullable: true, maxLength: MAX_PUBLISHED_CONTENT_CODE_POINTS })
  content!: string | null

  @ApiProperty({ nullable: true, required: false, maxLength: 500 })
  reason?: string | null
}

export const rejectReviewRequestSchema = z
  .object({
    expectedVersion: z.number().int().min(1),
    reason: z.string().trim().min(1).max(500),
  })
  .strict()

export type RejectReviewRequest = z.infer<typeof rejectReviewRequestSchema>

export class RejectReviewRequestDto {
  @ApiProperty({ minimum: 1 })
  expectedVersion!: number

  @ApiProperty({ minLength: 1, maxLength: 500 })
  reason!: string
}

export class InstructorReviewActionResponseDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  reviewCaseId!: string

  @Expose()
  @ApiProperty({ enum: ReviewStatus, enumName: 'ReviewStatus' })
  status!: ReviewStatus

  @Expose()
  @ApiProperty({ enum: ReviewOutcome, enumName: 'ReviewOutcome' })
  outcome!: ReviewOutcome

  @Expose()
  @ApiProperty({ nullable: true })
  publishedContent!: string | null

  @Expose()
  @ApiProperty({ nullable: true, maxLength: 500 })
  resolutionReason!: string | null

  @Expose()
  @ApiProperty({ minimum: 2 })
  version!: number

  @Expose()
  @ApiProperty({ format: 'date-time' })
  resolvedAt!: string

  @Expose()
  @ApiProperty()
  replayed!: boolean
}
