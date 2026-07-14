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

export type CreateChatSessionRequest = z.infer<
  typeof createChatSessionRequestSchema
>
export type RenameChatSessionRequest = z.infer<
  typeof renameChatSessionRequestSchema
>

export class CreateChatSessionRequestDto {
  @ApiProperty({ minLength: 1, maxLength: 160, required: false })
  title?: string
}

export class RenameChatSessionRequestDto {
  @ApiProperty({ minLength: 1, maxLength: 160 })
  title!: string
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
  authorUserId!: string | null

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
}

export class ChatMessageHistoryResponseDto {
  @Expose()
  @Type(() => ChatMessageDto)
  @ApiProperty({ type: [ChatMessageDto] })
  messages!: ChatMessageDto[]
}
