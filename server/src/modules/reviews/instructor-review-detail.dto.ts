import { ApiProperty } from '@nestjs/swagger'
import { Expose, Type } from 'class-transformer'

import {
  MessageRole,
  ReviewActionType,
  ReviewStatus,
  ReviewTriggerType,
  StudentFlagReason,
} from '../../generated/prisma/client'
import { StudentReviewSummaryDto } from './review-case.dto'
import {
  ReviewQueueCourseDto,
  ReviewQueueStudentDto,
} from './instructor-review-queue.dto'

export class InstructorReviewMessageDto {
  @Expose()
  @ApiProperty({ enum: MessageRole, enumName: 'MessageRole' })
  role!: MessageRole

  @Expose()
  @ApiProperty()
  content!: string

  @Expose()
  @ApiProperty({ format: 'date-time' })
  createdAt!: string
}

export class InstructorReviewExchangeDto {
  @Expose()
  @Type(() => InstructorReviewMessageDto)
  @ApiProperty({ type: InstructorReviewMessageDto, nullable: true })
  studentMessage!: InstructorReviewMessageDto | null

  @Expose()
  @Type(() => InstructorReviewMessageDto)
  @ApiProperty({ type: InstructorReviewMessageDto, nullable: true })
  assistantResponse!: InstructorReviewMessageDto | null
}

export class InstructorReviewCitationSnippetDto {
  @Expose()
  @ApiProperty({ minimum: 1 })
  chunkNumber!: number

  @Expose()
  @ApiProperty({ maxLength: 500 })
  excerpt!: string
}

export class InstructorReviewCitationDto {
  @Expose()
  @ApiProperty({ minimum: 1 })
  order!: number

  @Expose()
  @ApiProperty({ format: 'uuid' })
  materialId!: string

  @Expose()
  @ApiProperty()
  materialTitle!: string

  @Expose()
  @Type(() => InstructorReviewCitationSnippetDto)
  @ApiProperty({ type: [InstructorReviewCitationSnippetDto] })
  snippets!: InstructorReviewCitationSnippetDto[]
}

export class InstructorReviewAssistantResponseDto extends InstructorReviewMessageDto {
  @Expose()
  @Type(() => InstructorReviewCitationDto)
  @ApiProperty({ type: [InstructorReviewCitationDto] })
  citations!: InstructorReviewCitationDto[]
}

export class InstructorReviewActionHistoryDto {
  @Expose()
  @ApiProperty({ enum: ReviewActionType, enumName: 'ReviewActionType' })
  type!: ReviewActionType

  @Expose()
  @ApiProperty({ nullable: true })
  actorDisplayName!: string | null

  @Expose()
  @ApiProperty({ nullable: true })
  content!: string | null

  @Expose()
  @ApiProperty({ nullable: true, maxLength: 1000 })
  reason!: string | null

  @Expose()
  @ApiProperty({ minimum: 1 })
  version!: number

  @Expose()
  @ApiProperty({ format: 'date-time' })
  createdAt!: string
}

export class InstructorReviewDetailDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  reviewCaseId!: string

  @Expose()
  @ApiProperty({ enum: ReviewStatus, enumName: 'ReviewStatus' })
  status!: ReviewStatus

  @Expose()
  @ApiProperty({ minimum: 1 })
  version!: number

  @Expose()
  @ApiProperty({
    description:
      'True only for active cases containing Student manual-review triggers exclusively.',
  })
  canReject!: boolean

  @Expose()
  @ApiProperty({ enum: ReviewTriggerType, enumName: 'ReviewTriggerType' })
  trigger!: ReviewTriggerType

  @Expose()
  @ApiProperty({
    enum: StudentFlagReason,
    enumName: 'StudentFlagReason',
    nullable: true,
  })
  studentFlagReason!: StudentFlagReason | null

  @Expose()
  @ApiProperty({ format: 'date-time' })
  createdAt!: string

  @Expose()
  @ApiProperty({ format: 'date-time' })
  requestedAt!: string

  @Expose()
  @ApiProperty({ nullable: true, maxLength: 200 })
  studentNote!: string | null

  @Expose()
  @Type(() => ReviewQueueCourseDto)
  @ApiProperty({ type: ReviewQueueCourseDto })
  course!: ReviewQueueCourseDto

  @Expose()
  @Type(() => ReviewQueueStudentDto)
  @ApiProperty({ type: ReviewQueueStudentDto })
  student!: ReviewQueueStudentDto

  @Expose()
  @Type(() => InstructorReviewMessageDto)
  @ApiProperty({ type: InstructorReviewMessageDto })
  flaggedExchange!: InstructorReviewMessageDto

  @Expose()
  @Type(() => InstructorReviewAssistantResponseDto)
  @ApiProperty({ type: InstructorReviewAssistantResponseDto })
  assistantResponse!: InstructorReviewAssistantResponseDto

  @Expose()
  @Type(() => InstructorReviewExchangeDto)
  @ApiProperty({ type: InstructorReviewExchangeDto, nullable: true })
  previousExchange!: InstructorReviewExchangeDto | null

  @Expose()
  @Type(() => InstructorReviewExchangeDto)
  @ApiProperty({ type: InstructorReviewExchangeDto, nullable: true })
  followingExchange!: InstructorReviewExchangeDto | null

  @Expose()
  @Type(() => InstructorReviewActionHistoryDto)
  @ApiProperty({ type: [InstructorReviewActionHistoryDto] })
  actions!: InstructorReviewActionHistoryDto[]

  @Expose()
  @Type(() => StudentReviewSummaryDto)
  @ApiProperty({ type: StudentReviewSummaryDto })
  reviewSummary!: StudentReviewSummaryDto
}
