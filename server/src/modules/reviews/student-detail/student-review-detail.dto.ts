import { ApiProperty } from '@nestjs/swagger'
import { Expose } from 'class-transformer'

import { ReviewOutcome, ReviewStatus } from '../interface/review-values'

export class StudentReviewDetailDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  reviewCaseId!: string

  @Expose()
  @ApiProperty({ enum: ReviewStatus, enumName: 'ReviewStatus' })
  status!: ReviewStatus

  @Expose()
  @ApiProperty({
    enum: ReviewOutcome,
    enumName: 'ReviewOutcome',
    nullable: true,
  })
  outcome!: ReviewOutcome | null

  @Expose()
  @ApiProperty({ nullable: true })
  publishedContent!: string | null

  @Expose()
  @ApiProperty({ nullable: true })
  rejectionReason!: string | null

  @Expose()
  @ApiProperty({ format: 'date-time' })
  requestedAt!: string

  @Expose()
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  resolvedAt!: string | null

  @Expose()
  @ApiProperty({ format: 'uuid' })
  messageId!: string

  @Expose()
  @ApiProperty({ format: 'uuid' })
  sessionId!: string
}
