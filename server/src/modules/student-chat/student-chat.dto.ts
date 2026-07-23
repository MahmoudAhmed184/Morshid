import { ApiProperty } from '@nestjs/swagger'
import { Expose, Type } from 'class-transformer'
import { z } from 'zod'

import {
  MessageRole,
  MessageStatus,
  type MessageGuidanceLabel,
  type MessageRequestKind,
} from '../../generated/prisma/client'

const titleSchema = z.string().trim().min(1).max(160)
const messageContentSchema = z
  .string()
  .trim()
  .min(1)
  .refine((content) => Array.from(content).length <= 4_000, {
    message: 'Content must contain at most 4,000 Unicode code points',
  })

export const MAX_SESSION_PAGE_SIZE = 100
export const DEFAULT_SESSION_PAGE_SIZE = 50
export const MAX_MESSAGE_PAGE_SIZE = 200
export const DEFAULT_MESSAGE_PAGE_SIZE = 50

export const createChatSessionRequestSchema = z
  .object({
    title: titleSchema.optional(),
  })
  .strict()

export const renameChatSessionRequestSchema = z
  .object({
    title: titleSchema,
  })
  .strict()

export const listChatSessionsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(MAX_SESSION_PAGE_SIZE).optional(),
    cursor: z.uuid().optional(),
  })
  .strict()

export const listChatMessagesQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(MAX_MESSAGE_PAGE_SIZE).optional(),
    after: z.coerce.number().int().min(0).optional(),
    before: z.coerce.number().int().positive().optional(),
    page: z.literal('latest').optional(),
  })
  .strict()
  .refine(
    ({ after, before, page }) =>
      [after, before, page].filter((value) => value !== undefined).length <= 1,
    {
      message:
        'Message pagination must use only one of after, before, or page=latest',
    },
  )

export const sendStudentChatMessageRequestSchema = z
  .object({
    clientMessageId: z.uuid().optional(),
    content: messageContentSchema,
  })
  .strict()

export type CreateChatSessionRequest = z.infer<
  typeof createChatSessionRequestSchema
>
export type RenameChatSessionRequest = z.infer<
  typeof renameChatSessionRequestSchema
>
export type ListChatSessionsQuery = z.infer<typeof listChatSessionsQuerySchema>
export type ListChatMessagesQuery = z.infer<typeof listChatMessagesQuerySchema>
export type SendStudentChatMessageRequest = z.infer<
  typeof sendStudentChatMessageRequestSchema
>

export class CreateChatSessionRequestDto {
  @ApiProperty({ minLength: 1, maxLength: 160, required: false })
  title?: string
}

export class RenameChatSessionRequestDto {
  @ApiProperty({ minLength: 1, maxLength: 160 })
  title!: string
}

export class SendStudentChatMessageRequestDto {
  @ApiProperty({ format: 'uuid', required: false })
  clientMessageId?: string

  @ApiProperty({ minLength: 1, maxLength: 4_000 })
  content!: string
}

export class ChatSessionDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  id!: string

  @Expose()
  @ApiProperty({ format: 'uuid' })
  courseId!: string

  @Expose()
  @ApiProperty()
  title!: string

  @Expose()
  @ApiProperty({ format: 'date-time', nullable: true })
  lastMessageAt!: string | null

  @Expose()
  @ApiProperty({ format: 'date-time' })
  createdAt!: string

  @Expose()
  @ApiProperty({ format: 'date-time' })
  updatedAt!: string
}

export class ChatSessionResponseDto {
  @Expose()
  @Type(() => ChatSessionDto)
  @ApiProperty({ type: ChatSessionDto })
  session!: ChatSessionDto
}

export class ChatSessionListResponseDto {
  @Expose()
  @Type(() => ChatSessionDto)
  @ApiProperty({ type: [ChatSessionDto] })
  sessions!: ChatSessionDto[]

  @Expose()
  @ApiProperty({
    format: 'uuid',
    nullable: true,
    description:
      'Pass as `cursor` to fetch the next page; null when no more sessions.',
  })
  nextCursor!: string | null
}

export class ChatCitationEvidenceDto {
  @Expose()
  @ApiProperty({ minimum: 1 })
  rank!: number

  @Expose()
  @ApiProperty({ minimum: -1, maximum: 1 })
  similarityScore!: number

  @Expose()
  @ApiProperty({ format: 'uuid' })
  chunkId!: string

  @Expose()
  @ApiProperty({ minimum: 1 })
  chunkNumber!: number

  @Expose()
  @ApiProperty({ maxLength: 240 })
  excerpt!: string
}

export class ChatCitationDto {
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
  @ApiProperty()
  sourceAvailable!: boolean

  @Expose()
  @Type(() => ChatCitationEvidenceDto)
  @ApiProperty({ type: [ChatCitationEvidenceDto] })
  evidence!: ChatCitationEvidenceDto[]
}

export class ChatMessageDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  id!: string

  @Expose()
  @ApiProperty({ minimum: 1 })
  sequence!: number

  @Expose()
  @ApiProperty({ enum: MessageRole, enumName: 'MessageRole' })
  role!: MessageRole

  @Expose()
  @ApiProperty({ format: 'uuid', nullable: true })
  responseToMessageId!: string | null

  @Expose()
  @ApiProperty()
  content!: string

  @Expose()
  @ApiProperty({ enum: MessageStatus, enumName: 'MessageStatus' })
  status!: MessageStatus

  @Expose()
  @ApiProperty({ nullable: true })
  requestKind!: MessageRequestKind | null

  @Expose()
  @ApiProperty({ nullable: true })
  guidanceLabel!: MessageGuidanceLabel | null

  @Expose()
  @ApiProperty({ nullable: true })
  hintLevel!: number | null

  @Expose()
  @ApiProperty({ nullable: true })
  errorCode!: string | null

  @Expose()
  @ApiProperty({ format: 'date-time' })
  createdAt!: string

  @Expose()
  @ApiProperty({ format: 'date-time', nullable: true })
  completedAt!: string | null

  @Expose()
  @Type(() => ChatCitationDto)
  @ApiProperty({ type: [ChatCitationDto] })
  citations!: ChatCitationDto[]
}

export class ChatMessageHistoryResponseDto {
  @Expose()
  @Type(() => ChatMessageDto)
  @ApiProperty({ type: [ChatMessageDto] })
  messages!: ChatMessageDto[]

  @Expose()
  @ApiProperty({
    nullable: true,
    description:
      'Pass as `after` for forward pagination or `before` for backward pagination; null when no more messages.',
  })
  nextCursor!: number | null
}

export class GroundedChatTurnResponseDto {
  @Expose()
  @Type(() => ChatMessageDto)
  @ApiProperty({ type: ChatMessageDto })
  studentMessage!: ChatMessageDto

  @Expose()
  @Type(() => ChatMessageDto)
  @ApiProperty({ type: ChatMessageDto })
  assistantMessage!: ChatMessageDto
}
