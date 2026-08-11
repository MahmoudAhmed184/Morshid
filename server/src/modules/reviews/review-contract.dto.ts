import { ApiProperty } from '@nestjs/swagger'
import { Expose } from 'class-transformer'

import {
  ReviewActionType,
  ReviewOutcome,
  ReviewStatus,
  ReviewTriggerType,
} from '../../generated/prisma/client'

export class ReviewQueueItemContractDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  caseId!: string

  @Expose()
  @ApiProperty({ format: 'uuid' })
  courseId!: string

  @Expose()
  @ApiProperty()
  studentLabel!: string

  @Expose()
  @ApiProperty({ enum: ReviewStatus, enumName: 'ReviewStatus' })
  status!: ReviewStatus

  @Expose()
  @ApiProperty({
    enum: ReviewTriggerType,
    enumName: 'ReviewTriggerType',
    isArray: true,
  })
  triggers!: ReviewTriggerType[]

  @Expose()
  @ApiProperty({ format: 'date-time' })
  createdAt!: string

  @Expose()
  @ApiProperty({ format: 'date-time' })
  updatedAt!: string
}

export class ReviewDetailContractDto extends ReviewQueueItemContractDto {
  @Expose()
  @ApiProperty({ minimum: 1 })
  version!: number

  @Expose()
  @ApiProperty({ type: 'object', additionalProperties: true })
  evidence!: Record<string, unknown>

  @Expose()
  @ApiProperty({ type: 'array', items: { type: 'object' } })
  actions!: Record<string, unknown>[]
}

export class ReviewActionContractDto {
  @ApiProperty({ minimum: 1 })
  expectedVersion!: number

  @ApiProperty({ enum: ReviewActionType, enumName: 'ReviewActionType' })
  action!: ReviewActionType

  @ApiProperty({ nullable: true, required: false })
  content?: string | null

  @ApiProperty({ nullable: true, required: false, maxLength: 1_000 })
  reason?: string | null
}

export class PublishedReviewContractDto {
  @Expose()
  @ApiProperty({ enum: ReviewOutcome, enumName: 'ReviewOutcome' })
  outcome!: ReviewOutcome

  @Expose()
  @ApiProperty({ nullable: true })
  content!: string | null

  @Expose()
  @ApiProperty({ nullable: true, maxLength: 500 })
  reason!: string | null

  @Expose()
  @ApiProperty({ format: 'date-time' })
  resolvedAt!: string
}
